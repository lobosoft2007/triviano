ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS free_addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS free_addon_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_addon_price numeric NOT NULL DEFAULT 0;