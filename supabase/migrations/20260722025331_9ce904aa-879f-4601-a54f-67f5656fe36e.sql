DROP POLICY IF EXISTS "pos_app_releases read anon" ON public.pos_app_releases;
REVOKE SELECT ON public.pos_app_releases FROM anon;