-- 1) INSUMOS
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS unidade_estoque text,
  ADD COLUMN IF NOT EXISTS fator_conversao numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS controlado boolean NOT NULL DEFAULT false;

ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_fator_conversao_positivo;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_fator_conversao_positivo CHECK (fator_conversao > 0);

UPDATE public.insumos
  SET unidade_estoque = COALESCE(unidade_estoque, unidade_medida, 'un')
  WHERE unidade_estoque IS NULL;

-- 2) PRODUCTS: eixo de variação dinâmico
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS eixo_variacao text NOT NULL DEFAULT 'Tamanho';

-- 3) FICHA EM CAMADAS
ALTER TABLE public.ingredientes_produto
  ADD COLUMN IF NOT EXISTS price_option_id uuid
    REFERENCES public.produtos_price_options(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ingredientes_produto_price_option
  ON public.ingredientes_produto(price_option_id);

ALTER TABLE public.produtos_addons
  ADD COLUMN IF NOT EXISTS insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade numeric NOT NULL DEFAULT 0;

ALTER TABLE public.produtos_free_addons
  ADD COLUMN IF NOT EXISTS insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade numeric NOT NULL DEFAULT 0;

-- 4) VIEW/FUNÇÃO PÚBLICA (drop antes por mudar o tipo de retorno)
DROP VIEW IF EXISTS public.view_products_public;
DROP FUNCTION IF EXISTS public.get_public_menu();

CREATE FUNCTION public.get_public_menu()
RETURNS TABLE (
  id uuid, category_id uuid, name text, description text, price numeric,
  image_url text, available boolean, sort_order integer, free_addon_limit integer,
  eixo_variacao text, empresa_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
         p.available, p.sort_order, p.free_addon_limit, p.eixo_variacao, p.empresa_id
  FROM public.products p
  WHERE p.available = true
  ORDER BY p.sort_order;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_menu() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_menu() TO anon, authenticated;

CREATE VIEW public.view_products_public
WITH (security_invoker = true) AS
  SELECT id, category_id, name, description, price, image_url,
         available, sort_order, free_addon_limit, eixo_variacao, empresa_id
  FROM public.get_public_menu();
GRANT SELECT ON public.view_products_public TO anon, authenticated;

DROP FUNCTION IF EXISTS public.admin_get_products(uuid, boolean);
CREATE FUNCTION public.admin_get_products(
  p_id uuid DEFAULT NULL,
  p_only_manipulado_false boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, category_id uuid, name text, description text, price numeric,
  image_url text, available boolean, sort_order integer, free_addon_limit integer,
  eixo_variacao text, manipulado boolean, setor_id uuid, fornecedor_id uuid,
  saldo_estoque numeric, estoque_minimo numeric, estoque_maximo numeric, custo_anterior numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
           p.available, p.sort_order, p.free_addon_limit, p.eixo_variacao,
           p.manipulado, p.setor_id, p.fornecedor_id, p.saldo_estoque,
           p.estoque_minimo, p.estoque_maximo, p.custo_anterior
    FROM public.products p
    WHERE (p_id IS NULL OR p.id = p_id)
      AND (NOT p_only_manipulado_false OR p.manipulado = false)
    ORDER BY p.sort_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_products(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_products(uuid, boolean) TO authenticated, service_role;

-- 5) KARDEX DE AJUSTE RÁPIDO / CONCILIAÇÃO NF
CREATE TABLE IF NOT EXISTS public.ajustes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023',
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'Entrada Emergencial',
  quantidade numeric NOT NULL,
  status text NOT NULL DEFAULT 'Provisorio',
  observacao text,
  nf_referencia text,
  quantidade_nf numeric,
  ajuste_fino numeric,
  saldo_apos numeric,
  created_by uuid,
  conciliado_by uuid,
  conciliado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ajustes_estoque_status_chk CHECK (status IN ('Provisorio','Conciliado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_estoque TO authenticated;
GRANT ALL ON public.ajustes_estoque TO service_role;

ALTER TABLE public.ajustes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ajustes_estoque" ON public.ajustes_estoque;
CREATE POLICY "Admins manage ajustes_estoque"
  ON public.ajustes_estoque FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_ajustes_estoque_updated_at ON public.ajustes_estoque;
CREATE TRIGGER trg_ajustes_estoque_updated_at
  BEFORE UPDATE ON public.ajustes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ajustes_estoque_empresa ON public.ajustes_estoque(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_estoque_status ON public.ajustes_estoque(status);
CREATE INDEX IF NOT EXISTS idx_ajustes_estoque_insumo ON public.ajustes_estoque(insumo_id);

-- 6) RPCs
CREATE OR REPLACE FUNCTION public.ajuste_rapido_estoque(
  p_insumo_id uuid, p_quantidade numeric, p_observacao text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_empresa uuid; v_saldo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
  IF p_quantidade IS NULL OR p_quantidade = 0 THEN RAISE EXCEPTION 'Informe uma quantidade diferente de zero.'; END IF;

  SELECT empresa_id INTO v_empresa FROM public.insumos WHERE id = p_insumo_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Insumo não encontrado.'; END IF;

  UPDATE public.insumos SET saldo_estoque = saldo_estoque + p_quantidade, updated_at = now()
    WHERE id = p_insumo_id RETURNING saldo_estoque INTO v_saldo;

  INSERT INTO public.ajustes_estoque
    (empresa_id, insumo_id, tipo, quantidade, status, observacao, saldo_apos, created_by)
  VALUES (v_empresa, p_insumo_id, 'Entrada Emergencial', p_quantidade, 'Provisorio',
          NULLIF(p_observacao, ''), v_saldo, auth.uid());
  RETURN v_saldo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ajuste_rapido_estoque(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajuste_rapido_estoque(uuid, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.conciliar_ajuste_nf(
  p_ajuste_id uuid, p_quantidade_nf numeric, p_nf_referencia text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_insumo uuid; v_qtd numeric; v_status text; v_fino numeric; v_saldo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;

  SELECT insumo_id, quantidade, status INTO v_insumo, v_qtd, v_status
    FROM public.ajustes_estoque WHERE id = p_ajuste_id;
  IF v_insumo IS NULL THEN RAISE EXCEPTION 'Ajuste não encontrado.'; END IF;
  IF v_status = 'Conciliado' THEN RAISE EXCEPTION 'Este ajuste já foi conciliado.'; END IF;

  v_fino := COALESCE(p_quantidade_nf, v_qtd) - v_qtd;

  IF v_fino <> 0 THEN
    UPDATE public.insumos SET saldo_estoque = saldo_estoque + v_fino, updated_at = now()
      WHERE id = v_insumo RETURNING saldo_estoque INTO v_saldo;
  ELSE
    SELECT saldo_estoque INTO v_saldo FROM public.insumos WHERE id = v_insumo;
  END IF;

  UPDATE public.ajustes_estoque
    SET status = 'Conciliado', quantidade_nf = p_quantidade_nf,
        nf_referencia = NULLIF(p_nf_referencia, ''), ajuste_fino = v_fino,
        saldo_apos = v_saldo, conciliado_by = auth.uid(), conciliado_at = now()
    WHERE id = p_ajuste_id;
  RETURN v_saldo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.conciliar_ajuste_nf(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conciliar_ajuste_nf(uuid, numeric, text) TO authenticated, service_role;