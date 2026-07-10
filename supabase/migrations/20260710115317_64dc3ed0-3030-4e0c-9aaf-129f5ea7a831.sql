
-- ============================================================
-- Mercado Pago (multi-tenant) — Fase 1: schema
-- ============================================================

-- Credentials per company (config_pagamentos already exists & is admin-only).
ALTER TABLE public.config_pagamentos
  ADD COLUMN IF NOT EXISTS mp_access_token  text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_public_key    text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_webhook_secret text   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_ativo         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mp_ambiente      text    NOT NULL DEFAULT 'test';

-- Online-payment tracking on orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mp_order_id          text,
  ADD COLUMN IF NOT EXISTS mp_payment_id        text,
  ADD COLUMN IF NOT EXISTS mp_status            text,
  ADD COLUMN IF NOT EXISTS pago_online          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aguardando_pagamento boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- Public config: exposes ONLY the public key + ambiente for the
-- tenant that owns the current host. Never returns the secret token.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mp_public_config(p_host text DEFAULT NULL)
RETURNS TABLE(empresa_id uuid, public_key text, ambiente text, ativo boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cp.empresa_id, cp.mp_public_key, cp.mp_ambiente, cp.mp_ativo
  FROM public.config_pagamentos cp
  WHERE cp.empresa_id = COALESCE(
          public.resolve_empresa_id_by_host(p_host),
          public.current_empresa_id(),
          '00000000-0000-0000-0000-000000000023'::uuid)
    AND cp.ativo = true
  ORDER BY cp.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_mp_public_config(text) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Customer polling: the owner of an order can read its online
-- payment status (used while waiting on the PIX/card screen).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mp_get_order_status(p_order_id uuid)
RETURNS TABLE(pago_online boolean, mp_status text, aguardando_pagamento boolean, status_pedido text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL OR (v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Pedido inválido para este usuário.';
  END IF;
  RETURN QUERY
    SELECT o.pago_online, o.mp_status, o.aguardando_pagamento, o.status_pedido
    FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_get_order_status(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Hide orders that are still awaiting online payment from the
-- kitchen pickup panel until the webhook confirms payment.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_painel_retirada(_empresa_id uuid DEFAULT '00000000-0000-0000-0000-000000000023'::uuid)
 RETURNS TABLE(senha text, senha_diaria integer, status_pedido text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT o.senha, o.senha_diaria, o.status_pedido, o.created_at
  FROM public.orders o
  WHERE o.empresa_id = _empresa_id
    AND o.senha IS NOT NULL
    AND o.aguardando_pagamento = false
    AND o.status_pedido IN ('Em preparação', 'Pronto')
    AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY o.status_pedido DESC, o.senha_diaria ASC;
$$;
