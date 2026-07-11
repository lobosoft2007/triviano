## Objetivo

Corrigir o bug em que o PIX é dado como "pago" instantaneamente (sem pagamento), limpando o carrinho e mostrando "Pagamento confirmado!". A correção é **exclusivamente no frontend** — o motor de pagamento (PIX, Webhook, Trigger, Edge Functions) NÃO será tocado.

## Causa raiz

Em `src/components/checkout/MercadoPagoCheckout.tsx`, o polling de status (linha ~61) considera o pedido pago quando `status_pedido === "Recebido"`:

```ts
if (st?.pago_online || paidStatuses.current.has(mpStatus) || st?.status_pedido === "Recebido") {
```

`status_pedido` é apenas o rótulo da esteira de status e nasce como `"Recebido"` em todo pedido novo (gravado por `mp-create-payment`). Logo, a condição dispara antes de qualquer pagamento. O sinal correto de pagamento é `pago_online` (marcado `true` pelo webhook oficial após confirmação real) ou um `mp_status` efetivamente pago.

## Alteração

**Arquivo:** `src/components/checkout/MercadoPagoCheckout.tsx`

Remover a cláusula `|| st?.status_pedido === "Recebido"` da checagem de pagamento, mantendo apenas os sinais financeiros reais:

```ts
if (st?.pago_online || paidStatuses.current.has(mpStatus)) {
```

Nenhuma outra lógica muda: o `paidStatuses` (`paid`/`processed`/`approved`) continua valendo como confirmação vinda do MP, e `pago_online` continua sendo a fonte de verdade populada pelo webhook.

## Resultado esperado

- O QR Code PIX permanece na tela com "Aguardando confirmação do pagamento…" até o pagamento real.
- O carrinho só é limpo e o cliente só é levado a `/orders` após confirmação verdadeira (webhook → `pago_online = true`).
- Cartão (Card Brick) segue funcionando: a confirmação vem do retorno `res.paid` e do polling por `pago_online`.
- Sem impacto em Caixa, Financeiro, Fluxo de Caixa, Webhook ou Trigger.

## Preservação (garantias)

- Não altero `supabase/functions/mp-create-payment`, `mp-webhook`, RPCs, triggers ou qualquer lógica de banco.
- Não altero a regra de `pagamento_abandonado` nem a lógica de visibilidade.

## Validação

- Typecheck com `tsgo` no arquivo alterado.
- Deploy no Preview e verificação: ao abrir o PIX, a tela deve permanecer em "Aguardando confirmação" e não confirmar sozinha.
