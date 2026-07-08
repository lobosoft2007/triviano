CREATE OR REPLACE FUNCTION public.ajuste_rapido_estoque(p_insumo_id uuid, p_quantidade numeric, p_observacao text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_empresa uuid; v_saldo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
  IF p_quantidade IS NULL OR p_quantidade = 0 THEN RAISE EXCEPTION 'Informe uma quantidade diferente de zero.'; END IF;

  SELECT empresa_id INTO v_empresa FROM public.insumos WHERE id = p_insumo_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Insumo não encontrado.'; END IF;

  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Insumo de outra empresa.';
  END IF;

  UPDATE public.insumos SET saldo_estoque = saldo_estoque + p_quantidade, updated_at = now()
    WHERE id = p_insumo_id RETURNING saldo_estoque INTO v_saldo;

  INSERT INTO public.ajustes_estoque
    (empresa_id, insumo_id, tipo, quantidade, status, observacao, saldo_apos, created_by)
  VALUES (v_empresa, p_insumo_id, 'Entrada Emergencial', p_quantidade, 'Provisorio',
          NULLIF(p_observacao, ''), v_saldo, auth.uid());
  RETURN v_saldo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.conciliar_ajuste_nf(p_ajuste_id uuid, p_quantidade_nf numeric, p_nf_referencia text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_insumo uuid; v_qtd numeric; v_status text; v_fino numeric; v_saldo numeric; v_empresa uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;

  SELECT insumo_id, quantidade, status, empresa_id INTO v_insumo, v_qtd, v_status, v_empresa
    FROM public.ajustes_estoque WHERE id = p_ajuste_id;
  IF v_insumo IS NULL THEN RAISE EXCEPTION 'Ajuste não encontrado.'; END IF;

  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Ajuste de outra empresa.';
  END IF;

  IF v_status = 'Conciliado' THEN RAISE EXCEPTION 'Este ajuste já foi conciliado.'; END IF;

  v_fino := COALESCE(p_quantidade_nf, v_qtd) - v_qtd;

  IF v_fino <> 0 THEN
    UPDATE public.insumos SET saldo_estoque = saldo_estoque + v_fino, updated_at = now()
      WHERE id = v_insumo RETURNING saldo_estoque INTO v_saldo;
  ELSE
    SELECT saldo_estoque INTO v_saldo FROM public.insumos WHERE id = v_insumo;
  END IF;

  UPDATE public.ajustes_estoque
    SET status = 'Conciliado', quantidade_nf = p_quantidade_nf,
        nf_referencia = NULLIF(p_nf_referencia, ''), ajuste_fino = v_fino,
        saldo_apos = v_saldo, conciliado_by = auth.uid(), conciliado_at = now()
    WHERE id = p_ajuste_id;
  RETURN v_saldo;
END;
$function$;