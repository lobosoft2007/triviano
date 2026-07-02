-- 1) LINT 0010: view do cardápio passa a respeitar o RLS do usuário (invoker)
DROP VIEW IF EXISTS public.view_products_public;

CREATE VIEW public.view_products_public
WITH (security_invoker = true) AS
  SELECT
    id,
    category_id,
    name,
    description,
    price,
    image_url,
    available,
    sort_order,
    free_addon_limit,
    empresa_id
  FROM public.products
  WHERE available = true;

GRANT SELECT ON public.view_products_public TO anon, authenticated;

-- 2) RLS da tabela products: clientes leem apenas linhas disponíveis (row-level);
--    admins continuam com acesso a todas as linhas.
DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;
DROP POLICY IF EXISTS "Public can view available products" ON public.products;
DROP POLICY IF EXISTS "Admins can view products" ON public.products;

CREATE POLICY "Public can view available products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (available = true);

CREATE POLICY "Admins can view products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Column-level security: expõe só colunas seguras; oculta custo/estoque/fornecedor
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;

GRANT SELECT (
  id, category_id, name, description, price, image_url,
  available, sort_order, created_at, free_addon_limit,
  manipulado, setor_id, empresa_id
) ON public.products TO anon, authenticated;

-- service_role mantém acesso total (edge/admin)
GRANT SELECT ON public.products TO service_role;

-- 4) Função administrativa (SECURITY DEFINER, escopo travado) para dados sensíveis
CREATE OR REPLACE FUNCTION public.admin_get_products(
  p_id uuid DEFAULT NULL,
  p_only_manipulado_false boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  category_id uuid,
  name text,
  description text,
  price numeric,
  image_url text,
  available boolean,
  sort_order integer,
  free_addon_limit integer,
  manipulado boolean,
  setor_id uuid,
  fornecedor_id uuid,
  saldo_estoque numeric,
  estoque_minimo numeric,
  estoque_maximo numeric,
  custo_anterior numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  RETURN QUERY
    SELECT
      p.id, p.category_id, p.name, p.description, p.price, p.image_url,
      p.available, p.sort_order, p.free_addon_limit, p.manipulado,
      p.setor_id, p.fornecedor_id, p.saldo_estoque, p.estoque_minimo,
      p.estoque_maximo, p.custo_anterior
    FROM public.products p
    WHERE (p_id IS NULL OR p.id = p_id)
      AND (NOT p_only_manipulado_false OR p.manipulado = false)
    ORDER BY p.sort_order;
END;
$$;

-- LINT 0028: nega execução anônima, libera apenas logados/serviço
REVOKE EXECUTE ON FUNCTION public.admin_get_products(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_products(uuid, boolean) TO authenticated, service_role;