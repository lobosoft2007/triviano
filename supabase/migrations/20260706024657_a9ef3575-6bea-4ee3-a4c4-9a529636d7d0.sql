-- 1) Public branding view: exposes ONLY non-sensitive branding columns of active companies.
--    Runs with the view owner's privileges (security_invoker not set) so it does not
--    require anon to have any grant on the base table.
CREATE OR REPLACE VIEW public.empresas_public_branding
WITH (security_invoker = false) AS
SELECT
  id,
  nome_fantasia,
  logotipo_url,
  dominio_customizado,
  ativo,
  cor_primaria,
  cor_secundaria,
  modo_fundo,
  created_at
FROM public.empresas
WHERE ativo = true;

GRANT SELECT ON public.empresas_public_branding TO anon, authenticated;

-- 2) Remove anonymous access to the base table entirely (address + service fee must never leak).
DROP POLICY IF EXISTS "Branding publico de empresas" ON public.empresas;

REVOKE SELECT (
  id, nome_fantasia, logotipo_url, ativo, created_at,
  dominio_customizado, cor_primaria, cor_secundaria, modo_fundo
) ON public.empresas FROM anon;

REVOKE ALL ON public.empresas FROM anon;