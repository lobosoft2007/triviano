
-- 1) Escopo obrigatório de empresa ao inserir categorias.
--    Impede que o default fixo (Clube23) ou um valor forjado crie categorias
--    fora da empresa do operador. SuperAdmin pode inserir para qualquer empresa.
CREATE OR REPLACE FUNCTION public.categories_set_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_set_empresa ON public.categories;
CREATE TRIGGER trg_categories_set_empresa
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.categories_set_empresa();

-- 2) Leitura restritiva por tenant.
--    Substitui a política que liberava categorias de QUALQUER empresa ativa
--    para usuários autenticados (origem do vazamento no painel admin).
DROP POLICY IF EXISTS "Public can view active-tenant categories" ON public.categories;

-- Visitantes não logados (loja pública): veem o cardápio da empresa ativa
-- que estão acessando (a query da vitrine já filtra por host).
CREATE POLICY "Anon can view active-tenant categories"
  ON public.categories
  FOR SELECT
  TO anon
  USING (public.is_empresa_ativa(empresa_id));

-- Usuários logados: apenas a própria empresa (clientes e Admin Local) ou
-- todas, no caso de super_admin (via can_manage_empresa).
CREATE POLICY "Members view own-tenant categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.can_manage_empresa(empresa_id)
  );
