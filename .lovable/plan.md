## Causa raiz (confirmada pelo erro no console)

`code: '23514'` + mensagem "Pedido nao pode ser finalizado sem lancamento de pagamento" = a trigger `trg_enforce_order_finalized_requires_paid` (adicionada ontem) está abortando a finalização legítima.

Ela exige `orders.status = 'paid'` quando `status_pedido` vira `'Finalizado'`. Mas o motor financeiro legítimo (`_finalize_order_financials`, chamado pela RPC `finalize_order_paid` que o botão "Finalizar" dispara) executa **um único UPDATE**:

```sql
UPDATE public.orders
   SET status_pedido = 'Finalizado', status = 'delivered'
 WHERE id = p_order_id;
```

Nunca passa por `'paid'` — vai direto de `'pending'` para `'delivered'` no mesmo statement. A trigger vê `NEW.status = 'delivered'` (`<> 'paid'`), aborta, o UPDATE é revertido inteiro, o pedido continua no dashboard. Nenhum pedido consegue mais ser finalizado pelo caixa.

## Correção

Ajustar apenas a função da trigger para aceitar os dois estados que o motor usa para marcar "pagamento reconhecido":

```sql
CREATE OR REPLACE FUNCTION public.enforce_order_finalized_requires_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_pedido = 'Finalizado'
     AND (OLD.status_pedido IS DISTINCT FROM 'Finalizado')
     AND COALESCE(NEW.status, '') NOT IN ('paid', 'delivered') THEN
    RAISE EXCEPTION 'Pedido nao pode ser finalizado sem lancamento de pagamento. Use Finalizar e Receber.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
```

A proteção original continua valendo: se o operador tentar setar `status_pedido='Finalizado'` via dropdown/SQL direto num pedido `pending`/`aguardando_pagamento`, `NEW.status` continua `'pending'` e a trigger bloqueia. Só o fluxo `finalize_order_paid` / `_finalize_order_financials` (que grava `status='delivered'` junto) passa.

A trigger em si (o `CREATE TRIGGER`) não precisa ser recriada — só substituo a função.

## Migração

Uma migração curta com `CREATE OR REPLACE FUNCTION` da função acima.

## Validação

- Refazer o teste: pedido Delivery R$4 + R$3 taxa, R$7 em Dinheiro, clicar Finalizar → deve concluir, sair do dashboard, cliente recebe push.
- Sanity: tentar `UPDATE orders SET status_pedido='Finalizado'` direto num pedido `pending` → continua bloqueado.