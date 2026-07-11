-- ============================================================
-- BI de desistência: arquivar rascunhos não pagos em vez de excluir
-- ------------------------------------------------------------
-- Novo estado: 'pagamento_abandonado'. A função de limpeza deixa de
-- DELETAR os rascunhos e passa a marcá-los como abandonados, preservando
-- o histórico para métricas futuras de taxa de desistência.
-- O motor de pagamento (PIX/Webhook/Trigger enforce_pix_payment_lock)
-- permanece intacto — só mudamos a limpeza de rascunhos.
-- ============================================================
CREATE OR REPLACE FUNCTION public.discard_unpaid_drafts(p_host text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_count integer := 0;
  r record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.';
  END IF;

  v_empresa := public.resolve_empresa_id_by_host(p_host);
  IF v_empresa IS NULL OR NOT public.is_empresa_ativa(v_empresa) THEN
    SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;
  END IF;
  v_empresa := COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023');

  FOR r IN
    SELECT id, COALESCE(cashback_usado, 0) AS cashback_usado
    FROM public.orders
    WHERE user_id = v_user
      AND empresa_id = v_empresa
      AND aguardando_pagamento = true
      AND COALESCE(pago_online, false) = false
      AND status IN ('pending', 'rascunho_pagamento')
  LOOP
    -- Devolve o cashback reservado ao cliente (o pedido não se concretizou).
    IF r.cashback_usado > 0 THEN
      UPDATE public.profiles
        SET saldo_cashback = saldo_cashback + r.cashback_usado
        WHERE id = v_user;
      DELETE FROM public.extrato_cashback WHERE pedido_id = r.id;
      DELETE FROM public.historico_cashback WHERE id_pedido = r.id;
    END IF;

    -- ARQUIVAMENTO DE ABANDONO: não excluímos mais o pedido. Marcamos como
    -- 'pagamento_abandonado' para medir a taxa de desistência. Continua
    -- invisível para Caixa/KDS (aguardando_pagamento permanece true) e para
    -- o cliente (filtro de status no PWA).
    UPDATE public.orders
      SET status = 'pagamento_abandonado'
      WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;