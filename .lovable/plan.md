
## Diagnóstico

As colunas **Setor** e **Fornecedor** ficam em branco por duas origens diferentes:

### A) Ordens já salvas (`OrdemCompraDetailDialog.tsx`)
- `reportRows` é montado assim (linhas 135–149):
  ```
  setor: "",
  fornecedor: fornEfetivo?.fornecedor ?? "",
  ```
  ou seja, o setor **nunca** é preenchido e o fornecedor sai do cabeçalho da ordem (fica em branco quando a ordem é consolidada — `id_fornecedor = null`, caso típico da Sugestão / Ordem Única / Consolidada por Setor).
- A tabela `itens_ordem_compra` guarda apenas `tipo + ref_id + nome + quantidade + custo`, sem `setor_id` / `fornecedor_id`. Portanto o setor/fornecedor de cada linha precisa ser **resolvido em runtime** a partir do `ref_id` (join com `insumos` ou `products`).

### B) Ordem em criação a partir da Sugestão (`OrdemCompraManualDialog.tsx`)
- Quando o item vem do catálogo (`catalog`), o `reportRows` (linhas 383–428) lê `setorMap.get(source.setor_id)` e `fornMap.get(source.fornecedor_id)`. Se o catálogo (insumos / `admin_get_products`) devolver `setor_id`/`fornecedor_id`, funciona.
- Quando o preload vem da Sugestão (`abrirConsolidadaPorSetor`, linhas 218–229), os nomes são passados em `setor_nome`/`fornecedor_nome`, mas o efeito de hidratação (linhas 268–298) só grava `preloadNames[key]` quando **há setorNome OU fornNome**, e o render lê `setorMap.get(...) || cached?.setor_nome`. Se o catálogo devolver `setor_id = null` para itens vindos de `products` (bug conhecido de `admin_get_products` que às vezes não expõe `setor_id`), o fallback funciona. Se o próprio `preloadedItems` também tiver setor/forn vazio (item sem setor cadastrado, ou perda no caminho), fica em branco.

## Correções

### 1) `src/lib/estoque.ts` — enriquecer `getOrdemCompra`
- Alterar o retorno de `getOrdemCompra(id)` para incluir por item:
  - `setor_id`, `setor_nome`
  - `fornecedor_id`, `fornecedor_nome`
  - `unidade`
- Implementação: após buscar `itens_ordem_compra`, agrupar `ref_id` por `tipo` e:
  - `SELECT id, setor_id, fornecedor_id, unidade_medida FROM insumos WHERE id IN (...)`;
  - `SELECT id, setor_id, fornecedor_id FROM products WHERE id IN (...)` (via `admin_get_products` já usado, ou select direto se RLS permitir);
  - resolver setor/fornecedor com `listSetores()` + `listFornecedores()`.
- Manter `OrdemCompraItem` retro-compatível: novos campos são opcionais (`string | null`).

### 2) `src/components/admin/OrdemCompraDetailDialog.tsx`
- No `reportRows`, substituir os literais por:
  ```
  setor: i.setor_nome ?? "",
  fornecedor: i.fornecedor_nome ?? fornEfetivo?.fornecedor ?? "",
  unidade: i.unidade ?? "un",
  ```
- Passar também `estoque_atual/min/max` como `null` (o report já esconde por padrão).

### 3) `src/components/admin/OrdemCompraManualDialog.tsx` — robustez
- Sempre gravar `preloadNames[key]` (mesmo com strings vazias) para preservar a intenção do caller, e no `reportRows` inverter a precedência para: **primeiro** `cached?.setor_nome`, depois `setorMap.get(source.setor_id)`. Assim os nomes já resolvidos pela Sugestão (que sabe o setor real) ganham dos derivados do catálogo, que às vezes vêm sem `setor_id`.
- Idem para `fornecedor`.
- Nenhuma mudança na UI ou no salvamento.

### 4) Verificação em `admin_get_products` (só leitura)
- Rodar `supabase--read_query` para confirmar se a RPC devolve `setor_id`/`fornecedor_id`. Se não devolver, incluir na lista de retorno é uma correção adicional — mas provavelmente já devolve (a Sugestão depende disso). Sem alterações se estiver OK.

## Fora de escopo

- Não mudar `itens_ordem_compra` (evita migração para dados históricos; a resolução por `ref_id` cobre todos os casos existentes).
- Não tocar em RLS, cash back, motor financeiro, impressão/paginação (já resolvidos).

## Validação

- Abrir uma **ordem salva consolidada** (várias fornecedores) → visualizar relatório → Setor e Fornecedor preenchidos em todas as linhas.
- Abrir a **Sugestão → Gerar Ordem Consolidada por Setor** → preview → colunas preenchidas.
- Abrir a **Ordem Manual/Avulsa** adicionando item do catálogo e um item livre com setor/fornecedor escolhidos → colunas preenchidas.
- Imprimir e conferir que ainda paginam corretamente com cabeçalho/rodapé em todas as páginas.
