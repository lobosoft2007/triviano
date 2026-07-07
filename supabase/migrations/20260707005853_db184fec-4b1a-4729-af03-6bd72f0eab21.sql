-- Administrador Master = admin/super_admin SEM nível atribuído
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
     AND (SELECT nivel_id FROM public.profiles WHERE id = auth.uid()) IS NULL
$$;

-- Trava rígida: apenas o Master gerencia níveis e matriz
DROP POLICY IF EXISTS "Admins manage access levels of their company" ON public.niveis_acesso;
CREATE POLICY "Master manages access levels of their company"
  ON public.niveis_acesso FOR ALL
  TO authenticated
  USING (public.is_master_admin() AND empresa_id = public.current_empresa_id())
  WITH CHECK (public.is_master_admin() AND empresa_id = public.current_empresa_id());

DROP POLICY IF EXISTS "Admins manage permission matrix of their company" ON public.permissoes_matriz;
CREATE POLICY "Master manages permission matrix of their company"
  ON public.permissoes_matriz FOR ALL
  TO authenticated
  USING (public.is_master_admin() AND empresa_id = public.current_empresa_id())
  WITH CHECK (public.is_master_admin() AND empresa_id = public.current_empresa_id());

-- Master tem acesso total; funcionários seguem a matriz do seu nível
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (
  is_admin boolean,
  is_funcionario boolean,
  acesso_kds_cozinha boolean,
  acesso_atendimento_balcao boolean,
  acesso_mesas boolean,
  acesso_delivery boolean,
  acesso_entrada_estoque boolean,
  acesso_sangria_suprimento boolean,
  acesso_cadastro_produtos boolean,
  acesso_financeiro boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nivel uuid;
BEGIN
  IF public.is_master_admin() THEN
    RETURN QUERY SELECT true, false, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  SELECT p.nivel_id INTO v_nivel FROM public.profiles p WHERE p.id = auth.uid();
  IF v_nivel IS NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false, true,
      m.acesso_kds_cozinha, m.acesso_atendimento_balcao, m.acesso_mesas, m.acesso_delivery,
      m.acesso_entrada_estoque, m.acesso_sangria_suprimento, m.acesso_cadastro_produtos, m.acesso_financeiro
    FROM public.permissoes_matriz m
    WHERE m.nivel_id = v_nivel;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, true, false, false, false, false, false, false, false, false;
  END IF;
END;
$$;

-- Gestão de funcionários restrita ao Master
CREATE OR REPLACE FUNCTION public.admin_list_funcionarios()
RETURNS TABLE (id uuid, full_name text, nivel_id uuid, nome_nivel text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.nivel_id, n.nome_nivel, p.created_at
    FROM public.profiles p
    JOIN public.niveis_acesso n ON n.id = p.nivel_id
    WHERE p.empresa_id = public.current_empresa_id()
    ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_funcionario_nivel(p_user_id uuid, p_nivel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp uuid;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_emp := public.current_empresa_id();
  IF p_nivel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.niveis_acesso WHERE id = p_nivel_id AND empresa_id = v_emp
  ) THEN
    RAISE EXCEPTION 'Nível inválido para esta empresa.';
  END IF;
  UPDATE public.profiles
    SET nivel_id = p_nivel_id
    WHERE id = p_user_id AND empresa_id = v_emp;
END;
$$;