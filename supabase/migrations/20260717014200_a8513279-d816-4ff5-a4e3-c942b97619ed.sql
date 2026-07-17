-- Adiciona campos de certificado A1 à configuração fiscal
ALTER TABLE public.config_fiscal
  ADD COLUMN IF NOT EXISTS certificado_a1_nome text,
  ADD COLUMN IF NOT EXISTS certificado_a1_validade date;

-- Garante que empresa_id não seja nulo
ALTER TABLE public.config_fiscal
  ALTER COLUMN empresa_id SET NOT NULL;