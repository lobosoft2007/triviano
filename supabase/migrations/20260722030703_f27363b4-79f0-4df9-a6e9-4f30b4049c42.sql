
-- Tabela para rastrear cobranças PIX de quitação de fiado via Mercado Pago
CREATE TABLE public.mp_fiado_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  mp_order_id TEXT,
  mp_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_mp_fiado_charges_user ON public.mp_fiado_charges(user_id);
CREATE INDEX idx_mp_fiado_charges_mp_order ON public.mp_fiado_charges(mp_order_id);
CREATE INDEX idx_mp_fiado_charges_mp_payment ON public.mp_fiado_charges(mp_payment_id);

GRANT SELECT ON public.mp_fiado_charges TO authenticated;
GRANT ALL ON public.mp_fiado_charges TO service_role;

ALTER TABLE public.mp_fiado_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own fiado charges"
  ON public.mp_fiado_charges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service role manages fiado charges"
  ON public.mp_fiado_charges FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_mp_fiado_charges_updated_at
  BEFORE UPDATE ON public.mp_fiado_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wrapper SECURITY DEFINER: chamado apenas pelo mp-webhook (service_role).
-- Encapsula pay_fiado garantindo idempotência via mp_fiado_charges.
CREATE OR REPLACE FUNCTION public.pay_fiado_from_mp(
  p_charge_id UUID,
  p_mp_payment_id TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge public.mp_fiado_charges%ROWTYPE;
  v_meio_id UUID;
  v_saldo NUMERIC;
BEGIN
  SELECT * INTO v_charge FROM public.mp_fiado_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;

  -- Idempotência
  IF v_charge.status = 'paid' THEN
    RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_charge.user_id);
  END IF;

  -- Localiza (ou cria) meio de pagamento PIX da empresa
  SELECT id INTO v_meio_id
    FROM public.meios_pagamento
   WHERE empresa_id = v_charge.empresa_id
     AND ativo = true
     AND nome ILIKE 'PIX%'
   ORDER BY is_sistema DESC NULLS LAST, created_at ASC
   LIMIT 1;

  IF v_meio_id IS NULL THEN
    INSERT INTO public.meios_pagamento(empresa_id, nome, ativo, is_sistema)
    VALUES (v_charge.empresa_id, 'PIX', true, true)
    RETURNING id INTO v_meio_id;
  END IF;

  -- Quitação real via pay_fiado existente (motor financeiro auditado)
  v_saldo := public.pay_fiado(
    v_charge.user_id,
    v_charge.valor,
    v_meio_id,
    'Quitação PIX Mercado Pago (mp_payment_id=' || COALESCE(p_mp_payment_id, '') || ')'
  );

  UPDATE public.mp_fiado_charges
     SET status = 'paid',
         paid_at = now(),
         mp_payment_id = COALESCE(p_mp_payment_id, mp_payment_id)
   WHERE id = p_charge_id;

  RETURN v_saldo;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_fiado_from_mp(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_fiado_from_mp(UUID, TEXT) TO service_role;

-- RPC de status para polling do frontend
CREATE OR REPLACE FUNCTION public.get_mp_fiado_status(p_charge_id UUID)
RETURNS TABLE(status TEXT, valor NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.status, c.valor
    FROM public.mp_fiado_charges c
   WHERE c.id = p_charge_id
     AND c.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_mp_fiado_status(UUID) TO authenticated;
