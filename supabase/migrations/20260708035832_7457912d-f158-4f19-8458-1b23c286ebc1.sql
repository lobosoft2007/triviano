-- =====================================================================
-- FASE 2a: Isolamento por empresa — MÓDULO CARDÁPIO
-- =====================================================================

-- Regra central de gestão por empresa (admin do tenant OU super_admin da holding)
CREATE OR REPLACE FUNCTION public.can_manage_empresa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
      OR (public.has_role(auth.uid(), 'admin') AND _empresa_id = public.current_empresa_id());
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_empresa(uuid) TO authenticated, service_role;

-- ---- Colunas de empresa em setores/subprodutos --------------------------
ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS empresa_id uuid;
UPDATE public.setores SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.setores ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.setores ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

ALTER TABLE public.subprodutos ADD COLUMN IF NOT EXISTS empresa_id uuid;
UPDATE public.subprodutos SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.subprodutos ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.subprodutos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

-- ---- PRODUCTS (empresa_id direto) ---------------------------------------
ALTER POLICY "Admins can view products"   ON public.products USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can update products" ON public.products USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can delete products" ON public.products USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can insert products" ON public.products WITH CHECK (public.can_manage_empresa(empresa_id));

-- ---- CATEGORIES (empresa_id direto) -------------------------------------
ALTER POLICY "Admins can update categories" ON public.categories USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can delete categories" ON public.categories USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can insert categories" ON public.categories WITH CHECK (public.can_manage_empresa(empresa_id));

-- ---- REGRAS_COMBOS (empresa_id direto) ----------------------------------
ALTER POLICY "Admins can update combo rules" ON public.regras_combos USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can delete combo rules" ON public.regras_combos USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can insert combo rules" ON public.regras_combos WITH CHECK (public.can_manage_empresa(empresa_id));

-- ---- SETORES (empresa_id direto) ----------------------------------------
ALTER POLICY "Admins can view setores"   ON public.setores USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can update setores" ON public.setores USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can delete setores" ON public.setores USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can insert setores" ON public.setores WITH CHECK (public.can_manage_empresa(empresa_id));

-- ---- SUBPRODUTOS (empresa_id direto) ------------------------------------
ALTER POLICY "Admins can view subprodutos"   ON public.subprodutos USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can update subprodutos" ON public.subprodutos USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can delete subprodutos" ON public.subprodutos USING (public.can_manage_empresa(empresa_id));
ALTER POLICY "Admins can insert subprodutos" ON public.subprodutos WITH CHECK (public.can_manage_empresa(empresa_id));

-- ---- INGREDIENTES_PRODUTO (via produto pai) -----------------------------
ALTER POLICY "Admins can view all ingredientes"   ON public.ingredientes_produto USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = ingredientes_produto.product_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can update ingredientes_produto" ON public.ingredientes_produto USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = ingredientes_produto.product_id AND public.can_manage_empresa(p.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = ingredientes_produto.product_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can delete ingredientes_produto" ON public.ingredientes_produto USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = ingredientes_produto.product_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can insert ingredientes_produto" ON public.ingredientes_produto WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = ingredientes_produto.product_id AND public.can_manage_empresa(p.empresa_id)));

-- ---- PRODUTOS_PRICE_OPTIONS (via produto pai) ---------------------------
ALTER POLICY "Admins can update price options" ON public.produtos_price_options USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_price_options.produto_id AND public.can_manage_empresa(p.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_price_options.produto_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can delete price options" ON public.produtos_price_options USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_price_options.produto_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can insert price options" ON public.produtos_price_options WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_price_options.produto_id AND public.can_manage_empresa(p.empresa_id)));

-- ---- PRODUTOS_ADDONS (via produto pai) ----------------------------------
ALTER POLICY "Admins can update addons" ON public.produtos_addons USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_addons.produto_id AND public.can_manage_empresa(p.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_addons.produto_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can delete addons" ON public.produtos_addons USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_addons.produto_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can insert addons" ON public.produtos_addons WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_addons.produto_id AND public.can_manage_empresa(p.empresa_id)));

-- ---- PRODUTOS_FREE_ADDONS (via produto pai) -----------------------------
ALTER POLICY "Admins can update free addons" ON public.produtos_free_addons USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_free_addons.produto_id AND public.can_manage_empresa(p.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_free_addons.produto_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can delete free addons" ON public.produtos_free_addons USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_free_addons.produto_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can insert free addons" ON public.produtos_free_addons WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = produtos_free_addons.produto_id AND public.can_manage_empresa(p.empresa_id)));

-- ---- FICHAS_TECNICAS (via produto pai) ----------------------------------
ALTER POLICY "Admins can view fichas"   ON public.fichas_tecnicas USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = fichas_tecnicas.product_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can update fichas" ON public.fichas_tecnicas USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = fichas_tecnicas.product_id AND public.can_manage_empresa(p.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = fichas_tecnicas.product_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can delete fichas" ON public.fichas_tecnicas USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = fichas_tecnicas.product_id AND public.can_manage_empresa(p.empresa_id)));
ALTER POLICY "Admins can insert fichas" ON public.fichas_tecnicas WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = fichas_tecnicas.product_id AND public.can_manage_empresa(p.empresa_id)));

-- ---- COMPOSICAO_SUBPRODUTO (via subproduto pai) -------------------------
ALTER POLICY "Admins can view composicao"   ON public.composicao_subproduto USING (EXISTS (SELECT 1 FROM public.subprodutos s WHERE s.id = composicao_subproduto.subproduto_id AND public.can_manage_empresa(s.empresa_id)));
ALTER POLICY "Admins can update composicao" ON public.composicao_subproduto USING (EXISTS (SELECT 1 FROM public.subprodutos s WHERE s.id = composicao_subproduto.subproduto_id AND public.can_manage_empresa(s.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.subprodutos s WHERE s.id = composicao_subproduto.subproduto_id AND public.can_manage_empresa(s.empresa_id)));
ALTER POLICY "Admins can delete composicao" ON public.composicao_subproduto USING (EXISTS (SELECT 1 FROM public.subprodutos s WHERE s.id = composicao_subproduto.subproduto_id AND public.can_manage_empresa(s.empresa_id)));
ALTER POLICY "Admins can insert composicao" ON public.composicao_subproduto WITH CHECK (EXISTS (SELECT 1 FROM public.subprodutos s WHERE s.id = composicao_subproduto.subproduto_id AND public.can_manage_empresa(s.empresa_id)));

-- ---- Função de leitura interna de produtos: escopar por empresa ---------
CREATE OR REPLACE FUNCTION public.admin_get_products(p_id uuid DEFAULT NULL::uuid, p_only_manipulado_false boolean DEFAULT false)
 RETURNS TABLE(id uuid, category_id uuid, name text, description text, price numeric, image_url text, available boolean, sort_order integer, free_addon_limit integer, eixo_variacao text, manipulado boolean, setor_id uuid, fornecedor_id uuid, saldo_estoque numeric, estoque_minimo numeric, estoque_maximo numeric, custo_anterior numeric, custo_total numeric, disponivel boolean, margem_revenda numeric, custo_compra numeric, preco_ideal_revenda numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT
      p.id, p.category_id, p.name, p.description, p.price,
      p.image_url, p.available, p.sort_order, p.free_addon_limit,
      p.eixo_variacao, p.manipulado, p.setor_id, p.fornecedor_id,
      p.saldo_estoque, p.estoque_minimo, p.estoque_maximo,
      p.custo_anterior,
      public.compute_product_cmv(p.id) AS custo_total,
      CASE
        WHEN p.manipulado = false THEN
          NOT (p.estoque_maximo > 0 AND p.saldo_estoque <= 0)
        ELSE
          NOT EXISTS (
            SELECT 1
            FROM public.ingredientes_produto ip
            JOIN public.insumos i ON i.id = ip.insumo_id
            WHERE ip.product_id = p.id
              AND ip.price_option_id IS NULL
              AND i.controlado = true
              AND i.estocavel = true
              AND i.saldo_estoque < (ip.quantidade * COALESCE(NULLIF(i.fator_conversao, 0), 1))
          )
      END AS disponivel,
      COALESCE(p.margem_revenda, 100) AS margem_revenda,
      COALESCE(p.custo_compra, 0) AS custo_compra,
      p.preco_ideal_revenda
    FROM public.products p
    WHERE (p_id IS NULL OR p.id = p_id)
      AND (NOT p_only_manipulado_false OR p.manipulado = false)
      AND (public.has_role(auth.uid(), 'super_admin') OR p.empresa_id = public.current_empresa_id())
    ORDER BY p.sort_order;
END;
$function$;