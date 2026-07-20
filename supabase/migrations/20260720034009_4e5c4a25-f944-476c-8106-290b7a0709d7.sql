
-- 1) user_roles: negar explicitamente escrita por usuários autenticados/anônimos
--    (service_role e SECURITY DEFINER continuam funcionando pois bypass de RLS)
DROP POLICY IF EXISTS "Deny client writes to user_roles" ON public.user_roles;
CREATE POLICY "Deny client writes to user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Mantém a leitura das próprias roles (a policy RESTRICTIVE acima não afeta SELECT
-- porque o RESTRICTIVE combina com PERMISSIVE — precisamos permitir SELECT explicitamente).
-- Recriamos a permissiva de SELECT e adicionamos um RESTRICTIVE só para escrita.
DROP POLICY IF EXISTS "Deny client writes to user_roles" ON public.user_roles;
CREATE POLICY "Deny INSERT on user_roles from clients"
  ON public.user_roles AS RESTRICTIVE FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "Deny UPDATE on user_roles from clients"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE
  TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "Deny DELETE on user_roles from clients"
  ON public.user_roles AS RESTRICTIVE FOR DELETE
  TO authenticated, anon
  USING (false);

-- 2) empresas: garantir que anônimos jamais leiam/escrevam (reforço explícito)
REVOKE ALL ON public.empresas FROM anon;
