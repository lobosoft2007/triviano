
-- Tabela de transações de cartão via Tap (para conciliação e reembolso)
CREATE TABLE IF NOT EXISTS public.tap_card_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  pos_device_id UUID,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago','pagbank','cielo','stone','getnet','infinitepay','rede')),
  ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('prod','sandbox')),
  order_id UUID,
  valor NUMERIC(12,2) NOT NULL,
  valor_reembolsado NUMERIC(12,2) NOT NULL DEFAULT 0,
  bandeira TEXT,
  modalidade TEXT, -- credito/debito/voucher
  parcelas INT DEFAULT 1,
  nsu TEXT,
  autorizacao TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','refunded','partially_refunded','canceled','error')),
  paid_at TIMESTAMPTZ DEFAULT now(),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tap_card_empresa_date ON public.tap_card_charges (empresa_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_tap_card_order ON public.tap_card_charges (order_id);
CREATE INDEX IF NOT EXISTS idx_tap_card_external ON public.tap_card_charges (provider, external_id);

GRANT SELECT ON public.tap_card_charges TO authenticated;
GRANT ALL ON public.tap_card_charges TO service_role;

ALTER TABLE public.tap_card_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tap_card_select_own_empresa" ON public.tap_card_charges
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());

CREATE TRIGGER trg_tap_card_updated_at
  BEFORE UPDATE ON public.tap_card_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registrar cobrança de cartão (chamada pelo app após aprovação no SDK)
CREATE OR REPLACE FUNCTION public.record_tap_card_paid(
  _empresa_id UUID,
  _pos_device_id UUID,
  _provider TEXT,
  _ambiente TEXT,
  _order_id UUID,
  _valor NUMERIC,
  _bandeira TEXT,
  _modalidade TEXT,
  _parcelas INT,
  _nsu TEXT,
  _autorizacao TEXT,
  _external_id TEXT,
  _raw JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.tap_card_charges (
    empresa_id, pos_device_id, provider, ambiente, order_id, valor,
    bandeira, modalidade, parcelas, nsu, autorizacao, external_id, raw_response
  ) VALUES (
    _empresa_id, _pos_device_id, _provider, _ambiente, _order_id, _valor,
    _bandeira, _modalidade, COALESCE(_parcelas,1), _nsu, _autorizacao, _external_id, _raw
  ) RETURNING id INTO _id;

  -- Liquida o pedido se houver
  IF _order_id IS NOT NULL THEN
    BEGIN
      PERFORM public._finalize_order_financials(_order_id, _valor, 'cartao_tap');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN _id;
END;
$$;

-- Registrar reembolso (parcial ou total)
CREATE OR REPLACE FUNCTION public.record_tap_card_refund(
  _charge_id UUID,
  _valor NUMERIC,
  _raw JSONB
) RETURNS TABLE(id UUID, status TEXT, valor_reembolsado NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.tap_card_charges%ROWTYPE;
  _new_ref NUMERIC;
  _new_status TEXT;
BEGIN
  SELECT * INTO _row FROM public.tap_card_charges WHERE tap_card_charges.id = _charge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'charge_not_found'; END IF;

  _new_ref := COALESCE(_row.valor_reembolsado,0) + _valor;
  IF _new_ref > _row.valor THEN RAISE EXCEPTION 'refund_exceeds_amount'; END IF;

  _new_status := CASE WHEN _new_ref >= _row.valor THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE public.tap_card_charges
     SET valor_reembolsado = _new_ref,
         status = _new_status,
         raw_response = COALESCE(raw_response,'{}'::jsonb) || jsonb_build_object('refunds', COALESCE(raw_response->'refunds','[]'::jsonb) || jsonb_build_array(_raw))
   WHERE tap_card_charges.id = _charge_id;

  RETURN QUERY SELECT _row.id, _new_status, _new_ref;
END;
$$;

-- Conciliação do dia (PIX + Cartão) agrupada por provider/modalidade
CREATE OR REPLACE FUNCTION public.tap_daily_reconciliation(_empresa_id UUID, _dia DATE)
RETURNS TABLE(
  tipo TEXT,
  provider TEXT,
  modalidade TEXT,
  qtd BIGINT,
  bruto NUMERIC,
  reembolsado NUMERIC,
  liquido NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'pix'::TEXT, provider, 'pix'::TEXT,
         COUNT(*)::BIGINT,
         COALESCE(SUM(valor),0),
         0::NUMERIC,
         COALESCE(SUM(valor),0)
    FROM public.tap_pix_charges
   WHERE empresa_id = _empresa_id
     AND status = 'paid'
     AND paid_at::date = _dia
   GROUP BY provider
  UNION ALL
  SELECT 'cartao'::TEXT, provider, COALESCE(modalidade,'-'),
         COUNT(*)::BIGINT,
         COALESCE(SUM(valor),0),
         COALESCE(SUM(valor_reembolsado),0),
         COALESCE(SUM(valor - valor_reembolsado),0)
    FROM public.tap_card_charges
   WHERE empresa_id = _empresa_id
     AND status IN ('approved','partially_refunded','refunded')
     AND paid_at::date = _dia
   GROUP BY provider, modalidade
  ORDER BY 1,2,3;
$$;

GRANT EXECUTE ON FUNCTION public.record_tap_card_paid TO service_role;
GRANT EXECUTE ON FUNCTION public.record_tap_card_refund TO service_role;
GRANT EXECUTE ON FUNCTION public.tap_daily_reconciliation TO authenticated, service_role;
