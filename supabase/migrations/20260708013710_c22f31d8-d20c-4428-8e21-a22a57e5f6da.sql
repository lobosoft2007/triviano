-- Fase 1: fundação do roteamento multi-tenant por subdomínio.
-- Cada empresa (restaurante) ganha um "slug" que será usado no subdomínio
-- operacional (ex.: clube23-app / clube23-adm / clube23-pdv.triviano.com.br)
-- e como identificador para resolver o tenant a partir da URL.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS subdominio text;

-- Slug único e case-insensitive (quando preenchido).
CREATE UNIQUE INDEX IF NOT EXISTS empresas_subdominio_lower_uidx
  ON public.empresas (lower(subdominio))
  WHERE subdominio IS NOT NULL;

-- Anônimos precisam ler o slug para o roteamento por subdomínio.
-- get_public_branding já expõe branding seguro; adicionamos uma variante
-- que resolve UMA empresa a partir do slug do subdomínio.
CREATE OR REPLACE FUNCTION public.get_public_branding_by_slug(p_slug text)
 RETURNS TABLE(
   id uuid, nome_fantasia text, logotipo_url text, dominio_customizado text,
   ativo boolean, cor_primaria text, cor_secundaria text, modo_fundo text,
   subdominio text, created_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.nome_fantasia, e.logotipo_url, e.dominio_customizado, e.ativo,
         e.cor_primaria, e.cor_secundaria, e.modo_fundo, e.subdominio, e.created_at
  FROM public.empresas e
  WHERE e.ativo = true
    AND p_slug IS NOT NULL
    AND lower(e.subdominio) = lower(p_slug)
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_branding_by_slug(text) TO anon, authenticated;