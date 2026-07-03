-- =====================================================================
-- Security hardening: restrict what ANONYMOUS visitors can read
-- from menu/company tables (hide internal cost & recipe columns).
-- Authenticated access is unchanged so admin editors keep working.
-- =====================================================================

-- 1) empresas: hide service fee (taxa_servico_mesa) and full address
--    from anonymous visitors; keep branding columns public.
DROP POLICY IF EXISTS "Empresas ativas são públicas" ON public.empresas;

CREATE POLICY "Empresas ativas visiveis a autenticados"
  ON public.empresas FOR SELECT TO authenticated
  USING (ativo = true);

CREATE POLICY "Branding publico de empresas"
  ON public.empresas FOR SELECT TO anon
  USING (ativo = true);

REVOKE SELECT ON public.empresas FROM anon;
GRANT SELECT (id, nome_fantasia, logotipo_url, dominio_customizado, ativo)
  ON public.empresas TO anon;

-- 2) ingredientes_produto: expose only the public label columns to anon,
--    hiding internal recipe references (insumo_id, subproduto_id,
--    quantidade, price_option_id).
REVOKE SELECT ON public.ingredientes_produto FROM anon;
GRANT SELECT (id, product_id, nome, permitir_exclusao, sort_order)
  ON public.ingredientes_produto TO anon;

-- 3) produtos_addons / produtos_free_addons: expose only name + price to
--    anon, hiding internal stock references (insumo_id, quantidade).
REVOKE SELECT ON public.produtos_addons FROM anon;
GRANT SELECT (id, produto_id, nome, preco, sort_order)
  ON public.produtos_addons TO anon;

REVOKE SELECT ON public.produtos_free_addons FROM anon;
GRANT SELECT (id, produto_id, nome, preco, sort_order)
  ON public.produtos_free_addons TO anon;