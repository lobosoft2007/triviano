DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_promocao_enum') THEN
    CREATE TYPE public.tipo_promocao_enum AS ENUM ('Combo', 'Pack');
  END IF;
END$$;

ALTER TABLE public.regras_combos
  ADD COLUMN IF NOT EXISTS quantidade_requerida integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tipo_promocao public.tipo_promocao_enum NOT NULL DEFAULT 'Combo';