CREATE OR REPLACE FUNCTION public.pay_fiado_from_mp(p_charge_id uuid, p_mp_payment_id text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_charge public.mp_fiado_charges%ROWTYPE;
  v_pay numeric;
  v_novo_saldo numeric;
BEGIN
  SELECT * INTO v_charge FROM public.mp_fiado_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;

  -- Idempotência
  IF v_charge.status = 'paid' THEN
    RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_charge.user_id);
  END IF;

  v_pay := GREATEST(0, v_charge.valor);

  -- Baixa o saldo devedor do cliente
  UPDATE public.profiles
     SET saldo_devedor_fiado = GREATEST(0, saldo_devedor_fiado - v_pay)
   WHERE id = v_charge.user_id
  RETURNING saldo_devedor_fiado INTO v_novo_saldo;

  -- Extrato do fiado
  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
  VALUES (v_charge.user_id, NULL, 'Credito_Pagamento', v_pay, v_novo_saldo, v_charge.empresa_id);

  -- Extrato da conta corrente
  INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, saldo_devedor_momento)
  VALUES (v_charge.user_id, v_charge.empresa_id, 'Credito', v_pay,
          'Quitação PIX Mercado Pago (mp_payment_id=' || COALESCE(p_mp_payment_id, '') || ')',
          v_novo_saldo);

  -- Espelha em clientes_fiado
  UPDATE public.clientes_fiado
     SET saldo_devedor_atual = v_novo_saldo,
         updated_at = now()
   WHERE user_id = v_charge.user_id;

  -- Notifica o cliente
  PERFORM public.notify_fiado(v_charge.user_id, v_pay, 'credito_pagamento');

  -- Marca cobrança como paga
  UPDATE public.mp_fiado_charges
     SET status = 'paid',
         paid_at = now(),
         mp_payment_id = COALESCE(p_mp_payment_id, mp_payment_id)
   WHERE id = p_charge_id;

  RETURN v_novo_saldo;
END;
$function$;