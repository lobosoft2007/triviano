## Objetivo
No `PaymentDialog` do Caixa, quando o operador escolhe **Dinheiro** e digita um valor maior que o restante, tratar a diferença como **troco** (não como "Excedente"): registrar o pagamento pelo valor exato do restante e mostrar o troco a devolver ao cliente.

## Regra
Aplicar somente quando o meio selecionado no campo "Adicionar pagamento" for **Dinheiro** (match por `nome` case-insensitive, mesmo padrão já usado para PIX) **e** `valor digitado > restante > 0`.

Nesse caso, ao clicar em **+ (Adicionar)**:
- Lançar `addPagamento` com `valor = restante` (não com o valor digitado).
- Calcular `troco = valorDigitado − restante` e exibir num aviso destacado ("Troco a devolver: R$ X,XX") logo abaixo do resumo, além de um `toast.success` confirmando o troco.
- Como o pagamento fecha exatamente o total, o botão **Finalizar** fica habilitado normalmente.

Se o meio for qualquer outro (Cartão, PIX, Fiado, etc.), manter o comportamento atual (mostra "Excedente" e bloqueia Finalizar), porque só faz sentido dar troco em espécie.

## Mudanças
### `src/components/caixa/PaymentDialog.tsx`
1. Derivar `dinheiroMeio` da lista `meios` (igual ao `pixMeio`).
2. Em `handleAdd`, quando `meioId === dinheiroMeio?.id` e `toCents(v) > restanteCents && restanteCents > 0`:
   - chamar `addPagamento({ valor: restante })`;
   - guardar o troco em `useState<number>` (`troco`) para exibição;
   - `toast.success(\`Troco: \${formatBRL(troco)}\`)`.
3. Renderizar bloco "Troco a devolver" no resumo quando `troco > 0` (some ao fechar/reabrir o diálogo — resetar em `useEffect` ligado a `open`).
4. Não alterar o cálculo de `restante`/`matches` — como o valor lançado é sempre `= restante`, `matches` fica `true` naturalmente.

## Fora do escopo
- `ComandaPaymentDialog` (liquidação de mesa) — o usuário citou apenas "pagamento do pedido"; se quiser aplicar lá também, tratamos numa próxima rodada.
- Nenhuma migration/RPC: `pagamentos_pedido` continua registrando só o valor efetivamente aplicado; troco é informação de UI (não é movimento financeiro).
