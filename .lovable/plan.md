## Diagnóstico

O dialog "Meus pedidos" trava no loading porque o `GET /rest/v1/orders` retorna **400 Bad Request**:

```
column meios_pagamento_2.tipo does not exist
hint: Perhaps you meant to reference the column "meios_pagamento_2.ativo"
```

Em `src/lib/orders.ts` (função `fetchOrders`), o select faz join `pagamentos_pedido(valor_pago, meios_pagamento(nome, tipo))`. A coluna `tipo` **não existe mais** na tabela `meios_pagamento` (colunas atuais: `id, nome, ativo, exige_maquineta, empresa_id, percentual_cashback, is_sistema, created_at, updated_at`). Provavelmente foi removida no refactor do CRUD de Meios de Pagamento (Release 1.8.0). Por isso a chamada quebra por inteiro e o PostgREST devolve 400 antes mesmo da RLS.

## Correção

Um único arquivo, mudança pontual e sem tocar em regra de negócio.

### `src/lib/orders.ts`

1. No `.select(...)` do `fetchOrders`, trocar `meios_pagamento(nome, tipo)` por `meios_pagamento(nome)`.
2. No mapeamento de `pagamentos`, remover a leitura de `p.meios_pagamento?.tipo` e:
   - Ajustar o tipo local `rawPagamentos` para refletir apenas `{ nome?: string }`.
   - Definir `tipo: ""` no objeto `OrderPayment` retornado (mantém o contrato da interface sem exigir a coluna).
3. Manter o restante do fluxo, incluindo `isReorderable` e o botão "Repetir pedido" para pedidos Finalizados/Cancelados — nada muda no comportamento visível além de a lista voltar a carregar.

## Verificação

- Recarregar o PWA em `/orders` como cliente e confirmar que a lista aparece.
- Confirmar que pedidos Finalizado/Cancelado continuam com o botão "Repetir pedido".
- Sem alteração em RLS, triggers ou migrations.
