
## Objetivo

Implementar o motor de estimativa de tempo descrito no documento: cálculo separado de preparo (cozinha) e entrega (logística), com linhas de produção paralelas, pipeline por etapas dentro de cada linha e margem de segurança proporcional. Exibição de faixa de tempo no carrinho/checkout do PWA e horário previsto de saída (`H_cozinha`) no cupom da cozinha.

## Modelagem de dados (nova migração)

1. `linhas_producao` (por empresa)
   - `id`, `empresa_id`, `nome` (ex: "Pizza", "Burger", "Açaí"), `ativo`, timestamps.
   - RLS: leitura pública (menu precisa saber para estimar no carrinho), escrita apenas `can_manage_empresa`.

2. `categoria_etapas_preparo` (etapas sequenciais por categoria)
   - `id`, `categoria_id` (FK `categories`), `ordem`, `nome` (ex: "montagem", "forno"), `duracao_min`.
   - Gargalo = `MAX(duracao_min)` por categoria; tempo total = `SUM`.
   - RLS igual `categories`.

3. Extensão de `public.categories`
   - `linha_producao_id uuid NULL` — vínculo com a linha (fallback: 1 linha "Padrão" por empresa).

4. `zonas_entrega`
   - `id`, `empresa_id`, `nome`, `tempo_entrega_min`, `ativo`.
   - RLS: leitura pública, escrita `can_manage_empresa`.
   - Vínculo com o pedido: nova coluna `orders.zona_entrega_id` + fallback `empresas.tempo_entrega_padrao_min` para quando a zona não for informada.

5. Extensão de `public.orders`
   - `tempo_preparo_min int`
   - `tempo_entrega_min int`
   - `tempo_estimado_min int` (preparo + margem + entrega)
   - `hora_prevista_pronto timestamptz` (SLA cozinha = agora + preparo + margem)
   - `zona_entrega_id uuid NULL`

Todas as tabelas novas recebem `GRANT` explícito (SELECT anon quando pública, SELECT/INSERT/UPDATE/DELETE authenticated conforme política) e `ENABLE ROW LEVEL SECURITY` com políticas escopadas por empresa via `can_manage_empresa`.

## Algoritmo (RPC no banco)

Função `public.calcular_estimativa_pedido(p_items jsonb, p_empresa_id uuid, p_zona_id uuid) returns jsonb`:

1. Para cada item, resolver `categoria_id → linha_producao_id`, e carregar suas etapas (`total`, `gargalo`).
2. Agrupar por linha. Dentro de cada linha, ordenar por `total` desc:
   - `T_linha = total(item1) + Σ gargalo(item_i>=2)`.
3. `T_preparo = MAX(T_linha)` entre todas as linhas ativas do pedido.
4. Margem proporcional: `≤20 → 3`, `21–40 → 5`, `>40 → 8`.
5. `T_entrega` = `zonas_entrega.tempo_entrega_min` (ou padrão da empresa; 0 para retirada/mesa).
6. Retorna `{ preparo, margem, entrega, total_cliente, faixa: [total-margem, total], hora_prevista_pronto }`.

Uso:
- **Carrinho/Checkout (PWA)**: nova server function `estimateOrderTime` que chama a RPC (sem criar pedido) para exibir a faixa antes da confirmação.
- **`create_order` (RPC existente)**: no final, chamar `calcular_estimativa_pedido` e persistir `tempo_preparo_min`, `tempo_entrega_min`, `tempo_estimado_min`, `hora_prevista_pronto` na linha inserida.

## Frontend

1. **Carrinho / `src/routes/checkout.tsx`**
   - Ao mudar itens ou endereço/zona, chamar `estimateOrderTime` (debounced) e exibir:
     > "Tempo estimado: 50–55 min (Preparo: ~35 min · Entrega: ~15 min)"
   - Limite inferior = `total_cliente − margem`; superior = `total_cliente`.

2. **Cupom de cozinha (`print-agent` / `enqueue_print_jobs`)**
   - Incluir `hora_prevista_pronto` no payload e imprimir no cupom do setor:
     > **PREVISTO P/ SAÍDA: 19:40**
   - `src/lib/notifications.ts` / rótulos permanecem inalterados.

3. **Admin (`/admin`)**
   - Nova aba **Tempos de Preparo** com CRUD de:
     - Linhas de Produção (`linhas_producao`).
     - Etapas por Categoria (`categoria_etapas_preparo`) e vínculo `categories.linha_producao_id`.
     - Zonas de Entrega (`zonas_entrega`) + campo "tempo padrão" em `EmpresaConfigTab`.
   - Componentes novos: `LinhasProducaoCrud.tsx`, `EtapasPreparoEditor.tsx` (dentro do editor de categoria), `ZonasEntregaCrud.tsx`.

## Compatibilidade / Fallbacks

- Categoria sem etapas configuradas → usa `categories.prep_time_min` atual (se existir) ou `0`.
- Categoria sem linha → assume linha implícita "Padrão" (todos os itens sem linha competem entre si em pipeline).
- Zona não informada → usa `empresas.tempo_entrega_padrao_min` (novo, default 20) ou `0` para atendimento em mesa/balcão.
- Pedidos antigos: colunas ficam `NULL`; UI trata como "sem estimativa".

## Fora de escopo desta rodada

- Ajuste dinâmico por fila real da cozinha (nº de pedidos ativos, hora do dia).
- Roteamento por GPS/mapas para calcular zona automaticamente pelo CEP.
- Reestimativa contínua após envio do pedido (a estimativa é congelada em `create_order`).

## Validação após implementar

1. Cenário do doc: 2 pizzas (20/15) + 1 burger (12) + zona 15 min → preparo 35, total 55, cupom "PREVISTO 19:40" (dado `Hora_atual=19:00`).
2. Só burger → preparo 12, margem 3, total 30 (12+3+15).
3. Retirada (sem zona) → só preparo + margem exibidos.
4. Pedido criado no `/caixa` (balcão) grava as 4 colunas em `orders`.
5. Cupom do setor Cozinha imprime a linha "PREVISTO P/ SAÍDA".
