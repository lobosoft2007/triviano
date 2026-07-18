
-- 1) Tabela
CREATE TABLE public.tap_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.current_empresa_id(),
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago','pagbank')),
  ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('prod','sandbox')),
  ativo BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tap_provider_config_one_active_per_empresa
  ON public.tap_provider_config(empresa_id)
  WHERE ativo = true;

CREATE UNIQUE INDEX tap_provider_config_empresa_provider_uniq
  ON public.tap_provider_config(empresa_id, provider);

-- 2) GRANTS (public schema)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tap_provider_config TO authenticated;
GRANT ALL ON public.tap_provider_config TO service_role;

-- 3) RLS
ALTER TABLE public.tap_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tap_provider_config manage por dono da empresa"
  ON public.tap_provider_config
  FOR ALL
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 4) updated_at trigger (reusa util padrão)
CREATE TRIGGER tap_provider_config_set_updated_at
  BEFORE UPDATE ON public.tap_provider_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RPC pública p/ app garçom: só o mínimo, sem credenciais brutas
CREATE OR REPLACE FUNCTION public.get_my_tap_provider()
RETURNS TABLE (
  provider TEXT,
  ambiente TEXT,
  ativo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.provider, t.ambiente, t.ativo
  FROM public.tap_provider_config t
  WHERE t.empresa_id = public.current_empresa_id()
    AND t.ativo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tap_provider() TO authenticated;

-- 6) RPC de gravação (admin da empresa). Faz upsert por (empresa, provider).
--    Quando ativo=true, desativa a linha ativa anterior atomicamente.
CREATE OR REPLACE FUNCTION public.save_tap_provider_config(
  p_provider TEXT,
  p_ambiente TEXT,
  p_credentials JSONB,
  p_ativo BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID := public.current_empresa_id();
  v_id UUID;
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Sem empresa no contexto';
  END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar esta empresa';
  END IF;
  IF p_provider NOT IN ('mercadopago','pagbank') THEN
    RAISE EXCEPTION 'Provedor inválido: %', p_provider;
  END IF;
  IF p_ambiente NOT IN ('prod','sandbox') THEN
    RAISE EXCEPTION 'Ambiente inválido: %', p_ambiente;
  END IF;

  -- Se este provedor será o ativo, desativa qualquer outro ativo primeiro.
  IF p_ativo THEN
    UPDATE public.tap_provider_config
       SET ativo = false, updated_at = now()
     WHERE empresa_id = v_empresa
       AND ativo = true
       AND provider <> p_provider;
  END IF;

  INSERT INTO public.tap_provider_config
    (empresa_id, provider, ambiente, credentials, ativo)
  VALUES
    (v_empresa, p_provider, p_ambiente, COALESCE(p_credentials, '{}'::jsonb), p_ativo)
  ON CONFLICT (empresa_id, provider) DO UPDATE
    SET ambiente    = EXCLUDED.ambiente,
        credentials = EXCLUDED.credentials,
        ativo       = EXCLUDED.ativo,
        updated_at  = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_tap_provider_config(TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;
