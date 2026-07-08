
-- empresas: admin restrito à própria empresa (super_admin mantém acesso global)
DROP POLICY IF EXISTS "Admins gerenciam empresas (select)" ON public.empresas;
CREATE POLICY "Admins gerenciam empresas (select)" ON public.empresas
  FOR SELECT USING (public.can_manage_empresa(id));

DROP POLICY IF EXISTS "Admins gerenciam empresas (update)" ON public.empresas;
CREATE POLICY "Admins gerenciam empresas (update)" ON public.empresas
  FOR UPDATE USING (public.can_manage_empresa(id))
  WITH CHECK (public.can_manage_empresa(id));
