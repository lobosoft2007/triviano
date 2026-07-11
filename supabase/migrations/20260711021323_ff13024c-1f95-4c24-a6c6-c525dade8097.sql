-- 1) Detecta o ambiente (prod/test) a partir do host de origem.
CREATE OR REPLACE FUNCTION public.mp_env_for_host(p_host text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_host IS NULL OR p_host = '' THEN 'test'
    WHEN lower(p_host) = 'localhost' THEN 'test'
    WHEN lower(p_host) LIKE '127.%' THEN 'test'
    WHEN lower(p_host) LIKE '%id-preview--%' THEN 'test'
    WHEN lower(p_host) LIKE '%.lovable.app' THEN 'test'
    WHEN lower(p_host) LIKE '%.lovable.dev' THEN 'test'
    WHEN lower(p_host) LIKE '%.lovableproject.com' THEN 'test'
    WHEN lower(p_host) LIKE '%.local' THEN 'test'
    WHEN lower(p_host) LIKE '%.com.br' THEN 'prod'
    WHEN lower(p_host) LIKE '%.com' THEN 'prod'
    ELSE 'test'
  END;
$function$;

GRANT EXECUTE ON FUNCTION public.mp_env_for_host(text) TO anon, authenticated, service_role;

-- 2) Config pública com seleção automática da chave por ambiente.
--    Removemos a versão antiga (1 argumento) para evitar ambiguidade de overload.
DROP FUNCTION IF EXISTS public.get_mp_public_config(text);

CREATE OR REPLACE FUNCTION public.get_mp_public_config(
  p_host text DEFAULT NULL::text,
  p_ambiente text DEFAULT NULL::text
)
RETURNS TABLE(
  empresa_id uuid,
  public_key text,
  ambiente text,
  ativo boolean,
  aceita_pix_online boolean,
  aceita_cartao_online boolean,
  aceita_na_entrega boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    cp.empresa_id,
    COALESCE(
      NULLIF(
        CASE
          WHEN COALESCE(p_ambiente, public.mp_env_for_host(p_host)) = 'prod'
            THEN cp.mp_public_key_prod
          ELSE cp.mp_public_key_test
        END, ''),
      NULLIF(cp.mp_public_key, '')
    ) AS public_key,
    COALESCE(p_ambiente, public.mp_env_for_host(p_host)) AS ambiente,
    cp.mp_ativo,
    cp.aceita_pix_online,
    cp.aceita_cartao_online,
    cp.aceita_na_entrega
  FROM public.config_pagamentos cp
  WHERE cp.empresa_id = COALESCE(
          public.resolve_empresa_id_by_host(p_host),
          public.current_empresa_id(),
          '00000000-0000-0000-0000-000000000023'::uuid)
    AND cp.ativo = true
  ORDER BY cp.updated_at DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_mp_public_config(text, text) TO anon, authenticated, service_role;