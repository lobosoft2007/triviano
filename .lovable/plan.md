## Diagnóstico

O checkout do pedido em Dinheiro (aguardando_pagamento=false) aciona a trigger `trg_orders_enqueue_print` no INSERT, que chama a função `public.enqueue_print_jobs`. Essa função faz:

```sql
SELECT o.*, p.nome_completo AS cliente_nome
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
```

Mas em `public.profiles` **não existe** a coluna `nome_completo` — a coluna é `full_name`. Isso levanta `column "nome_completo" does not exist`, aborta a transação do `create_order` e o PWA mostra o toast genérico "Não foi possível finalizar o pedido".

Pedidos PIX/cartão online passavam batido porque nasciam com `aguardando_pagamento=true` (a condição do INSERT não dispara `enqueue_print_jobs`). O bug só ficou visível agora com o novo fluxo de impressão imediata para Dinheiro/Fiado/Maquineta.

## Correção

Migração única em `public.enqueue_print_jobs`:

- Trocar `p.nome_completo AS cliente_nome` por `p.full_name AS cliente_nome`.
- Manter o resto da função idêntico (comportamento, permissões, `SECURITY DEFINER`, `search_path`).

Nenhuma mudança de frontend, RLS ou motor financeiro.

## Validação

- Enviar pedido em Dinheiro pelo PWA → deve registrar sem erro e cair na lista de pedidos.
- Conferir em `print_jobs` que o job do setor/balcão foi criado com `payload->'order'->>'cliente_nome'` preenchido.
- Reenviar um pedido PIX confirmado pelo webhook para garantir que o caminho (b) continua funcionando.
