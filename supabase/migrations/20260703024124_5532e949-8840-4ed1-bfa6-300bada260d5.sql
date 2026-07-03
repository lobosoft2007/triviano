
-- 1) Campo saldo_devedor_atual na conta-corrente (modelo corporativo)
ALTER TABLE public.clientes_fiado
  ADD COLUMN IF NOT EXISTS saldo_devedor_atual numeric NOT NULL DEFAULT 0;

-- Backfill a partir da fonte de verdade (profiles)
UPDATE public.clientes_fiado cf
  SET saldo_devedor_atual = COALESCE(p.saldo_devedor_fiado, 0)
  FROM public.profiles p
  WHERE p.id = cf.user_id;

-- 2) Disparador seguro de push de fiado (débito/crédito)
CREATE OR REPLACE FUNCTION public.notify_fiado(p_user uuid, p_valor numeric, p_tipo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_saldo numeric; v_limite numeric; v_disp numeric; v_emp uuid;
  v_brand text; v_titulo text; v_msg text;
  v_fv text; v_fs text; v_fl text; v_fd text;
BEGIN
  SELECT saldo_devedor_fiado, limite_fiado, empresa_id
    INTO v_saldo, v_limite, v_emp
    FROM public.profiles WHERE id = p_user;
  IF v_saldo IS NULL THEN RETURN; END IF;

  SELECT COALESCE(NULLIF(nome_fantasia, ''), 'Estabelecimento')
    INTO v_brand FROM public.empresas WHERE id = v_emp;
  v_brand := COALESCE(v_brand, 'Estabelecimento');

  v_disp := GREATEST(0, COALESCE(v_limite, 0) - COALESCE(v_saldo, 0));
  v_fv := 'R$ ' || replace(to_char(round(COALESCE(p_valor,0), 2), 'FM999999990.00'), '.', ',');
  v_fs := 'R$ ' || replace(to_char(round(COALESCE(v_saldo,0), 2), 'FM999999990.00'), '.', ',');
  v_fl := 'R$ ' || replace(to_char(round(COALESCE(v_limite,0), 2), 'FM999999990.00'), '.', ',');
  v_fd := 'R$ ' || replace(to_char(round(v_disp, 2), 'FM999999990.00'), '.', ',');

  IF p_tipo = 'debito_compra' THEN
    v_titulo := 'Compra no fiado registrada';
    v_msg := v_brand || ': compra de ' || v_fv || ' no fiado. Saldo devedor: '
      || v_fs || ' de ' || v_fl || ' (crédito disponível ' || v_fd || ').';
  ELSE
    v_titulo := 'Pagamento confirmado — obrigado!';
    v_msg := v_brand || ': recebemos seu pagamento de ' || v_fv
      || '. Muito obrigado! Saldo devedor atual: ' || v_fs
      || '. Crédito disponível: ' || v_fd || '.';
  END IF;

  INSERT INTO public.notificacoes_cliente (id_pedido, id_usuario, titulo, mensagem)
  VALUES (NULL, p_user, v_titulo, v_msg);
EXCEPTION WHEN OTHERS THEN
  -- Nunca deixar a notificação reverter a transação financeira
  RAISE WARNING 'notify_fiado falhou: %', SQLERRM;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_fiado(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- 3) set_fiado_config: sincroniza saldo_devedor_atual no upsert
CREATE OR REPLACE FUNCTION public.set_fiado_config(p_user_id uuid, p_autorizado boolean, p_limite numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_saldo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.profiles
    SET fiado_autorizado = p_autorizado, limite_fiado = GREATEST(0, p_limite)
    WHERE id = p_user_id;

  SELECT empresa_id, saldo_devedor_fiado INTO v_empresa, v_saldo
    FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.clientes_fiado (user_id, empresa_id, limite_credito, autorizado_fiado, ativo, saldo_devedor_atual)
  VALUES (p_user_id, COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023'),
          GREATEST(0, p_limite), p_autorizado, true, COALESCE(v_saldo, 0))
  ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET limite_credito = EXCLUDED.limite_credito,
        autorizado_fiado = EXCLUDED.autorizado_fiado,
        saldo_devedor_atual = COALESCE(v_saldo, 0),
        updated_at = now();
END;
$function$;

-- 4) pay_fiado: sincroniza conta-corrente + dispara push de crédito
CREATE OR REPLACE FUNCTION public.pay_fiado(p_user_id uuid, p_valor numeric, p_id_meio uuid, p_descricao text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caixa uuid;
  v_pay numeric;
  v_meio_nome text;
  v_empresa uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_pay := GREATEST(0, p_valor);
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET saldo_devedor_fiado = GREATEST(0, saldo_devedor_fiado - v_pay)
    WHERE id = p_user_id;
  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
  VALUES (p_user_id, NULL, 'Credito_Pagamento', v_pay,
    (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id), v_empresa);

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;
  SELECT nome INTO v_meio_nome FROM public.meios_pagamento WHERE id = p_id_meio;

  INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, saldo_devedor_momento)
  VALUES (p_user_id, v_empresa, 'Credito', v_pay,
    COALESCE(NULLIF(p_descricao,''), 'Pagamento') || COALESCE(' (' || v_meio_nome || ')',''),
    (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id));

  IF v_caixa IS NOT NULL AND p_id_meio IS NOT NULL THEN
    INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
    VALUES (v_caixa, 'Recebimento Pedido', v_pay,
      COALESCE(NULLIF(p_descricao,''), 'Quitação de fiado') || ' (' || COALESCE(v_meio_nome,'') || ')', p_id_meio);
  END IF;

  -- Sincroniza a conta-corrente corporativa e dispara push de crédito
  UPDATE public.clientes_fiado
    SET saldo_devedor_atual = (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id),
        updated_at = now()
    WHERE user_id = p_user_id;
  PERFORM public.notify_fiado(p_user_id, v_pay, 'credito_pagamento');

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id);
END;
$function$;

-- 5) finalize_order_paid: sincroniza conta-corrente + dispara push de débito no fiado
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
  v_conta RECORD;
  v_liquido numeric;
  v_empresa uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT user_id, total, status_pedido INTO v_user, v_total, v_status
  FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Encerrado e pago' THEN RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user); END IF;

  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;

  FOR v_pag IN
    SELECT pp.valor_pago, pp.id_meio_pagamento, mp.nome
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = p_order_id
  LOOP
    IF v_caixa IS NOT NULL AND v_pag.id_meio_pagamento IS NOT NULL THEN
      INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
      VALUES (v_caixa, 'Recebimento Pedido', v_pag.valor_pago,
        'Pedido ' || substr(p_order_id::text,1,6) || ' (' || v_pag.nome || ')', v_pag.id_meio_pagamento);
    END IF;

    SELECT * INTO v_conta FROM public.contas_financeiras
      WHERE id_meio_pagamento = v_pag.id_meio_pagamento AND ativo = true
      ORDER BY updated_at DESC LIMIT 1;
    IF v_conta.id IS NOT NULL THEN
      v_liquido := round(v_pag.valor_pago * (1 - COALESCE(v_conta.taxa_percentual,0) / 100.0), 2);
      INSERT INTO public.lancamentos_tesouraria
        (id_conta_financeira, tipo, valor, categoria_fluxo, descricao, id_pedido, data_competencia, data_liquidacao)
      VALUES (v_conta.id, 'Entrada', v_liquido, 'Venda',
        'Recebível cartão - Pedido ' || substr(p_order_id::text,1,6) ||
        ' (taxa ' || COALESCE(v_conta.taxa_percentual,0) || '%)',
        p_order_id, now(), now() + (COALESCE(v_conta.dias_liquidacao,0) || ' days')::interval);
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
      INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
      VALUES (v_user, p_order_id, 'Debito_Compra', v_pag.valor_pago,
        (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user), v_empresa);
      INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, id_pedido, saldo_devedor_momento)
      VALUES (v_user, v_empresa, 'Debito', v_pag.valor_pago,
        'Compra no fiado - Pedido ' || substr(p_order_id::text,1,6),
        p_order_id, (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user));

      -- Sincroniza conta-corrente corporativa e dispara push de débito
      UPDATE public.clientes_fiado
        SET saldo_devedor_atual = (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user),
            updated_at = now()
        WHERE user_id = v_user;
      PERFORM public.notify_fiado(v_user, v_pag.valor_pago, 'debito_compra');
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa', v_empresa);
    END IF;
  END LOOP;

  v_cashback := round(COALESCE(v_total,0) * 0.05, 2);
  IF v_cashback > 0 THEN
    UPDATE public.profiles SET saldo_cashback = saldo_cashback + v_cashback WHERE id = v_user;
    INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
    VALUES (v_user, p_order_id, 'Credito', v_cashback, 'Cashback de 5% sobre a compra', v_empresa);
  END IF;

  PERFORM public.explode_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- 6) Travas de privilégio: sem execução pública/anônima; apenas admin autenticado
REVOKE EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_order_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_paid(uuid) TO authenticated;
