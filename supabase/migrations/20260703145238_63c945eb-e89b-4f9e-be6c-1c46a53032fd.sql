-- Tighten empresas SELECT for regular authenticated users so they can only read
-- pure branding/theming columns. The mesa service fee (taxa_servico_mesa) is
-- still needed at checkout, so it is served through a SECURITY DEFINER function
-- that returns only branding + the fee for the active company.

-- 1) Remove the direct column grant so authenticated users can no longer read
--    the service fee straight from the table.
REVOKE SELECT (taxa_servico_mesa) ON public.empresas FROM authenticated;

-- 2) Checkout-safe config: branding + service fee for the active company only.
CREATE OR REPLACE FUNCTION public.get_empresa_checkout_config()
RETURNS TABLE(
  id uuid,
  nome_fantasia text,
  logotipo_url text,
  dominio_customizado text,
  ativo boolean,
  cor_primaria text,
  cor_secundaria text,
  modo_fundo text,
  taxa_servico_mesa numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.id, e.nome_fantasia, e.logotipo_url, e.dominio_customizado, e.ativo,
         e.cor_primaria, e.cor_secundaria, e.modo_fundo, e.taxa_servico_mesa
  FROM public.empresas e
  WHERE e.ativo = true
  ORDER BY e.created_at ASC
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_empresa_checkout_config() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_empresa_checkout_config() TO authenticated;