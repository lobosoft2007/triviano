-- 1) Restringe a tabela bruta products: somente admins autenticados podem ler
DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;

CREATE POLICY "Admins can view products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Revoga acesso direto de leitura anônima à tabela sensível
REVOKE SELECT ON public.products FROM anon;

-- 2) View segura para o cardápio público (colunas não sensíveis apenas).
-- security_invoker = off: executa com privilégios do proprietário, expondo
-- somente as colunas selecionadas sem revelar custos/estoque/fornecedor.
DROP VIEW IF EXISTS public.view_products_public;

CREATE VIEW public.view_products_public
WITH (security_invoker = off) AS
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

-- 3) Leitura pública liberada apenas para a view segura
GRANT SELECT ON public.view_products_public TO anon, authenticated;