-- 1) Taxa de entrega fixa por empresa (delivery)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS taxa_entrega_valor numeric NOT NULL DEFAULT 0;

-- 2) Nova RPC: liquidação da comanda com split de meios de pagamento.
-- Recebe [{meio_id uuid, valor numeric}, ...]. Agrega por meio e distribui
-- proporcionalmente ao total de cada pedido em aberto da comanda,
-- gravando em pagamentos_pedido e chamando _finalize_order_financials
-- (mesmo motor que finalize_order_paid/finalize_comanda_paid usam).
CREATE OR REPLACE FUNCTION public.finalize_comanda_split(
  p_comanda_id uuid,
  p_pagamentos jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid;
  v_status  text;
  v_orders_total numeric;
  v_orders_count int;
  v_agg RECORD;
  v_order RECORD;
  v_valor_cents  bigint;
  v_running_cents bigint;
  v_alloc_cents  bigint;
  v_idx int;
BEGIN
  SELECT empresa_id, status INTO v_empresa, v_status
    FROM public.comanda_ativa WHERE id = p_comanda_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_status = 'fechada' THEN RETURN; END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT COALESCE(sum(total),0), count(*)
    INTO v_orders_total, v_orders_count
    FROM public.orders
   WHERE comanda_id = p_comanda_id
     AND status_pedido <> 'Finalizado';
  IF v_orders_total <= 0 OR v_orders_count = 0 THEN
    RAISE EXCEPTION 'Comanda sem pedidos em aberto.';
  END IF;

  -- Zera pagamentos anteriores dos pedidos abertos (idempotência).
  DELETE FROM public.pagamentos_pedido pp
   USING public.orders o
   WHERE pp.id_pedido = o.id
     AND o.comanda_id = p_comanda_id
     AND o.status_pedido <> 'Finalizado';

  -- Distribui, por meio, proporcionalmente ao total de cada pedido.
  FOR v_agg IN
    SELECT (item->>'meio_id')::uuid AS meio_id,
           round(sum((item->>'valor')::numeric)::numeric, 2) AS valor_total
      FROM jsonb_array_elements(p_pagamentos) AS item
     WHERE COALESCE((item->>'valor')::numeric, 0) > 0
     GROUP BY (item->>'meio_id')::uuid
  LOOP
    v_valor_cents   := (v_agg.valor_total * 100)::bigint;
    v_running_cents := 0;
    v_idx := 0;
    FOR v_order IN
      SELECT id, total FROM public.orders
       WHERE comanda_id = p_comanda_id
         AND status_pedido <> 'Finalizado'
       ORDER BY created_at
    LOOP
      v_idx := v_idx + 1;
      IF v_idx = v_orders_count THEN
        v_alloc_cents := v_valor_cents - v_running_cents;
      ELSE
        v_alloc_cents := round(v_valor_cents::numeric * v_order.total / v_orders_total)::bigint;
        v_running_cents := v_running_cents + v_alloc_cents;
      END IF;
      IF v_alloc_cents > 0 THEN
        INSERT INTO public.pagamentos_pedido (id_pedido, id_meio_pagamento, valor_pago)
        VALUES (v_order.id, v_agg.meio_id, v_alloc_cents::numeric / 100);
      END IF;
    END LOOP;
  END LOOP;

  -- Liquida cada pedido usando o motor existente.
  FOR v_order IN
    SELECT id FROM public.orders
     WHERE comanda_id = p_comanda_id
       AND status_pedido <> 'Finalizado'
  LOOP
    PERFORM public._finalize_order_financials(v_order.id);
  END LOOP;

  UPDATE public.comanda_ativa
     SET status = 'fechada', fechada_em = now()
   WHERE id = p_comanda_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_comanda_split(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_comanda_split(uuid, jsonb) TO service_role;