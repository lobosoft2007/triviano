-- Public branding must never expose the full empresas row (address, service fee)
-- to anonymous visitors. Remove the broad anon policy + column grants on the
-- base table and serve safe branding columns through a SECURITY DEFINER function.

DROP POLICY IF EXISTS "Public branding readable" ON public.empresas;

-- Revoke anon's direct (column-level) read access to the base table entirely.
REVOKE SELECT ON public.empresas FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS TABLE(
  id uuid,
  nome_fantasia text,
  logotipo_url text,
  dominio_customizado text,
  ativo boolean,
  cor_primaria text,
  cor_secundaria text,
  modo_fundo text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.nome_fantasia, e.logotipo_url, e.dominio_customizado, e.ativo,
         e.cor_primaria, e.cor_secundaria, e.modo_fundo, e.created_at
  FROM public.empresas e
  WHERE e.ativo = true
  ORDER BY e.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;