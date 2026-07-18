
-- Tap PIX charges
CREATE TABLE IF NOT EXISTS public.tap_pix_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  pos_device_id UUID REFERENCES public.pos_devices(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago','pagbank')),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('prod','sandbox')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  descricao TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','canceled','error')),
  qr_code TEXT,
  qr_code_base64 TEXT,
  copia_e_cola TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tap_pix_empresa ON public.tap_pix_charges(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tap_pix_external ON public.tap_pix_charges(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_tap_pix_order ON public.tap_pix_charges(order_id);

GRANT SELECT ON public.tap_pix_charges TO authenticated;
GRANT ALL ON public.tap_pix_charges TO service_role;

ALTER TABLE public.tap_pix_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tap_pix_charges tenant admin read"
  ON public.tap_pix_charges FOR SELECT TO authenticated
  USING (public.can_manage_empresa(empresa_id));

CREATE TRIGGER trg_tap_pix_charges_updated_at
  BEFORE UPDATE ON public.tap_pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Verify POS device credentials (server-side use only)
CREATE OR REPLACE FUNCTION public.verify_pos_device(p_device UUID, p_token TEXT)
RETURNS TABLE(empresa_id UUID, flavor TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev public.pos_devices%ROWTYPE;
BEGIN
  SELECT * INTO v_dev FROM public.pos_devices WHERE id = p_device;
  IF NOT FOUND OR v_dev.revogado_em IS NOT NULL THEN
    RETURN;
  END IF;
  IF v_dev.token_hash <> crypt(p_token, v_dev.token_hash) THEN
    RETURN;
  END IF;
  UPDATE public.pos_devices SET last_seen_at = now() WHERE id = v_dev.id;
  RETURN QUERY SELECT v_dev.empresa_id, v_dev.flavor;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_pos_device(UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pos_device(UUID,TEXT) TO service_role;

-- Record a paid PIX from webhook (server-side use only)
CREATE OR REPLACE FUNCTION public.record_tap_pix_paid(
  p_charge_id UUID,
  p_external_id TEXT,
  p_valor NUMERIC,
  p_raw JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge public.tap_pix_charges%ROWTYPE;
  v_meio UUID;
BEGIN
  SELECT * INTO v_charge FROM public.tap_pix_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'charge not found'; END IF;
  IF v_charge.status = 'paid' THEN RETURN; END IF;

  UPDATE public.tap_pix_charges
     SET status = 'paid',
         paid_at = now(),
         external_id = COALESCE(external_id, p_external_id),
         raw_response = COALESCE(p_raw, raw_response)
   WHERE id = p_charge_id;

  IF v_charge.order_id IS NOT NULL THEN
    SELECT id INTO v_meio
      FROM public.meios_pagamento
     WHERE empresa_id = v_charge.empresa_id
       AND ativo = TRUE
       AND (codigo = 'pix' OR lower(nome) LIKE 'pix%')
     ORDER BY created_at
     LIMIT 1;

    IF v_meio IS NOT NULL THEN
      INSERT INTO public.pagamentos_pedido (id_pedido, id_meio_pagamento, valor_pago)
      VALUES (v_charge.order_id, v_meio, p_valor);
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tap_pix_paid(UUID,TEXT,NUMERIC,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_tap_pix_paid(UUID,TEXT,NUMERIC,JSONB) TO service_role;
