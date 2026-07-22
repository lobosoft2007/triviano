
CREATE OR REPLACE FUNCTION public.abater_fiado_com_cashback(p_user_id uuid, p_valor numeric DEFAULT NULL::numeric)
RETURNS TABLE(saldo_cashback numeric, saldo_devedor numeric, abatido numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash numeric; v_debt numeric; v_emp uuid; v_use numeric;
  v_novo_cash numeric; v_novo_debt numeric;
BEGIN
  SELECT p.saldo_cashback, p.saldo_devedor_fiado, p.empresa_id
    INTO v_cash, v_debt, v_emp
    FROM public.profiles p WHERE p.id = p_user_id
    FOR UPDATE;
  IF v_cash IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  IF p_user_id <> auth.uid() AND NOT public.can_manage_empresa(v_emp) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_use := LEAST(
    COALESCE(NULLIF(p_valor, 0), v_cash),
    v_cash,
    v_debt
  );
  v_use := round(GREATEST(v_use, 0), 2);
  IF v_use <= 0 THEN
    RAISE EXCEPTION 'Nada a abater: verifique o saldo de cashback e a dívida de fiado.';
  END IF;

  UPDATE public.profiles p
    SET saldo_cashback = p.saldo_cashback - v_use,
        saldo_devedor_fiado = GREATEST(0, p.saldo_devedor_fiado - v_use)
    WHERE p.id = p_user_id
    RETURNING p.saldo_cashback, p.saldo_devedor_fiado INTO v_novo_cash, v_novo_debt;

  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    p_user_id, NULL, 'debito_abatimento_fiado', v_use, v_novo_cash);

  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (p_user_id, NULL, 'Debito', v_use,
    'Abatimento de fiado com cashback', v_emp);

  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
  VALUES (p_user_id, NULL, 'Credito_Pagamento', v_use, v_novo_debt, v_emp);

  INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, id_pedido, saldo_devedor_momento)
  VALUES (p_user_id, v_emp, 'Credito', v_use,
    'Abatimento com cashback', NULL, v_novo_debt);

  UPDATE public.clientes_fiado cf
    SET saldo_devedor_atual = v_novo_debt, updated_at = now()
    WHERE cf.user_id = p_user_id;

  PERFORM public.notify_cashback(p_user_id, v_use, 'debito_abatimento_fiado');

  RETURN QUERY SELECT v_novo_cash, v_novo_debt, v_use;
END;
$function$;
