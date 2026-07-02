-- 1) Domínio customizado por empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS dominio_customizado text UNIQUE;

-- 2) Só o super_admin cria/exclui empresas (novos clientes do SaaS)
DROP POLICY IF EXISTS "Admins gerenciam empresas (insert)" ON public.empresas;
DROP POLICY IF EXISTS "Admins gerenciam empresas (delete)" ON public.empresas;

CREATE POLICY "Super admin cria empresas"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin exclui empresas"
  ON public.empresas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) Super admin enxerga todas as empresas (inclui inativas)
CREATE POLICY "Super admin ve todas as empresas"
  ON public.empresas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));