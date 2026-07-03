-- =========================================================
-- Motor de Cashback Dinâmico Whitelabel (multi-tenant)
-- =========================================================

-- 1) Percentual de cashback configurável por empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS percentual_cashback numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cashback_ativo boolean NOT NULL DEFAULT true;

-- 2) Enum de auditoria estrita
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cashback_mov_tipo') THEN
    CREATE TYPE public.cashback_mov_tipo AS ENUM
      ('credito_ganho', 'debito_uso', 'debito_abatimento_fiado');
  END IF;
END$$;

-- 3) Conta de cashback (saldo)
CREATE TABLE IF NOT EXISTS public.clientes_cashback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023',
  cliente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  saldo_acumulado numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, empresa_id)
);

GRANT SELECT ON public.clientes_cashback TO authenticated;
GRANT ALL ON public.clientes_cashback TO service_role;

ALTER TABLE public.clientes_cashback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente lê o próprio cashback"
  ON public.clientes_cashback FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) Extrato de cashback (auditoria estrita)
CREATE TABLE IF NOT EXISTS public.extrato_cashback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023',
  cliente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pedido_id uuid,
  tipo_movimentacao public.cashback_mov_tipo NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  saldo_residual numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.extrato_cashback TO authenticated;
GRANT ALL ON public.extrato_cashback TO service_role;

ALTER TABLE public.extrato_cashback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente lê o próprio extrato de cashback"
  ON public.extrato_cashback FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_extrato_cashback_cliente
  ON public.extrato_cashback (cliente_id, created_at DESC);

-- updated_at automático
DROP TRIGGER IF EXISTS trg_clientes_cashback_updated ON public.clientes_cashback;
CREATE TRIGGER trg_clientes_cashback_updated
  BEFORE UPDATE ON public.clientes_cashback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5) Sincronização: profiles.saldo_cashback -> clientes_cashback
--    (mantém a fonte numérica existente do app em sincronia com
--     a nova conta dedicada, sem divergências)
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_clientes_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clientes_cashback (cliente_id, empresa_id, saldo_acumulado)
  VALUES (
    NEW.id,
    COALESCE(NEW.empresa_id, '00000000-0000-0000-0000-000000000023'),
    COALESCE(NEW.saldo_cashback, 0)
  )
  ON CONFLICT (cliente_id, empresa_id) DO UPDATE
    SET saldo_acumulado = EXCLUDED.saldo_acumulado,
        updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_clientes_cashback() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_clientes_cashback ON public.profiles;
CREATE TRIGGER trg_sync_clientes_cashback
  AFTER INSERT OR UPDATE OF saldo_cashback, empresa_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_clientes_cashback();

-- Seed inicial a partir dos saldos existentes
INSERT INTO public.clientes_cashback (cliente_id, empresa_id, saldo_acumulado)
SELECT p.id, COALESCE(p.empresa_id, '00000000-0000-0000-0000-000000000023'),
       COALESCE(p.saldo_cashback, 0)
FROM public.profiles p
ON CONFLICT (cliente_id, empresa_id) DO UPDATE
  SET saldo_acumulado = EXCLUDED.saldo_acumulado, updated_at = now();

-- =========================================================
-- 6) Notificação (Web Push) de mutações de cashback
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_cashback(
  p_user uuid,
  p_valor numeric,
  p_tipo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.notify_cashback(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 7) REGRA DE GANHO + TRAVA DE BLOQUEIO DUPLO (Fiado)
--    Trigger disparado quando o pedido é concluído/pago.
-- =========================================================
CREATE OR REPLACE FUNCTION public.award_order_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid; v_emp uuid; v_pct numeric; v_ativo boolean;
  v_cashback numeric; v_has_fiado boolean; v_novo_saldo numeric;
BEGIN
  IF NEW.status_pedido <> 'Encerrado e pago'
     OR OLD.status_pedido IS NOT DISTINCT FROM NEW.status_pedido THEN
    RETURN NEW;
  END IF;

  -- Idempotência: nunca creditar duas vezes o mesmo pedido
  IF EXISTS (
    SELECT 1 FROM public.extrato_cashback
    WHERE pedido_id = NEW.id AND tipo_movimentacao = 'credito_ganho'
  ) THEN
    RETURN NEW;
  END IF;

  v_user := NEW.user_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  -- TRAVA DE BLOQUEIO DUPLO: pedidos pagos no Fiado não geram cashback
  SELECT EXISTS (
    SELECT 1
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = NEW.id AND mp.nome = 'Fiado'
  ) INTO v_has_fiado;
  IF v_has_fiado THEN RETURN NEW; END IF;

  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = v_user;
  SELECT percentual_cashback, cashback_ativo INTO v_pct, v_ativo
    FROM public.empresas WHERE id = v_emp;
  IF NOT COALESCE(v_ativo, true) THEN RETURN NEW; END IF;

  v_cashback := round(COALESCE(NEW.total, 0) * COALESCE(v_pct, 0) / 100.0, 2);
  IF v_cashback <= 0 THEN RETURN NEW; END IF;

  UPDATE public.profiles
    SET saldo_cashback = saldo_cashback + v_cashback
    WHERE id = v_user
    RETURNING saldo_cashback INTO v_novo_saldo;

  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (v_user, NEW.id, 'Credito', v_cashback,
    'Cashback de ' || COALESCE(v_pct,0) || '% sobre a compra', v_emp);

  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    v_user, NEW.id, 'credito_ganho', v_cashback, v_novo_saldo);

  PERFORM public.notify_cashback(v_user, v_cashback, 'credito_ganho');

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_order_cashback() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_order_cashback ON public.orders;
CREATE TRIGGER trg_award_order_cashback
  AFTER UPDATE OF status_pedido ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_order_cashback();

-- =========================================================
-- 8) finalize_order_paid: remove o crédito fixo de 5% (agora
--    feito pelo trigger, com % da empresa e bloqueio de fiado)
--    e registra o uso de cashback no extrato dedicado.
-- =========================================================
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
  v_conta RECORD;
  v_liquido numeric;
  v_empresa uuid;
  v_novo_cash numeric;
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

      UPDATE public.clientes_fiado
        SET saldo_devedor_atual = (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user),
            updated_at = now()
        WHERE user_id = v_user;
      PERFORM public.notify_fiado(v_user, v_pag.valor_pago, 'debito_compra');
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user
        RETURNING saldo_cashback INTO v_novo_cash;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa', v_empresa);
      INSERT INTO public.extrato_cashback
        (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
      VALUES (COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023'),
        v_user, p_order_id, 'debito_uso', v_pag.valor_pago, COALESCE(v_novo_cash, 0));
    END IF;
  END LOOP;

  PERFORM public.explode_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- =========================================================
-- 9) redeem_cashback_for_order: registra uso no extrato dedicado
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_cashback_for_order(p_order_id uuid, p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_saldo numeric;
  v_use numeric;
  v_novo numeric;
  v_emp uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RAISE EXCEPTION 'Pedido inválido para este usuário.';
  END IF;
  SELECT saldo_cashback, empresa_id INTO v_saldo, v_emp FROM public.profiles WHERE id = v_user;
  v_use := LEAST(GREATEST(p_amount, 0), v_saldo);
  IF v_use <= 0 THEN RETURN 0; END IF;
  UPDATE public.profiles SET saldo_cashback = saldo_cashback - v_use WHERE id = v_user
    RETURNING saldo_cashback INTO v_novo;
  UPDATE public.orders SET cashback_usado = cashback_usado + v_use WHERE id = p_order_id;
  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (v_user, p_order_id, 'Debito', v_use, 'Resgate de cashback no pedido', v_emp);
  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    v_user, p_order_id, 'debito_uso', v_use, COALESCE(v_novo, 0));
  RETURN v_use;
END;
$function$;

-- =========================================================
-- 10) MECANISMO DE ABATIMENTO CRUZADO (cashback -> fiado)
--     Transação atômica: debita cashback, abate dívida,
--     registra nos dois extratos, restabelece limite e notifica.
-- =========================================================
CREATE OR REPLACE FUNCTION public.abater_fiado_com_cashback(
  p_user_id uuid,
  p_valor numeric DEFAULT NULL
)
RETURNS TABLE(saldo_cashback numeric, saldo_devedor numeric, abatido numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash numeric; v_debt numeric; v_emp uuid; v_use numeric;
  v_novo_cash numeric; v_novo_debt numeric;
BEGIN
  -- Autorização: o próprio cliente ou um gestor (admin)
  IF p_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT saldo_cashback, saldo_devedor_fiado, empresa_id
    INTO v_cash, v_debt, v_emp
    FROM public.profiles WHERE id = p_user_id
    FOR UPDATE;
  IF v_cash IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  -- Usa o menor entre: valor pedido (ou tudo), saldo de cashback, dívida atual
  v_use := LEAST(
    COALESCE(NULLIF(p_valor, 0), v_cash),
    v_cash,
    v_debt
  );
  v_use := round(GREATEST(v_use, 0), 2);
  IF v_use <= 0 THEN
    RAISE EXCEPTION 'Nada a abater: verifique o saldo de cashback e a dívida de fiado.';
  END IF;

  UPDATE public.profiles
    SET saldo_cashback = saldo_cashback - v_use,
        saldo_devedor_fiado = GREATEST(0, saldo_devedor_fiado - v_use)
    WHERE id = p_user_id
    RETURNING saldo_cashback, saldo_devedor_fiado INTO v_novo_cash, v_novo_debt;

  -- Extrato de cashback (débito por abatimento de fiado)
  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    p_user_id, NULL, 'debito_abatimento_fiado', v_use, v_novo_cash);

  -- Histórico de cashback (compatibilidade com o app atual)
  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (p_user_id, NULL, 'Debito', v_use,
    'Abatimento de fiado com cashback', v_emp);

  -- Extrato de fiado (crédito de pagamento)
  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
  VALUES (p_user_id, NULL, 'Credito_Pagamento', v_use, v_novo_debt, v_emp);

  -- Conta corrente (crédito)
  INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, id_pedido, saldo_devedor_momento)
  VALUES (p_user_id, v_emp, 'Credito', v_use,
    'Abatimento com cashback', NULL, v_novo_debt);

  -- Sincroniza a conta-corrente corporativa (limite restabelecido)
  UPDATE public.clientes_fiado
    SET saldo_devedor_atual = v_novo_debt, updated_at = now()
    WHERE user_id = p_user_id;

  -- Push com branding dinâmico
  PERFORM public.notify_cashback(p_user_id, v_use, 'debito_abatimento_fiado');

  RETURN QUERY SELECT v_novo_cash, v_novo_debt, v_use;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.abater_fiado_com_cashback(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abater_fiado_com_cashback(uuid, numeric) TO authenticated;