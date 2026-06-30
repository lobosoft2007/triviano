-- 1) Lock down execution of privileged/custom functions (security finding 0028).
--    These remain SECURITY DEFINER because they perform privileged cross-user
--    writes (other customers' fiado/cashback balances, the cash ledger) that
--    RLS would otherwise block; each validates admin/ownership internally.
REVOKE EXECUTE ON FUNCTION public.finalize_order_paid(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_cashback_for_order(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_pix_config() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finalize_order_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_cashback_for_order(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_pix_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2) Recreate finalize_order_paid so EVERY payment method (including Cashback
--    and Fiado) posts a revenue line into movimentacoes_caixa tagged by
--    id_meio_pagamento, while keeping the fiado/cashback ledger updates.
CREATE OR REPLACE FUNCTION public.finalize_order_paid(p_order_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_total numeric;
  v_status text;
  v_caixa uuid;
  v_pag RECORD;
  v_disp numeric;
  v_cashback numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT user_id, total, status_pedido INTO v_user, v_total, v_status
  FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Encerrado e pago' THEN RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user); END IF;

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;

  FOR v_pag IN
    SELECT pp.valor_pago, pp.id_meio_pagamento, mp.nome
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = p_order_id
  LOOP
    -- Record a revenue line for every payment method (Dinheiro, PIX, Cartão,
    -- Cashback e Fiado) tagged with its id_meio_pagamento for reconciliation.
    IF v_caixa IS NOT NULL AND v_pag.id_meio_pagamento IS NOT NULL THEN
      INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
      VALUES (v_caixa, 'Recebimento Pedido', v_pag.valor_pago,
        'Pedido ' || substr(p_order_id::text,1,6) || ' (' || v_pag.nome || ')', v_pag.id_meio_pagamento);
    END IF;

    IF v_pag.nome = 'Fiado' THEN
      IF NOT (SELECT fiado_autorizado FROM public.profiles WHERE id = v_user) THEN
        RAISE EXCEPTION 'Cliente não está autorizado a comprar no fiado.';
      END IF;
      SELECT (limite_fiado - saldo_devedor_fiado) INTO v_disp
        FROM public.profiles WHERE id = v_user;
      IF v_pag.valor_pago > v_disp THEN
        RAISE EXCEPTION 'Limite de fiado insuficiente. Disponível: %', v_disp;
      END IF;
      UPDATE public.profiles SET saldo_devedor_fiado = saldo_devedor_fiado + v_pag.valor_pago
        WHERE id = v_user;
      INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento)
      VALUES (v_user, p_order_id, 'Debito_Compra', v_pag.valor_pago,
        (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user));
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa');
    END IF;
  END LOOP;

  -- credit 5% cashback on the order total
  v_cashback := round(COALESCE(v_total,0) * 0.05, 2);
  IF v_cashback > 0 THEN
    UPDATE public.profiles SET saldo_cashback = saldo_cashback + v_cashback WHERE id = v_user;
    INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao)
    VALUES (v_user, p_order_id, 'Credito', v_cashback, 'Cashback de 5% sobre a compra');
  END IF;

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_order_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_order_paid(uuid) TO authenticated;