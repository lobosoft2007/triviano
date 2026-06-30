ALTER TABLE public.fluxo_caixa
  ADD COLUMN IF NOT EXISTS metadados_abertura jsonb,
  ADD COLUMN IF NOT EXISTS metadados_fechamento jsonb;