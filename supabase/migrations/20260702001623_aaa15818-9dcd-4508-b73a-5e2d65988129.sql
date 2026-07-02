ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS cor_fonte text NOT NULL DEFAULT 'text-white',
  ADD COLUMN IF NOT EXISTS tamanho_fonte text NOT NULL DEFAULT 'text-base';

-- Ensure sort_order has a sane default for ordering control
ALTER TABLE public.categories
  ALTER COLUMN sort_order SET DEFAULT 0;