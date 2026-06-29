
-- 1) INSUMOS
CREATE TABLE public.insumos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  unidade_medida text NOT NULL DEFAULT 'un',
  custo_unitario numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos TO authenticated;
GRANT ALL ON public.insumos TO service_role;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view insumos" ON public.insumos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert insumos" ON public.insumos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update insumos" ON public.insumos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete insumos" ON public.insumos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2) SUBPRODUTOS
CREATE TABLE public.subprodutos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  rendimento_porcoes numeric(12,2) NOT NULL DEFAULT 1,
  modo_preparo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subprodutos TO authenticated;
GRANT ALL ON public.subprodutos TO service_role;
ALTER TABLE public.subprodutos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view subprodutos" ON public.subprodutos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert subprodutos" ON public.subprodutos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update subprodutos" ON public.subprodutos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete subprodutos" ON public.subprodutos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) COMPOSICAO_SUBPRODUTO (liga subproduto -> insumos)
CREATE TABLE public.composicao_subproduto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subproduto_id uuid NOT NULL REFERENCES public.subprodutos(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  quantidade numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_composicao_subproduto_subproduto ON public.composicao_subproduto(subproduto_id);
CREATE INDEX idx_composicao_subproduto_insumo ON public.composicao_subproduto(insumo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicao_subproduto TO authenticated;
GRANT ALL ON public.composicao_subproduto TO service_role;
ALTER TABLE public.composicao_subproduto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view composicao" ON public.composicao_subproduto FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert composicao" ON public.composicao_subproduto FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update composicao" ON public.composicao_subproduto FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete composicao" ON public.composicao_subproduto FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) FICHAS_TECNICAS (liga ao cardapio/products)
CREATE TABLE public.fichas_tecnicas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  dados_fiscais jsonb NOT NULL DEFAULT '{}'::jsonb,
  modo_preparo_final text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fichas_tecnicas_product ON public.fichas_tecnicas(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fichas_tecnicas TO authenticated;
GRANT ALL ON public.fichas_tecnicas TO service_role;
ALTER TABLE public.fichas_tecnicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view fichas" ON public.fichas_tecnicas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert fichas" ON public.fichas_tecnicas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update fichas" ON public.fichas_tecnicas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete fichas" ON public.fichas_tecnicas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) INGREDIENTES_PRODUTO (liga produto -> insumo OU subproduto)
CREATE TABLE public.ingredientes_produto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  subproduto_id uuid REFERENCES public.subprodutos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  quantidade numeric(12,4) NOT NULL DEFAULT 0,
  permitir_exclusao boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredientes_produto_fonte_chk CHECK (
    (insumo_id IS NOT NULL AND subproduto_id IS NULL)
    OR (insumo_id IS NULL AND subproduto_id IS NOT NULL)
    OR (insumo_id IS NULL AND subproduto_id IS NULL)
  )
);
CREATE INDEX idx_ingredientes_produto_product ON public.ingredientes_produto(product_id);
GRANT SELECT ON public.ingredientes_produto TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredientes_produto TO authenticated;
GRANT ALL ON public.ingredientes_produto TO service_role;
ALTER TABLE public.ingredientes_produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ingredientes_produto" ON public.ingredientes_produto FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert ingredientes_produto" ON public.ingredientes_produto FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update ingredientes_produto" ON public.ingredientes_produto FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete ingredientes_produto" ON public.ingredientes_produto FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) order_items: armazenar remoções escolhidas pelo cliente
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS remocoes text[] NOT NULL DEFAULT '{}'::text[];

-- 7) Triggers de updated_at (função já existe)
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subprodutos_updated_at BEFORE UPDATE ON public.subprodutos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fichas_tecnicas_updated_at BEFORE UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
