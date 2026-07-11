## Contexto

Auditoria das áreas críticas (PIX, Caixa, Financeiro, "Meus Pedidos") concluída. Três das quatro áreas estão íntegras. O bug de confirmação falsa de PIX já foi corrigido. Resta um fio solto: a função de arquivamento de abandono nunca é acionada.

## Situação atual (confirmada na auditoria)

- ✅ PIX: confirmação falsa corrigida (depende só de `pago_online` / status aprovado).
- ✅ Webhook / Trigger / Edge Functions: intactos e seguros.
- ✅ Caixa / Cozinha: pedidos não pagos invisíveis; financeiro não é afetado.
- ✅ "Meus Pedidos": isolado por `user_id`, exclui rascunho/abandonado.
- ⚠️ `discard_unpaid_drafts` existe (RPC + wrapper `discardUnpaidDrafts`) mas **não é chamada** por nenhum código nem cron.

## Objetivo

Fechar a pendência de arquivamento de abandono, para que a regra de BI (taxa de desistência) funcione e os rascunhos-fantasma sejam limpos — SEM tocar no motor de pagamento (PIX/Webhook/Trigger).

## Alteração proposta

**Arquivo:** `src/routes/checkout.tsx`

Acionar `discardUnpaidDrafts()` (best-effort) no momento em que o cliente inicia um novo checkout — antes de `placeOrder`, dentro de `handleSubmit`, logo após validar a sessão do usuário. Assim, qualquer rascunho anterior não pago do próprio cliente é marcado como `pagamento_abandonado` antes de criar o novo pedido.

Detalhes:
- Importar `discardUnpaidDrafts` de `@/lib/orders`.
- Chamar dentro de `try/catch` sem bloquear o checkout se falhar (padrão best-effort já usado para `fetchEsgotadoIds`).
- Não altera nenhuma lógica de pagamento, cashback, fiado ou visibilidade — apenas arquiva rascunhos abandonados do próprio usuário.

## O que NÃO será alterado (garantias)

- `supabase/functions/mp-create-payment` e `mp-webhook` — intactos.
- RPCs `create_order`, `finalize_order_paid`, `discard_unpaid_drafts` e triggers — intactos.
- Filtros de visibilidade do Caixa e de "Meus Pedidos" — intactos.
- Lógica de PIX/QR Code — intacta.

## Validação

- Typecheck com `tsgo`.
- Deploy no Preview e teste do fluxo: iniciar checkout PIX, abandonar (voltar), iniciar outro — o rascunho anterior deve sair como `pagamento_abandonado` e não aparecer em "Meus Pedidos" nem no Caixa.

## Observação

Se você preferir que o arquivamento rode de forma agendada (cron diário) em vez de no início de cada checkout, me avise — é uma alternativa, mas exigiria configurar um job no backend. A opção acima (no checkout) é a mais simples e imediata.
