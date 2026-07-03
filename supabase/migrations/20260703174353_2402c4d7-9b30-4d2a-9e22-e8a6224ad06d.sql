-- ============================================================
-- 1) Lock function EXECUTE away from anon / PUBLIC.
--    Keep ONLY the two genuinely pre-login menu functions.
-- ============================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT EXECUTE ON FUNCTION public.get_public_menu() TO anon;
GRANT EXECUTE ON FUNCTION public.get_menu_availability() TO anon;

-- ============================================================
-- 2) Column-level masking (idempotent re-assertion).
--    Safe display columns only; internal/sensitive columns stay hidden.
-- ============================================================
GRANT SELECT (id, nome_fantasia, logotipo_url, dominio_customizado, ativo,
              cor_primaria, cor_secundaria, modo_fundo)
  ON public.empresas TO anon, authenticated;
GRANT SELECT (created_at) ON public.empresas TO anon;

GRANT SELECT (id, product_id, nome, permitir_exclusao, sort_order)
  ON public.ingredientes_produto TO anon, authenticated;

GRANT SELECT (id, produto_id, nome, preco, sort_order)
  ON public.produtos_addons TO anon, authenticated;

GRANT SELECT (id, produto_id, nome, preco, sort_order)
  ON public.produtos_free_addons TO anon, authenticated;

-- ============================================================
-- 3) Least-privilege: strip stray write/DDL grants from anon on
--    these read-only-for-anon tables. Column SELECT above is untouched;
--    RLS already blocked these writes, this removes the grant itself.
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.empresas,
     public.ingredientes_produto,
     public.produtos_addons,
     public.produtos_free_addons,
     public.products
  FROM anon;