REVOKE ALL ON FUNCTION public.finalize_comanda_split(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_comanda_split(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_comanda_split(uuid, jsonb) TO service_role;