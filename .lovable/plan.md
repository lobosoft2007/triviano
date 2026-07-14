## Exibir forma de pagamento e origem em "Meus Pedidos"

Alterar apenas o PWA (frontend + fetch) para mostrar, em cada card de pedido:

- **Onde foi feito**: badge "Delivery" ou "Mesa N" (a partir de `orders.tipo_atendimento` + `numero_mesa`).
- **Como foi pago**: badge com o meio de pagamento (PIX, Dinheiro, Cartão, Fiado, Cashback, etc.) + selo de status:
  - **"Pago online"** (verde) quando `pago_online = true` — deixa claro que já foi quitado no app.
  - **"A pagar na entrega"** (âmbar) quando é Delivery, ainda não pago e sem registro em `pagamentos_pedido`.
  - **"Pago"** (verde) quando existir(em) registro(s) em `pagamentos_pedido` (baixa no Caixa).
  - Se houver split (mais de um meio), lista todos com valores.

### Alterações técnicas

1. **`src/lib/orders.ts` — `fetchOrders` / `OrderRow`**
   - Estender o `select` para incluir `tipo_atendimento, numero_mesa, pago_online, pagamentos_pedido(valor_pago, meios_pagamento(nome, tipo))`.
   - Adicionar ao `OrderRow`: `tipo_atendimento`, `numero_mesa`, `pago_online`, `pagamentos: { nome, tipo, valor }[]`.
   - Mapear a resposta preservando o restante inalterado.

2. **`src/routes/_authenticated/orders.tsx`**
   - No cabeçalho de cada card, ao lado da data, adicionar dois chips:
     - Origem: ícone `MapPin` "Delivery" ou ícone `Utensils` "Mesa {n}".
     - Pagamento: badge com nome do meio + status ("Pago online" / "Pago" / "A pagar na entrega").
   - Quando `pagamentos.length > 1`, mostrar linha extra abaixo do total: "Pago em: PIX R$X,XX + Dinheiro R$Y,YY".

Sem mudanças de backend, RLS ou lógica de negócio — a política de `pagamentos_pedido` já libera leitura para o dono do pedido.