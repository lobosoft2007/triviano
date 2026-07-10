ALTER TABLE public.config_pagamentos
  ADD COLUMN IF NOT EXISTS aceita_pix_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS aceita_cartao_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS aceita_na_entrega boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_mp_public_config(text);

CREATE OR REPLACE FUNCTION public.get_mp_public_config(p_host text DEFAULT NULL)
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cp.empresa_id, cp.mp_public_key, cp.mp_ambiente, cp.mp_ativo,
         cp.aceita_pix_online, cp.aceita_cartao_online, cp.aceita_na_entrega
  FROM public.config_pagamentos cp
  WHERE cp.empresa_id = COALESCE(
          public.resolve_empresa_id_by_host(p_host),
          public.current_empresa_id(),
          '00000000-0000-0000-0000-000000000023'::uuid)
    AND cp.ativo = true
  ORDER BY cp.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_mp_public_config(text) TO anon, authenticated, service_role;