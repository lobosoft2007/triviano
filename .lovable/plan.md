## Problema

No checkout do PWA (`src/routes/checkout.tsx`), o `handleSubmit` grava um snapshot `pendingPayment` em `sessionStorage` **e** `localStorage` para **qualquer** forma de pagamento — inclusive **Conta Corrente (Fiado)**, **Dinheiro (na entrega)** e **Cartão na entrega**, que **não têm** nenhuma tela de pagamento pendente para renderizar (só PIX e Cartão online usam esse snapshot).

Consequência observada pelo usuário:
1. Cliente finaliza pedido no Fiado → snapshot antigo fica gravado no `localStorage`.
2. Cliente adiciona um novo item (Fanta 350ml, R$ 7,00) e volta ao checkout.
3. `readPendingPaymentSnapshot()` recupera o pedido antigo, `finalTotal = pendingPayment.total` sobrescreve o total real, e `effectivePayMethod = pendingPayment.payMethod`.
4. A tela mostra o total/forma de pagamento do pedido anterior, não vai para "escolher pagamento" do novo, e o pedido novo fica pendente sem forma de resolver — carrinho continua cheio.

## Correção (apenas UI/estado do checkout do cliente)

Alterar somente `src/routes/checkout.tsx`. Não mexer no motor financeiro nem em RPC/RLS.

1. **Só gravar `pendingPayment` quando realmente existe pagamento em andamento.**
   No sucesso do `placeOrder`, gravar o snapshot **apenas** quando `isOnlinePayment === true` (PIX online ou Cartão via MP). Para "Dinheiro", "Cartão na entrega" e "Conta Corrente" **não** chamar `writePendingPaymentSnapshot` nem `setPendingPayment`.

2. **Encerrar o checkout para os fluxos sem pagamento pendente.**
   Após `placeOrder` em Fiado/Dinheiro/Cartão-na-entrega:
   - `clear()` (já feito) — limpa o carrinho.
   - `clearCheckoutSnapshot()` — remove `checkout_auth_latch_v1`, `checkout_payment_snapshot_v1` e ambos os `checkout_pending_payment_v1` (session + local).
   - `navigate({ to: "/orders", replace: true })` — leva o cliente para a lista de pedidos, evitando que a tela de checkout mostre estado "fantasma".
   - Manter o `toast.success` específico para cada método (Fiado / Dinheiro / Cartão na entrega).

3. **Higiene defensiva na montagem do `/checkout`.**
   Se, ao montar, existir um `pendingPayment` em storage cujo `payMethod` **não** seja `PIX` nem `Cartão de Crédito`/`Cartão de Débito` com MP ativo, tratar como snapshot inválido e limpar (`clearCheckoutSnapshot` + `setPendingPayment(null)`). Isso cura clientes que já ficaram com o snapshot "envenenado" antes da correção, sem exigir limpeza manual do navegador.

4. **Sem mudanças em backend.**
   Nada de migração, RPC, RLS ou edge function. Nenhuma alteração no fluxo do caixa. Nenhuma mudança em `placeOrder`, `finalize_order_paid`, cashback, ou notificações.

## Validação manual

- Fazer pedido em **Conta Corrente** → deve limpar carrinho, redirecionar para `/orders`, e um novo checkout partir do zero com o total do carrinho novo.
- Fazer pedido em **Dinheiro (na entrega)** → mesmo comportamento.
- Fazer pedido em **PIX** → continua exibindo a tela de PIX pendente (inalterado).
- Fazer pedido em **Cartão via MP** → continua exibindo o formulário de cartão pendente (inalterado).
- Cliente que já estava com o snapshot antigo travado abre `/checkout` com carrinho novo → snapshot é descartado automaticamente e o fluxo normal aparece.
