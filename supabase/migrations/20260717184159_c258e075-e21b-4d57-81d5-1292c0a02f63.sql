ALTER TABLE public.config_fiscal
  ADD COLUMN IF NOT EXISTS certificado_provider_id text,
  ADD COLUMN IF NOT EXISTS certificado_sincronizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS emitente_sincronizado_em timestamptz;