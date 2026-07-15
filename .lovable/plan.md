## Plano — Ajustes de operação de mesa, recebimento e taxas

Ataca os 5 pontos observados no teste. Nada muda no motor financeiro (mantém `finalize_comanda_paid` / `finalize_order_paid`); toda a novidade é UX + campos configuráveis + trigger de notificação enxuto.

---

### 1) Fila de Visto global + mesas sempre visíveis

**Problema hoje:** a "Solicitação de abertura" só aparece se o operador estiver na aba **Mesas**; depois do Visto, se a comanda não tem pedidos, a mesa some da grade e só volta com o 1º pedido.

**Solução (frontend do Caixa):**
- **Badge global na sidebar do menu "Mesas"** (`CaixaSidebar.tsx`): já mostra `mesaCount`; passa a mostrar também `solicitacoesCount` como um segundo badge âmbar pulsante ao lado (ícone piscando quando > 0). Consulta `mesa-solicitacoes` sobe da rota `caixa.tsx` para ser lida também pela sidebar via prop.
- **Alerta sonoro global:** hoje o beep de nova solicitação só toca se `caixa.tsx` estiver montado com a aba Mesas ativa (o efeito toca, mas o operador está em outra tela e nem vê o Toast). Vamos manter o `useEffect` de beep no `caixa.tsx` (já roda em qualquer aba, porque a rota é a mesma) e adicionar **um toast persistente com CTA "Ir para Mesas"** quando entra solicitação nova estando em outra aba (`tab !== "mesas"`).
- **Mesas permanecem visíveis mesmo sem pedidos:** hoje `MesasColumn` agrupa por `orders` (mesas com pedido). Vamos unir a fonte com `mesasVivas` (`fetchComandasVivas`, já disponível) — toda comanda com status `aberta` ou `aguardando_fechamento` vira um `MesaGroup`, mesmo sem `orders`. Card sem pedidos mostra "aberta há Xmin · aguardando pedido" e não expõe botão de conta.

### 2) Remover "status do pedido" do Caixa e notificações intermediárias

**Frontend:** remover o `StatusControl` (dropdown de status) do `MesaCard` / detalhes de mesa e do card de Delivery. O card mantém só: badges de "novo", "aguardando conta", ações de dispatch (imprimir cozinha) e pagamento.

**Backend (notificações do cliente):** manter **apenas** dois disparos automáticos para o cliente:
1. **Mesa liberada** (Visto do operador) — já existe hoje.
2. **Pedido recebido** — 1ª inserção em `orders` (delivery ou mesa).

Vou localizar o(s) trigger(s) que emitem `notificacoes_cliente` a cada mudança de `status_pedido` (Em preparo / Pronto / Saiu para entrega) e **desabilitá-los** (mantendo o de "Recebido" e o de "Mesa liberada"). É uma migração pequena de `DROP TRIGGER … IF EXISTS` sobre a função de notify por status. Ação manual de push pelo operador (o componente `NotifyClient`) continua intacta.

### 3) Comandas do cliente

Sem mudanças — o usuário aprovou o layout atual.

### 4) Split de pagamento na liquidação da comanda

**Problema:** `ComandaPaymentDialog` (o "Finalizar e Receber · Mesa X") só aceita **um** meio e chama `finalize_comanda_paid(comanda, meio_único)`, ignorando pagamentos parciais.

**Solução — apenas na comanda inteira, sem tocar em pedido individual:**
- Reescrever o `ComandaPaymentDialog` usando o mesmo padrão do `PaymentDialog` de pedido individual (a UI da tela "RECEBIMENTO" que você mandou): lista de "Adicionar pagamento" (meio + valor + "Preencher restante") com totais **Total da conta / Total pago / Restante** e botão "Finalizar" bloqueado até bater 100%.
- Como a comanda agrega **N pedidos**, os pagamentos precisam existir no nível da comanda. Vou criar uma RPC `finalize_comanda_split(comanda_id, pagamentos jsonb[])` que:
  1. Distribui os pagamentos entre os `orders` da comanda proporcionalmente ao total de cada pedido (algoritmo de arredondamento em centavos para bater a soma exata), gravando linhas em `pagamentos_pedido`.
  2. Chama o helper interno `_finalize_order_financials` para cada pedido (mesmo motor de hoje — nada muda no financeiro).
  3. Fecha a comanda igual `finalize_comanda_paid` faz.
- PIX online (QR do total) continua funcionando: quando escolhido, ele bloqueia a UI de split (equivalente ao `canOnlinePix = totalPago === 0` do PaymentDialog).

### 5) Taxa de entrega (delivery) e Gorjeta (mesa) configuráveis

**Admin — `EmpresaConfigTab.tsx`:** dois novos campos na aba Empresa:
- `taxa_entrega_valor` (numeric, R$) — fixo por pedido de delivery.
- `gorjeta_sugerida_percent` (numeric, %) — % configurável (você define, não é 10% travado). Reaproveita a coluna `taxa_servico_mesa` que já existe no banco (renomeio conceitual, sem migração de schema).

**Migração:** só adiciona `taxa_entrega_valor numeric NOT NULL DEFAULT 0` em `empresas`. Zero = desligada.

**Aplicação no total (só quando > 0):**
- **Delivery — `PaymentDialog`:** linha extra "Taxa de entrega" no resumo; o total considerado para "Restante" passa a ser `order.total + taxa_entrega`. Impressão do cupom também exibe a linha.
- **Mesa — `ComandaPaymentDialog` novo (item 4):** linha "Gorjeta (X%) — sugerida" com checkbox **Incluir gorjeta** (marcado por padrão quando % > 0). Cliente/caixa pode desmarcar. Total a receber = `total_parcial × (1 + gorjeta%)` quando marcado.
- Ambos são **apenas exibidos quando o valor configurado > 0** (regra explícita do requisito).

**Nota financeira:** a taxa de entrega e a gorjeta entram como acréscimo do total do pedido/comanda no momento do recebimento. Não altero triggers financeiros; o valor extra vira parte do `valor_pago` distribuído aos meios de pagamento no split (motor atual). Se depois você quiser rastrear a gorjeta como lançamento separado em tesouraria, entra em outra rodada.

---

### Impacto por arquivo (resumo técnico)

- `supabase/migrations/…`: (a) `ALTER TABLE empresas ADD COLUMN taxa_entrega_valor numeric NOT NULL DEFAULT 0`; (b) `DROP TRIGGER` das notificações de status intermediário; (c) `CREATE OR REPLACE FUNCTION finalize_comanda_split(...)`.
- `src/lib/empresa.ts` + `src/lib/mesa.ts`: expor `taxa_entrega_valor`, `taxa_servico_mesa` na config; adicionar `finalizeComandaSplit`.
- `src/components/caixa/CaixaSidebar.tsx` + `src/routes/_authenticated/caixa.tsx`: badge de solicitações + toast global + mesas sempre visíveis via `mesasVivas`.
- `src/components/caixa/ComandaPaymentDialog.tsx`: reescrita com split (padrão do `PaymentDialog`) + linha de gorjeta.
- `src/components/caixa/PaymentDialog.tsx`: linha de taxa de entrega para delivery.
- `src/components/admin/EmpresaConfigTab.tsx`: 2 campos novos.
- Remover `StatusControl` das telas do Caixa (mantém arquivo caso volte a ser usado em outro lugar).

### Fora de escopo (não mexer nesta rodada)

Motor financeiro protegido (`mem://constraints/motor-financeiro-protegido`): mantenho `_finalize_order_financials`, GRANTs/RLS, meios_pagamento, webhook MP e trava PIX intactos. As RPCs novas apenas orquestram o motor existente.
