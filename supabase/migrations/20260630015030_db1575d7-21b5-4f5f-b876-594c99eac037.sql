-- =========================================================
-- 1. SUPPORT TABLES: setores & fornecedores
-- =========================================================
CREATE TABLE public.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor text NOT NULL,
  ordem_exibicao numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO authenticated;
GRANT ALL ON public.setores TO service_role;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view setores" ON public.setores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert setores" ON public.setores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update setores" ON public.setores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete setores" ON public.setores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor text NOT NULL,
  endereco text,
  contato text,
  telefone text,
  email text,
  prazo numeric,
  site text,
  cnpj text,
  i_estadual text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 2. PRODUCT CHILD TABLES (relational replacement of JSON)
-- =========================================================
CREATE TABLE public.produtos_price_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  preco numeric NOT NULL DEFAULT 0,
  tamanho text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ppo_produto ON public.produtos_price_options(produto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_price_options TO authenticated;
GRANT SELECT ON public.produtos_price_options TO anon;
GRANT ALL ON public.produtos_price_options TO service_role;
ALTER TABLE public.produtos_price_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view price options" ON public.produtos_price_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert price options" ON public.produtos_price_options FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update price options" ON public.produtos_price_options FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete price options" ON public.produtos_price_options FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.produtos_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_paddons_produto ON public.produtos_addons(produto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_addons TO authenticated;
GRANT SELECT ON public.produtos_addons TO anon;
GRANT ALL ON public.produtos_addons TO service_role;
ALTER TABLE public.produtos_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view addons" ON public.produtos_addons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert addons" ON public.produtos_addons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update addons" ON public.produtos_addons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete addons" ON public.produtos_addons FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.produtos_free_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pfaddons_produto ON public.produtos_free_addons(produto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_free_addons TO authenticated;
GRANT SELECT ON public.produtos_free_addons TO anon;
GRANT ALL ON public.produtos_free_addons TO service_role;
ALTER TABLE public.produtos_free_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view free addons" ON public.produtos_free_addons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert free addons" ON public.produtos_free_addons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update free addons" ON public.produtos_free_addons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete free addons" ON public.produtos_free_addons FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. DATA MIGRATION FROM JSON COLUMNS -> CHILD TABLES
-- =========================================================
INSERT INTO public.produtos_price_options (produto_id, tamanho, preco, sort_order)
SELECT p.id,
       COALESCE(elem->>'tamanho', 'Padrão'),
       COALESCE((elem->>'preco')::numeric, 0),
       (ord - 1)::int
FROM public.products p,
     LATERAL jsonb_array_elements(p.price_options) WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(p.price_options) = 'array' AND jsonb_array_length(p.price_options) > 0;

INSERT INTO public.produtos_addons (produto_id, nome, preco, sort_order)
SELECT p.id,
       COALESCE(elem->>'nome', ''),
       COALESCE((elem->>'preco')::numeric, 0),
       (ord - 1)::int
FROM public.products p,
     LATERAL jsonb_array_elements(p.addons) WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(p.addons) = 'array' AND jsonb_array_length(p.addons) > 0
  AND COALESCE(elem->>'nome', '') <> '';

INSERT INTO public.produtos_free_addons (produto_id, nome, preco, sort_order)
SELECT p.id,
       COALESCE(elem->>'nome', ''),
       COALESCE(p.free_addon_price, 0),
       (ord - 1)::int
FROM public.products p,
     LATERAL jsonb_array_elements(p.free_addons) WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(p.free_addons) = 'array' AND jsonb_array_length(p.free_addons) > 0
  AND COALESCE(elem->>'nome', '') <> '';

-- =========================================================
-- 4. PRODUCTS: new columns
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN manipulado boolean NOT NULL DEFAULT true,
  ADD COLUMN setor_id uuid REFERENCES public.setores(id) ON DELETE SET NULL,
  ADD COLUMN fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN custo_anterior numeric,
  ADD COLUMN custo_anterior_at timestamptz;

-- Drop old JSON columns after data migration (keeps free_addon_limit)
ALTER TABLE public.products
  DROP COLUMN free_addon_price,
  DROP COLUMN free_addons,
  DROP COLUMN addons,
  DROP COLUMN price_options;

-- =========================================================
-- 5. INSUMOS: cost history + FKs
-- =========================================================
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS custo_anterior numeric,
  ADD COLUMN IF NOT EXISTS custo_anterior_at timestamptz,
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.setores(id) ON DELETE SET NULL;

-- =========================================================
-- updated_at triggers
-- =========================================================
CREATE TRIGGER trg_setores_updated BEFORE UPDATE ON public.setores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ppo_updated BEFORE UPDATE ON public.produtos_price_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_paddons_updated BEFORE UPDATE ON public.produtos_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pfaddons_updated BEFORE UPDATE ON public.produtos_free_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();