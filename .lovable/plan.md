## Diagnóstico (confirmado por queries)

- Cadastro correto: **Cozinha** tem 8 categorias (incluindo Pizzas), **Bar** tem Bebidas/Açaís, **Caixa** tem Diversos, **Balcão de Entregas** com `imprime_pedido_completo = true`. Todas ativas na mesma `empresa_id` do pedido.
- `enqueue_print_jobs` está correta: chamada manual no pedido `f8bdd5d2…` gerou os jobs de setor (Cozinha e Bar) como esperado.
- Causa real: no `create_order`, o `INSERT` em `orders` acontece **antes** do `INSERT` em `order_items`. O trigger `trg_orders_enqueue_print` (AFTER INSERT em `orders`) dispara nesse instante — o loop de setor não acha itens e nada é enfileirado. O loop de `pedido_completo` varre `config_impressoras` direto e por isso o job do Balcão sai normalmente. Depois o trigger marca `impresso_cozinha = true` e nenhum UPDATE posterior reenfileira.

## Correção (revisada para evitar double-enqueue)

Migração única, sem tocar em frontend nem no motor financeiro:

1. **`trg_orders_enqueue_print`**: transformar o ramo `TG_OP = 'INSERT'` em no-op (só `RETURN NEW`). Manter as condições (a) `impresso_cozinha false→true`, (b) webhook PIX/cartão (`aguardando_pagamento true→false`) e (c) rede de segurança `status ∈ (paid, delivered)` exatamente como estão — inclusive o `UPDATE ... SET impresso_cozinha = true` interno das (b) e (c), que continua protegido pelo `pg_trigger_depth() > 1`.
2. **`create_order`**: após o `INSERT` em `order_items` (e o cálculo final do pedido), quando `v_aguardando_pagamento = false`, executar apenas
   `UPDATE public.orders SET impresso_cozinha = true WHERE id = v_order_id;`
   Esse UPDATE aciona o trigger via condição (a), que enfileira os jobs com os itens já presentes. Como (a) **não** faz UPDATE interno, não há recursão nem double-enqueue.
3. PIX/cartão online: como `aguardando_pagamento = true`, o `create_order` não faz o UPDATE — o cupom só sai quando o webhook zera `aguardando_pagamento` e o ramo (b) dispara, como hoje.

## Validação

- Pedido novo em Dinheiro com itens de Cozinha, Bar e Diversos → `print_jobs` mostra um job `setor` para Cozinha, um para Bar, um para Caixa e um `pedido_completo` para Balcão de Entregas (sem duplicatas).
- Pedido PIX → nenhum job antes do webhook; após confirmação, mesmos jobs acima aparecem uma única vez.
- Pedidos antigos travados sem cupom de setor podem ser reprocessados com `SELECT enqueue_print_jobs('<id>')` (comportamento já validado agora, retornou 3 jobs).
