## Problema

No `/caixa`, o `StatusControl` do pedido de Delivery permite marcar direto como **Finalizado** — o pedido sai do dashboard sem passar pelo fluxo de "Finalizar e Receber" (que roda a RPC `finalize_order_paid`, lança no caixa, cashback, fiado, etc.). Ou seja: pedido some sem baixa financeira.

## Objetivo

**Finalizado deixa de ser um status manualmente selecionável.** Só a RPC de liquidação (`finalize_order_paid`, disparada pelo botão "Finalizar e Receber" ou pelo webhook do Mercado Pago) pode colocar o pedido em `Finalizado`.

## Mudanças

### 1. Frontend — `src/components/caixa/StatusControl.tsx`
- Remover **Finalizado** da lista de opções renderizadas no `<select>` (continua em `ESTEIRA_STATUSES` para exibir o pedido já finalizado, mas não como opção clicável).
- Ao tentar avançar de "Entregue" o operador vê tooltip/label indicando: *"Use Finalizar e Receber para lançar o pagamento."*
- Nenhuma mudança na opção "Cancelado".

### 2. Backend — nova migration
Trigger `BEFORE UPDATE` em `public.orders` (SECURITY DEFINER, `search_path=public`) que **bloqueia** a transição de `status_pedido` para `'Finalizado'` quando o pedido ainda não está pago:

```text
IF NEW.status_pedido = 'Finalizado' AND OLD.status_pedido <> 'Finalizado' THEN
  IF NEW.status <> 'paid' THEN
     RAISE EXCEPTION 'Pedido não pode ser finalizado sem lançamento de pagamento. Use Finalizar e Receber.'
       USING ERRCODE = 'check_violation';
  END IF;
END IF;
```

A RPC `finalize_order_paid` já grava `status='paid'` antes de mudar `status_pedido`, então o fluxo legítimo continua funcionando. Mesa (comanda) não é afetada, pois lá o status é gerenciado pela liquidação da comanda que também passa pelo helper financeiro.

### 3. Nada muda em
- `finalize_order_paid` RPC
- Fluxo de Mesa / Comanda
- Cancelamento (continua estornando estoque)
- Notificações de status (bell/push) — continuam para todos os outros status

## Validação
- Testar: mudar Delivery para "Finalizado" via dropdown → opção não existe mais.
- Testar: chamar `finalize_order_paid` num pedido → conclui sem erro (RPC seta `paid` antes de `Finalizado`).
- Testar: `UPDATE orders SET status_pedido='Finalizado'` direto no banco num pedido não pago → bloqueado pela trigger.
