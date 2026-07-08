DROP FUNCTION IF EXISTS public.get_public_branding();

CREATE OR REPLACE FUNCTION public.get_public_branding()
 RETURNS TABLE(id uuid, nome_fantasia text, logotipo_url text, dominio_customizado text, subdominio text, ativo boolean, cor_primaria text, cor_secundaria text, modo_fundo text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.nome_fantasia, e.logotipo_url, e.dominio_customizado, e.subdominio, e.ativo,
         e.cor_primaria, e.cor_secundaria, e.modo_fundo, e.created_at
  FROM public.empresas e
  WHERE e.ativo = true
  ORDER BY e.created_at ASC
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;