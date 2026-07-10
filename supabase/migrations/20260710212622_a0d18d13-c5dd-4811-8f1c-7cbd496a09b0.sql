-- ============================================================
-- TRAVA ATÔMICA DE PAGAMENTO
-- 1) Pedidos nascem BLOQUEADOS por padrão (aguardando_pagamento = true):
--    invisíveis ao Caixa/KDS até liberação explícita.
-- 2) Liberação só por exceção:
--      - pagamento presencial (dinheiro/maquininha na entrega) na criação
--        (create_order já grava aguardando_pagamento = p_pagamento_online);
--      - OU confirmação do webhook do Mercado Pago.
-- 3) Anti-fantasma: descarta rascunhos online não pagos do próprio cliente
--    antes de criar um novo pedido, estornando cashback reservado.
-- ============================================================

-- (1) Nascimento bloqueado por padrão.
ALTER TABLE public.orders ALTER COLUMN aguardando_pagamento SET DEFAULT true;

-- (3) Descarta rascunhos online não pagos (evita pedidos duplicados/fantasma).
CREATE OR REPLACE FUNCTION public.discard_unpaid_drafts(p_host text DEFAULT NULL)
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

  -- Tenant do ambiente atual (mesmo critério do create_order).
  v_empresa := public.resolve_empresa_id_by_host(p_host);
  IF v_empresa IS NULL OR NOT public.is_empresa_ativa(v_empresa) THEN
    SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;
  END IF;
  v_empresa := COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023');

  -- Somente rascunhos ONLINE do próprio cliente ainda NÃO pagos:
  --   aguardando_pagamento = true  (nunca liberado à cozinha)
  --   pago_online = false          (o webhook nunca confirmou)
  -- Pedidos presenciais (aguardando_pagamento = false) e pedidos já pagos
  -- (pago_online = true) JAMAIS são tocados.
  FOR r IN
    SELECT id, COALESCE(cashback_usado, 0) AS cashback_usado
    FROM public.orders
    WHERE user_id = v_user
      AND empresa_id = v_empresa
      AND aguardando_pagamento = true
      AND COALESCE(pago_online, false) = false
      AND status = 'pending'
  LOOP
    -- Estorna cashback que o rascunho tenha reservado (mantém a carteira íntegra).
    IF r.cashback_usado > 0 THEN
      UPDATE public.profiles
        SET saldo_cashback = saldo_cashback + r.cashback_usado
        WHERE id = v_user;
      DELETE FROM public.extrato_cashback WHERE pedido_id = r.id;
      DELETE FROM public.historico_cashback WHERE id_pedido = r.id;
    END IF;

    DELETE FROM public.order_items WHERE order_id = r.id;
    DELETE FROM public.orders WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.discard_unpaid_drafts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discard_unpaid_drafts(text) TO authenticated, service_role;