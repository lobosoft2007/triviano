REVOKE EXECUTE ON FUNCTION public.get_pix_static_config(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pix_static_config(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pix_static_config(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pix_static_config(text) TO service_role;