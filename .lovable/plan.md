# Corrigir notificação "Pedido enviado" (só após pagamento confirmado)

## Diagnóstico (causa raiz confirmada)
O trigger `trg_notify_customer_order_sent` roda **AFTER INSERT** em toda linha da tabela `orders` e insere a notificação **"Pedido enviado"** (função `notify_customer_order_sent`).

Pedidos online (PIX / cartão via Mercado Pago) são criados **antes** do pagamento, com `aguardando_pagamento = true` e `status = 'rascunho_pagamento'`. Como o trigger dispara no INSERT sem checar esse estado, a notificação é gravada assim que o cliente abre a tela de pagamento — por isso ela aparece mesmo quando ele volta ao cardápio sem pagar.

## Correção (uma migration, só banco — não toca no motor de pagamento)

1. **Ajustar a função do trigger de INSERT** (`notify_customer_order_sent`): adicionar, no topo, `IF NEW.aguardando_pagamento THEN RETURN NEW; END IF;`. Assim, pedidos que já entram direto na fila (Dinheiro / cartão na entrega) continuam notificando na criação — igual a hoje. Pedidos online aguardando pagamento **não** notificam no INSERT.

2. **Criar um novo trigger de UPDATE** em `public.orders` que dispara a mesma notificação "Pedido enviado" **somente** quando `aguardando_pagamento` muda de `true → false` — exatamente o momento em que o webhook do Mercado Pago confirma o pagamento e libera o pedido para a cozinha.

## Resultado
- **Dinheiro / cartão na entrega** → notifica na criação (comportamento atual preservado).
- **PIX/cartão pago** → notifica só após o pagamento confirmado pelo webhook.
- **PIX/cartão abandonado** (voltou ao cardápio sem pagar) → **nunca** notifica.

## Não será alterado
- Nada no webhook (`mp-webhook`), no `MercadoPagoCheckout`, no `create_order`, no fluxo de checkout, nos rascunhos/`discard_unpaid_drafts` ou no versionamento.

## Detalhes técnicos
- `CREATE OR REPLACE FUNCTION public.notify_customer_order_sent()` com o guard `aguardando_pagamento`.
- Nova função `public.notify_customer_order_paid_sent()` (mesma inserção em `notificacoes_cliente`) + trigger:
  `CREATE TRIGGER trg_notify_customer_order_paid_sent AFTER UPDATE OF aguardando_pagamento ON public.orders FOR EACH ROW WHEN (OLD.aguardando_pagamento = true AND NEW.aguardando_pagamento = false) EXECUTE FUNCTION public.notify_customer_order_paid_sent();`
- Migration idempotente (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`). Sem mudança de schema de tabela.
