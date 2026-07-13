-- ============================================================
-- Cashback Dinâmico por Meio de Pagamento — v1.4.0
-- ============================================================

-- 1a. Percentual de cashback por meio de pagamento (isolado por empresa via RLS já existente)
ALTER TABLE public.meios_pagamento
  ADD COLUMN IF NOT EXISTS percentual_cashback numeric NOT NULL DEFAULT 0;

-- 1b. Novo tipo de movimentação para créditos manuais do admin
ALTER TYPE public.cashback_mov_tipo ADD VALUE IF NOT EXISTS 'ajuste_admin';

-- 1c. Motivo/descrição do lançamento de cashback (usado nos ajustes manuais)
ALTER TABLE public.extrato_cashback
  ADD COLUMN IF NOT EXISTS descricao text;

-- ------------------------------------------------------------
-- 2. notify_cashback: mensagem correta para crédito manual (ajuste_admin)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_cashback(p_user uuid, p_valor numeric, p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo numeric; v_devedor numeric; v_emp uuid; v_brand text;
  v_titulo text; v_msg text; v_fv text; v_fs text; v_fd text;
BEGIN
  SELECT saldo_cashback, saldo_devedor_fiado, empresa_id
    INTO v_saldo, v_devedor, v_emp
    FROM public.profiles WHERE id = p_user;
  IF v_saldo IS NULL THEN RETURN; END IF;

  SELECT COALESCE(NULLIF(nome_fantasia, ''), 'Estabelecimento')
    INTO v_brand FROM public.empresas WHERE id = v_emp;
  v_brand := COALESCE(v_brand, 'Estabelecimento');

  v_fv := 'R$ ' || replace(to_char(round(COALESCE(p_valor,0), 2), 'FM999999990.00'), '.', ',');
  v_fs := 'R$ ' || replace(to_char(round(COALESCE(v_saldo,0), 2), 'FM999999990.00'), '.', ',');
  v_fd := 'R$ ' || replace(to_char(round(COALESCE(v_devedor,0), 2), 'FM999999990.00'), '.', ',');

  IF p_tipo = 'credito_ganho' THEN
    v_titulo := 'Você ganhou cashback! 🎉';
    v_msg := v_brand || ': você ganhou ' || v_fv
      || ' de cashback! Seu saldo atualizado é ' || v_fs || '.';
  ELSIF p_tipo = 'ajuste_admin' THEN
    v_titulo := 'Crédito de cashback recebido! 🎁';
    v_msg := v_brand || ': um crédito de ' || v_fv
      || ' foi adicionado ao seu cashback. Seu saldo atualizado é ' || v_fs || '.';
  ELSE
    v_titulo := 'Cashback usado para abater seu fiado';
    v_msg := v_brand || ': seu saldo de cashback de ' || v_fv
      || ' foi utilizado para abater sua conta pendente! Seu saldo devedor atual caiu para '
      || v_fd || ' e seu limite foi restabelecido.';
  END IF;

  INSERT INTO public.notificacoes_cliente (id_pedido, id_usuario, titulo, mensagem)
  VALUES (NULL, p_user, v_titulo, v_msg);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_cashback falhou: %', SQLERRM;
END;
$function$;

-- ------------------------------------------------------------
-- 3. Motor de cálculo: cashback por meio de pagamento
--    cashback = Σ round(valor_pago_i * pct_meio_i / 100, 2)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_order_cashback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid; v_emp uuid; v_ativo boolean;
  v_cashback numeric; v_has_fiado boolean; v_novo_saldo numeric;
BEGIN
  IF NEW.status_pedido <> 'Finalizado'
     OR OLD.status_pedido IS NOT DISTINCT FROM NEW.status_pedido THEN
    RETURN NEW;
  END IF;

  -- Idempotência: nunca credita duas vezes o mesmo pedido.
  IF EXISTS (
    SELECT 1 FROM public.extrato_cashback
    WHERE pedido_id = NEW.id AND tipo_movimentacao = 'credito_ganho'
  ) THEN
    RETURN NEW;
  END IF;

  v_user := NEW.user_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  -- Pedidos que envolvem Fiado não geram cashback (regra preservada).
  SELECT EXISTS (
    SELECT 1
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = NEW.id AND mp.nome = 'Fiado'
  ) INTO v_has_fiado;
  IF v_has_fiado THEN RETURN NEW; END IF;

  -- Kill-switch da empresa (isolamento multi-tenant pelo dono do pedido).
  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = v_user;
  SELECT cashback_ativo INTO v_ativo FROM public.empresas WHERE id = v_emp;
  IF NOT COALESCE(v_ativo, true) THEN RETURN NEW; END IF;

  -- NOVA LÓGICA: soma linha a linha o cashback de cada meio de pagamento,
  -- sobre o valor líquido efetivamente pago pelo cliente em cada meio.
  SELECT COALESCE(
    SUM(round(pp.valor_pago * COALESCE(mp.percentual_cashback, 0) / 100.0, 2)),
    0)
  INTO v_cashback
  FROM public.pagamentos_pedido pp
  JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
  WHERE pp.id_pedido = NEW.id;

  IF v_cashback <= 0 THEN RETURN NEW; END IF;

  UPDATE public.profiles
    SET saldo_cashback = saldo_cashback + v_cashback
    WHERE id = v_user
    RETURNING saldo_cashback INTO v_novo_saldo;

  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (v_user, NEW.id, 'Credito', v_cashback,
    'Cashback por meio de pagamento', v_emp);

  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual, descricao)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    v_user, NEW.id, 'credito_ganho', v_cashback, v_novo_saldo,
    'Cashback por meio de pagamento');

  PERFORM public.notify_cashback(v_user, v_cashback, 'credito_ganho');

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 4. Crédito manual de cashback pelo admin/gestor (is_admin_local+)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_credit_cashback(
  p_cliente_id uuid,
  p_valor numeric,
  p_motivo text
)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid; v_novo numeric; v_val numeric;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = p_cliente_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  -- Autorização estrita: só gestor/admin da empresa do cliente (ou super_admin).
  IF NOT public.can_manage_empresa(v_emp) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_val := round(COALESCE(p_valor, 0), 2);
  IF v_val <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo para o crédito.';
  END IF;

  UPDATE public.profiles
    SET saldo_cashback = saldo_cashback + v_val
    WHERE id = p_cliente_id
    RETURNING saldo_cashback INTO v_novo;

  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (p_cliente_id, NULL, 'Credito', v_val,
    COALESCE(NULLIF(p_motivo, ''), 'Crédito manual'), v_emp);

  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual, descricao)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    p_cliente_id, NULL, 'ajuste_admin', v_val, COALESCE(v_novo, 0),
    COALESCE(NULLIF(p_motivo, ''), 'Crédito manual'));

  PERFORM public.notify_cashback(p_cliente_id, v_val, 'ajuste_admin');

  RETURN v_novo;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_credit_cashback(uuid, numeric, text) TO authenticated;