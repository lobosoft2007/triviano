-- Category-level business rule metadata
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS min_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allows_half boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS combo_role text NOT NULL DEFAULT '';

-- Product size options and allowed add-ons
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Order line configuration (size, add-ons, half-and-half second flavor)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS second_flavor text NOT NULL DEFAULT '';

-- Track applied combo discount on the order for transparency
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;