-- Remove a política pública ampla na tabela bruta (não exponha a tabela direto)
DROP POLICY IF EXISTS "Public can view available products" ON public.products;

-- Clientes não leem a tabela bruta; anon sem qualquer acesso direto
REVOKE SELECT ON public.products FROM anon;

-- Função blindada que entrega SOMENTE colunas seguras do cardápio.
-- SECURITY DEFINER + search_path fixo: ignora o RLS da tabela mas nunca
-- devolve custo/estoque/fornecedor.
CREATE OR REPLACE FUNCTION public.get_public_menu()
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
  empresa_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.category_id, p.name, p.description, p.price, p.image_url,
    p.available, p.sort_order, p.free_addon_limit, p.empresa_id
  FROM public.products p
  WHERE p.available = true
  ORDER BY p.sort_order;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_menu() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_menu() TO anon, authenticated;

-- View do cardápio: INVOKER (respeita permissões do usuário) lendo da função
-- segura. Não toca colunas sensíveis nem exige política pública em products.
DROP VIEW IF EXISTS public.view_products_public;

CREATE VIEW public.view_products_public
WITH (security_invoker = true) AS
  SELECT
    id, category_id, name, description, price, image_url,
    available, sort_order, free_addon_limit, empresa_id
  FROM public.get_public_menu();

GRANT SELECT ON public.view_products_public TO anon, authenticated;