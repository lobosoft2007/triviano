
CREATE OR REPLACE FUNCTION public.get_pos_build_branding(p_subdominio text)
RETURNS TABLE(empresa_id uuid, subdominio text, app_label text, icon_path text, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.subdominio,
         COALESCE(b.app_label, e.nome_fantasia, 'Triviano Garçom'),
         b.icon_path, b.updated_at
  FROM public.empresas e
  LEFT JOIN public.pos_app_branding b ON b.empresa_id = e.id
  WHERE lower(e.subdominio) = lower(p_subdominio)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_pos_build_branding(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_build_branding(text) TO service_role;
