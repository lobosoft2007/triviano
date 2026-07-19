## Causa

O endpoint `GET /api/public/tap/tables` (usado pela tela **Mesas** do Triviano Tap) filtra hoje com `.neq("status", "fechada")`. Isso exclui apenas comandas fechadas — comandas com status `cancelada` continuam sendo retornadas.

Na base da empresa 23 existem exatamente 4 comandas nesse estado: 3 na mesa 3 e 1 na mesa 4 (todas com `status = 'cancelada'`, criadas em 14/07). São essas que aparecem no app mesmo com a loja fechada e sem mesas abertas.

## Correção

Em `src/routes/api/public/tap/tables.ts`, trocar o filtro atual por um filtro positivo que só devolve comandas realmente abertas:

- `.eq("status", "aberta")` no lugar de `.neq("status", "fechada")`.

Assim tanto `fechada` quanto `cancelada` (e qualquer outro estado futuro) ficam fora da lista de "Mesas" do garçom.

Nenhuma outra tela precisa mudar: Caixa e Minha Comanda já tratam esses status separadamente.
