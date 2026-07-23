
## Objetivo

Hoje o PWA mostra "Crédito" e "Débito" com dica "Maquininha na entrega", mas — quando o Mercado Pago está ativo — abre o Brick e pede os dados do cartão. Vamos separar em 4 opções distintas e independentes, cada uma cadastrada como meio em `/admin > Meios de Pagamento` (para ter cashback e taxas próprios). Retenção de cartão para futuras compras (Mercado Pago Customer Cards) fica para uma próxima fase.

## Escopo (apenas frontend / checkout)

Não mexer no motor financeiro (RPCs `create_order`, `finalize_order_paid`, webhook `mp-create-payment`/`mp-webhook`, triggers de estoque/cashback, trigger de "finalizado exige pago"). A separação é puramente de UX + rótulos + roteamento condicional.

## Novo conjunto de opções no PWA

Substituir as 2 linhas atuais de cartão por 4 rótulos independentes:

- **Crédito online** — abre o Brick de cartão do Mercado Pago (fluxo atual). Só aparece quando `mpConfig.aceita_cartao_online = true`.
- **Débito online** — mesmo Brick, mas configurado para forçar débito no MP. Só aparece quando `mpConfig.aceita_cartao_online = true`.
- **Crédito na entrega** — só rótulo, nenhum Brick, nenhum dado de cartão pedido. Só aparece quando `mpConfig.aceita_na_entrega = true` (ou quando o MP está desligado, como fallback atual).
- **Débito na entrega** — idem, débito na maquininha do entregador. Mesma regra de visibilidade.

Regras conjuntas:
- Se MP ativo e "na entrega" habilitado → mostra as 4.
- Se MP inativo → só as 2 "na entrega".
- Se "na entrega" desligado no admin → só as 2 "online".

## Alterações de código

### 1. `src/routes/checkout.tsx`

- Ampliar o union `PayMethod` para incluir `"Crédito online" | "Débito online" | "Crédito na entrega" | "Débito na entrega"` e remover `"Cartão de Crédito"` / `"Cartão de Débito"`.
- Reescrever `PAY_METHODS` com as 4 novas linhas (labels + hints "Cartão pelo app" / "Maquininha na entrega") + PIX + Dinheiro + Conta Corrente.
- Atualizar `visibleMethods` conforme regras acima.
- Atualizar `isOnlinePayment` para `payMethod === "PIX" || payMethod === "Crédito online" || payMethod === "Débito online"` (as duas "na entrega" nunca são online, mesmo com MP ativo).
- Propagar o novo rótulo em `paymentLabel` (usado no `composedNotes` do pedido) e em toda checagem que hoje bate string com `"Cartão de Crédito"`/`"Cartão de Débito"` (blocos de linhas 265–267, 339–342, 601–608, 647–666).
- Passar o tipo de cartão escolhido para o `<MercadoPagoCheckout>` via nova prop `cardType?: "credit" | "debit"`.

### 2. `src/components/checkout/MercadoPagoCheckout.tsx`

- Adicionar prop `cardType?: "credit" | "debit"` (default: `undefined`).
- Passar `paymentTypes: { excluded: [...] }` no `initialization` do Card Payment Brick para forçar só crédito ou só débito conforme `cardType` (`credit_card`/`debit_card` do MP). Sem `cardType`, mantém o comportamento atual (ambos).

### 3. Migração de rótulos legados (compat)

- Em `src/lib/caixa.ts` (lista `STANDARD` das linhas 664–671), manter `"Cartão de Crédito"` e `"Cartão de Débito"` (histórico) e adicionar as 4 novas variantes, para o resumo do caixa continuar somando corretamente pedidos antigos e novos.
- Nenhuma alteração em `NON_CASH_MEIOS`/regra de gaveta: os quatro rótulos novos continuam sendo "não-dinheiro".

### 4. `/admin > Meios de Pagamento` (dado, não código)

- Cadastro dos 4 meios (`Crédito online`, `Débito online`, `Crédito na entrega`, `Débito na entrega`) fica a cargo do usuário via UI existente (`MeiosPagamentoCrud`) — cada um com seu cashback/taxa. **Não vamos inserir dados por script**; só documentar no fim: "abra /admin > Meios de Pagamento e crie os 4 registros; os 2 antigos podem ser desativados quando não houver mais pedidos abertos usando-os."

## O que **não** entra nesta rodada

- Salvar o cartão do cliente no Mercado Pago (Customer Cards / vault) para reutilizar em compras futuras — combinado com o usuário para uma fase posterior. Vai exigir criar um `mp_customer_id` no `profiles`, listar cartões salvos via edge function e ampliar o Brick para "usar cartão salvo".
- Split, cofre próprio ou tokenização fora do Mercado Pago.
- Alteração de triggers, RLS, RPC `create_order` ou webhook.

## Validação depois de implementar

1. MP ativo + na entrega ligado → 4 opções aparecem; "online" abre o Brick, "na entrega" registra o pedido sem pedir cartão.
2. MP desligado → só as 2 "na entrega".
3. Pedido em "Crédito na entrega" fica visível no /caixa imediatamente (é offline), roteia impressão como offline (dinheiro/fiado).
4. Pedido em "Crédito online" fica oculto até o webhook do MP confirmar (comportamento atual do PIX/cartão).
5. Após cadastrar os 4 meios em /admin, cashback aplicado no pedido usa a % daquele meio específico.
