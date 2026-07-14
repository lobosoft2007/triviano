CREATE OR REPLACE FUNCTION public.get_pix_static_config(p_host text DEFAULT NULL::text)
RETURNS TABLE(empresa_id uuid, chave_pix text, nome_recebedor text, cidade_recebedor text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    cp.empresa_id,
    COALESCE(cp.chave_pix_padrao, '') AS chave_pix,
    COALESCE(cp.nome_recebedor, '') AS nome_recebedor,
    COALESCE(cp.cidade_recebedor, '') AS cidade_recebedor
  FROM public.config_pagamentos cp
  WHERE cp.empresa_id = COALESCE(
          public.resolve_empresa_id_by_host(p_host),
          public.current_empresa_id(),
          '00000000-0000-0000-0000-000000000023'::uuid)
    AND cp.ativo = true
  ORDER BY cp.updated_at DESC
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pix_static_config(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pix_static_config(text) TO service_role;