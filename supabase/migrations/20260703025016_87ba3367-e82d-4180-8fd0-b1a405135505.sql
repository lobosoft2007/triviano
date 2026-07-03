
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cor_primaria  text NOT NULL DEFAULT '#1FAA6A',
  ADD COLUMN IF NOT EXISTS cor_secundaria text NOT NULL DEFAULT '#F2B24C',
  ADD COLUMN IF NOT EXISTS modo_fundo    text NOT NULL DEFAULT 'dark';

-- Trava de valores válidos para o modo de fundo (evita fundos coloridos ilegíveis)
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_modo_fundo_chk;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_modo_fundo_chk CHECK (modo_fundo IN ('dark', 'light'));

-- Leitura pública apenas das colunas de branding visual (edição segue RLS admin).
GRANT SELECT (cor_primaria, cor_secundaria, modo_fundo) ON public.empresas TO anon;
GRANT SELECT (cor_primaria, cor_secundaria, modo_fundo) ON public.empresas TO authenticated;
