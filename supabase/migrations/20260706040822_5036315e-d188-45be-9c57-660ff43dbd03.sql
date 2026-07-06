
-- ============================================================
-- 1) SECURITY DEFINER VIEW -> SECURITY INVOKER
--    Public branding view now runs with the caller's privileges.
--    Grant only the branding columns to anon/authenticated and add a
--    narrow RLS policy so the invoker view keeps working, while sensitive
--    columns (address, service fee, custom domain config, etc.) stay hidden.
-- ============================================================
ALTER VIEW public.empresas_public_branding SET (security_invoker = true);

GRANT SELECT
  (id, nome_fantasia, logotipo_url, dominio_customizado, ativo,
   cor_primaria, cor_secundaria, modo_fundo, created_at)
  ON public.empresas TO anon, authenticated;

DROP POLICY IF EXISTS "Public branding readable" ON public.empresas;
CREATE POLICY "Public branding readable" ON public.empresas
  FOR SELECT TO anon, authenticated
  USING (ativo = true);

-- ============================================================
-- 2) Helper functions (SECURITY DEFINER) to scope public reads by
--    tenant without triggering RLS recursion on empresas/products.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_empresa_ativa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = _empresa_id AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_produto_publico(_produto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.id = _produto_id
      AND p.available = true
      AND e.ativo = true
  );
$$;

-- ============================================================
-- 3) Tenant-scope the public SELECT policies.
-- ============================================================

-- categories
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Public can view active-tenant categories" ON public.categories
  FOR SELECT TO anon, authenticated
  USING (public.is_empresa_ativa(empresa_id));

-- ingredientes_produto (removable ingredients only, public products only)
DROP POLICY IF EXISTS "Public can view removable ingredientes" ON public.ingredientes_produto;
CREATE POLICY "Public can view removable ingredientes" ON public.ingredientes_produto
  FOR SELECT TO anon, authenticated
  USING (permitir_exclusao = true AND public.is_produto_publico(product_id));

-- produtos_addons
DROP POLICY IF EXISTS "Anyone can view addons" ON public.produtos_addons;
CREATE POLICY "Public can view addons of public products" ON public.produtos_addons
  FOR SELECT TO anon, authenticated
  USING (public.is_produto_publico(produto_id));

-- produtos_free_addons
DROP POLICY IF EXISTS "Anyone can view free addons" ON public.produtos_free_addons;
CREATE POLICY "Public can view free addons of public products" ON public.produtos_free_addons
  FOR SELECT TO anon, authenticated
  USING (public.is_produto_publico(produto_id));

-- produtos_price_options
DROP POLICY IF EXISTS "Anyone can view price options" ON public.produtos_price_options;
CREATE POLICY "Public can view price options of public products" ON public.produtos_price_options
  FOR SELECT TO anon, authenticated
  USING (public.is_produto_publico(produto_id));
