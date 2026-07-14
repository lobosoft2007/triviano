
-- ============================================================
-- v1.7.0 — Liquidação Unificada da Comanda
-- ============================================================

-- 1) Referências de pagamento online na comanda -------------
ALTER TABLE public.comanda_ativa
  ADD COLUMN IF NOT EXISTS mp_order_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_status text,
  ADD COLUMN IF NOT EXISTS pago_online boolean NOT NULL DEFAULT false;

-- 2) Helper financeiro ÚNICO (sem checagem de papel) --------
-- Regra de ouro compartilhada por finalize_order_paid (Delivery)
-- e _settle_comanda (Mesa). A autorização é feita pelos chamadores.
CREATE OR REPLACE FUNCTION public._finalize_order_financials(p_order_id uuid)
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
  SELECT user_id, total, status_pedido INTO v_user, v_total, v_status
  FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Finalizado' THEN RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user); END IF;

  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;

  -- Caixa aberto da EMPRESA dona do pedido (funciona também sob service_role,
  -- onde current_empresa_id() é nulo — ex.: baixa disparada pelo webhook).
  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto'
      AND public.user_empresa_id(id_usuario) = v_empresa
    ORDER BY data_hora_abertura DESC LIMIT 1;

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
    SET status_pedido = 'Finalizado', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- Só o motor (definer) e o service_role executam o helper diretamente.
REVOKE ALL ON FUNCTION public._finalize_order_financials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._finalize_order_financials(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._finalize_order_financials(uuid) TO service_role;

-- 3) finalize_order_paid vira um wrapper fino (Delivery) ----
CREATE OR REPLACE FUNCTION public.finalize_order_paid(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN public._finalize_order_financials(p_order_id);
END;
$function$;

-- 4) Liquidação da comanda inteira (interno, sob service_role) --
CREATE OR REPLACE FUNCTION public._settle_comanda(
  p_comanda_id uuid,
  p_meio_id uuid,
  p_online boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_com RECORD;
  v_order RECORD;
  v_meio uuid := p_meio_id;
BEGIN
  SELECT * INTO v_com FROM public.comanda_ativa WHERE id = p_comanda_id;
  IF v_com.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_com.status = 'fechada' THEN RETURN; END IF; -- idempotente

  -- Sem meio informado (baixa online pelo webhook): usa o PIX da empresa.
  IF v_meio IS NULL AND p_online THEN
    SELECT id INTO v_meio FROM public.meios_pagamento
      WHERE empresa_id = v_com.empresa_id
        AND lower(trim(nome)) = 'pix'
        AND ativo = true
      ORDER BY updated_at DESC LIMIT 1;
  END IF;

  FOR v_order IN
    SELECT id, total FROM public.orders
    WHERE comanda_id = p_comanda_id AND status_pedido <> 'Finalizado'
  LOOP
    -- Registra o pagamento do pedido (soma = total_parcial da comanda),
    -- somente se ainda não houver pagamento lançado para ele.
    IF v_meio IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.pagamentos_pedido WHERE id_pedido = v_order.id) THEN
      INSERT INTO public.pagamentos_pedido (id_pedido, id_meio_pagamento, valor_pago)
      VALUES (v_order.id, v_meio, v_order.total);
    END IF;

    IF p_online THEN
      UPDATE public.orders
        SET pago_online = true, aguardando_pagamento = false
        WHERE id = v_order.id;
    END IF;

    PERFORM public._finalize_order_financials(v_order.id);
  END LOOP;

  UPDATE public.comanda_ativa
    SET status = 'fechada',
        pago_online = (p_online OR pago_online),
        fechada_em = now()
    WHERE id = p_comanda_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._settle_comanda(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._settle_comanda(uuid, uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._settle_comanda(uuid, uuid, boolean) TO service_role;

-- 5) RPC pública do Caixa: "Finalizar e Receber" (um clique) --
CREATE OR REPLACE FUNCTION public.finalize_comanda_paid(
  p_comanda_id uuid,
  p_meio_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.comanda_ativa WHERE id = p_comanda_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  PERFORM public._settle_comanda(p_comanda_id, p_meio_id, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_comanda_paid(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_comanda_paid(uuid, uuid) TO authenticated, service_role;

-- 6) Leitura da situação de pagamento da comanda -------------
CREATE OR REPLACE FUNCTION public.mp_get_comanda_status(p_comanda_id uuid)
RETURNS TABLE (
  pago_online boolean,
  mp_status text,
  total_parcial numeric,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.pago_online, c.mp_status, c.total_parcial, c.status::text
  FROM public.comanda_ativa c
  WHERE c.id = p_comanda_id
    AND (c.user_id = auth.uid() OR public.can_manage_empresa(c.empresa_id));
END;
$function$;

REVOKE ALL ON FUNCTION public.mp_get_comanda_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mp_get_comanda_status(uuid) TO authenticated, service_role;
