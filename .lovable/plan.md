# PIX dinâmico do Mercado Pago no Balcão e nas Mesas

## Objetivo
Hoje o PIX online (QR dinâmico + baixa automática pelo webhook) só existe no **app do cliente** (`checkout.tsx`). No **Balcão** o PIX é estático/offline (operador confirma na mão) e nas **Mesas/Delivery** (diálogo do Caixa) não há PIX online nenhum — tudo é registro manual.

Vamos padronizar: quando o Mercado Pago estiver ativo para a empresa, o operador gera um **QR PIX dinâmico**, o cliente escaneia, e o **webhook do MP** confirma o pagamento. Na confirmação, o pedido é baixado automaticamente (estoque, cashback, recebíveis, senha, impressão) reaproveitando exatamente o motor de finalização atual.

## Princípio de arquitetura (reaproveitar o que já funciona)
- O **webhook `mp-webhook` não muda** — ele já marca `pago_online = true` na confirmação.
- A **baixa financeira continua no navegador do operador**, igual ao Balcão/Mesas de hoje: registrar o pagamento em `pagamentos_pedido` (meio "PIX") + chamar `finalize_order_paid` + imprimir senha/rotas. A diferença é que, em vez de o operador clicar "confirmar PIX manualmente", o botão de finalizar só dispara **depois** que o polling detecta `pago_online = true`.
- Restrição real do MP: a Order do MP cobra o **valor total** do pedido. Portanto o **PIX online paga o pedido inteiro** — não entra em pagamento dividido parcial (dividir com dinheiro/cartão continua no fluxo manual atual).

## Mudança de Backend (1 Edge Function)
`supabase/functions/mp-create-payment/index.ts`:
1. **Autorização por operador:** hoje bloqueia com `order.user_id !== user.id` (403). Passar a permitir também **funcionário da empresa dona do pedido** (papel `admin`/operador da `order.empresa_id`), reusando a mesma checagem do `mp_get_order_status` (`has_role(user,'admin')` + confirmação de que o operador pertence à `empresa_id` do pedido). Necessário porque em pedidos de Mesa o `order.user_id` é o cliente, não o operador.
2. **Novo parâmetro `context`** (`'balcao' | 'mesa'`) para controlar a visibilidade:
   - **Balcão** (`'balcao'`): mantém o comportamento atual (`aguardando_pagamento = true`, `status = 'rascunho_pagamento'`). Assim um QR abandonado vira só um rascunho e nunca chega ao KDS/Caixa.
   - **Mesa** (`'mesa'`): o pedido **já está ativo e visível** no Caixa; NÃO alterar `status`/`status_pedido`/`aguardando_pagamento`. Apenas gravar `mp_order_id`, `mp_payment_id`, `mp_status` e `tipo_pagamento = 'pix'`. Evita que uma mesa em atendimento suma do painel se o cliente demorar/desistir.
3. Escopo só **PIX** (cartão no balcão/mesa continua na maquininha física; não faz parte deste pedido).

Nenhuma migração de schema é necessária: o meio "PIX" já existe em `meios_pagamento`, e `mp_get_order_status` já libera o operador `admin`.

## Mudança de Frontend

### 1) Componente compartilhado de QR (novo)
`src/components/checkout/PdvPixCharge.tsx` — versão enxuta (só PIX) do `MercadoPagoCheckout`:
- Recebe `orderId`, `amount`, `config` (MpPublicConfig), `context`.
- Chama `createMpPayment({ method: 'pix', context })`, exibe QR + Copia e Cola.
- Faz polling de `fetchMpOrderStatus`; ao virar `pago_online`, chama `onConfirmed()`.
- Reaproveita `createMpPayment`/`fetchMpOrderStatus` de `src/lib/mercadopago.ts`.

`src/lib/mercadopago.ts`: adicionar `context` opcional em `CreateMpPaymentInput`/`createMpPayment` (repassado no body para a Edge Function).

### 2) Balcão — `src/components/caixa/BalcaoView.tsx` (`BalcaoPaymentDialog`)
- Carregar `fetchMpPublicConfig()`; se o MP estiver ativo e `aceita_pix_online`, o método PIX passa a oferecer **"PIX (Mercado Pago)"** com QR dinâmico, em vez do `usePixPayment` estático.
- Refatorar o fluxo: para o caminho PIX-online, **criar o pedido antes** (`placeOrder`) para obter `order_id` + total do servidor, e então renderizar `<PdvPixCharge context="balcao">`.
- Em `onConfirmed`: registrar `addPagamento({ meioId: PIX, valor: totalServidor })` + `finalize_order_paid` + `afterFinalize` (senha/impressão/KDS) — a mesma sequência do `finalize()` atual.
- Fallback: sem MP ativo, mantém o PIX estático + "Recebimento PIX confirmado" de hoje. Dinheiro/cartão/troco não mudam.

### 3) Mesas/Delivery — `src/components/caixa/PaymentDialog.tsx`
- Carregar `fetchMpPublicConfig()`; se MP ativo + `aceita_pix_online`, exibir botão **"Cobrar PIX online (total)"**.
- Ao clicar: `createMpPayment({ method:'pix', context:'mesa' })` para o **total do pedido**, abre `<PdvPixCharge context="mesa">` com o QR.
- Em `onConfirmed`: registrar o pagamento PIX pelo total + `finalize_order_paid` (mesmo `handleFinalize` atual) e fechar.
- O split manual (dinheiro + cartão na maquininha) continua igual; o PIX online só aparece quando ainda não há pagamento parcial lançado (cobra sempre o total).

### 4) Gating de exibição
Reutilizar `fetchMpPublicConfig()` (`ativo`, `aceita_pix_online`) nos dois diálogos para decidir se o botão de PIX online aparece.

## Fora de escopo
- Cartão online no PDV (maquininha física permanece).
- PIX online em pagamento **dividido/parcial** (a Order do MP é sempre o total).
- Webhook `mp-webhook`, `finalize_order_paid`, regras de combo, RLS de `orders` — inalterados.
- Base 1.0.1 preservada.

## Como testar no Preview
1. **Balcão:** adicionar itens → Finalizar → escolher PIX (Mercado Pago) → conferir QR dinâmico → pagar (ambiente de teste MP) → ver baixa automática, senha impressa e pedido some do cupom.
2. **Mesa:** abrir pedido de mesa no Caixa → Pagamento → "Cobrar PIX online (total)" → QR → pagar → pedido finalizado (Finalizado) e sai do painel.
3. **Abandono:** gerar QR e não pagar → Balcão vira rascunho (não aparece no KDS); Mesa continua ativa e visível.
4. **Sem MP ativo:** confirmar que o Balcão volta ao PIX estático e a Mesa ao registro manual (nada quebra).

## Detalhes técnicos
- Autorização na Edge Function: `admin.rpc('has_role', { _user_id: user.id, _role: 'admin' })` + checagem de `empresa_id` do operador vs `order.empresa_id` (multi-tenant), mantendo o dono do pedido como caso já aceito.
- Meio "PIX": `id = 039bf14f-129f-48bc-8c1a-6833719e10e3` (buscado dinamicamente por nome, não hardcoded).
- Reconciliação de centavos no Balcão: manter o ajuste de `drift` contra `fetchOrderTotal` já existente antes de `addPagamento`.
- Idempotência do MP: chave `X-Idempotency-Key = order.id-pix-env` já existente cobre reaberturas de QR.
