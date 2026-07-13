
-- 1. Flag "Admin Local" no nível de acesso
ALTER TABLE public.niveis_acesso
  ADD COLUMN IF NOT EXISTS is_admin_local boolean NOT NULL DEFAULT false;

-- 2. Predicado de admin local (master OU nível marcado como admin local)
CREATE OR REPLACE FUNCTION public.is_local_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.niveis_acesso n ON n.id = p.nivel_id
      WHERE p.id = auth.uid()
        AND n.is_admin_local = true
    );
$function$;

-- 3. get_my_permissions passa a retornar is_manager
DROP FUNCTION IF EXISTS public.get_my_permissions();
CREATE FUNCTION public.get_my_permissions()
RETURNS TABLE(
  is_admin boolean,
  is_manager boolean,
  is_funcionario boolean,
  acesso_kds_cozinha boolean,
  acesso_atendimento_balcao boolean,
  acesso_mesas boolean,
  acesso_delivery boolean,
  acesso_entrada_estoque boolean,
  acesso_sangria_suprimento boolean,
  acesso_cadastro_produtos boolean,
  acesso_financeiro boolean,
  acesso_bar boolean,
  acesso_rh boolean,
  acesso_entregas boolean,
  acesso_abrir_fechar_caixa boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nivel uuid;
  v_admin_local boolean := false;
BEGIN
  IF public.is_master_admin() THEN
    RETURN QUERY SELECT true, true, false, true, true, true, true, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  SELECT p.nivel_id INTO v_nivel FROM public.profiles p WHERE p.id = auth.uid();
  IF v_nivel IS NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  SELECT n.is_admin_local INTO v_admin_local FROM public.niveis_acesso n WHERE n.id = v_nivel;

  -- Admin local: acesso total dentro da empresa.
  IF v_admin_local THEN
    RETURN QUERY SELECT false, true, true, true, true, true, true, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false, false, true,
      m.acesso_kds_cozinha, m.acesso_atendimento_balcao, m.acesso_mesas, m.acesso_delivery,
      m.acesso_entrada_estoque, m.acesso_sangria_suprimento, m.acesso_cadastro_produtos, m.acesso_financeiro,
      m.acesso_bar, m.acesso_rh, m.acesso_entregas, m.acesso_abrir_fechar_caixa
    FROM public.permissoes_matriz m
    WHERE m.nivel_id = v_nivel;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, true, false, false, false, false, false, false, false, false, false, false, false, false;
  END IF;
END;
$function$;

-- 4. RLS: níveis e matriz passam a aceitar admin local (mantendo escopo por empresa)
DROP POLICY IF EXISTS "Master manages access levels of their company" ON public.niveis_acesso;
CREATE POLICY "Local admin manages access levels of their company"
  ON public.niveis_acesso
  FOR ALL
  TO authenticated
  USING (public.is_local_admin() AND empresa_id = public.current_empresa_id())
  WITH CHECK (public.is_local_admin() AND empresa_id = public.current_empresa_id());

DROP POLICY IF EXISTS "Master manages permission matrix of their company" ON public.permissoes_matriz;
CREATE POLICY "Local admin manages permission matrix of their company"
  ON public.permissoes_matriz
  FOR ALL
  TO authenticated
  USING (
    public.is_local_admin()
    AND EXISTS (
      SELECT 1 FROM public.niveis_acesso n
      WHERE n.id = permissoes_matriz.nivel_id
        AND n.empresa_id = public.current_empresa_id()
    )
  )
  WITH CHECK (
    public.is_local_admin()
    AND EXISTS (
      SELECT 1 FROM public.niveis_acesso n
      WHERE n.id = permissoes_matriz.nivel_id
        AND n.empresa_id = public.current_empresa_id()
    )
  );

-- 5. RPCs de funcionários aceitam admin local
CREATE OR REPLACE FUNCTION public.admin_list_funcionarios()
RETURNS TABLE(id uuid, full_name text, nivel_id uuid, nome_nivel text, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_local_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.nivel_id, n.nome_nivel, p.created_at
    FROM public.profiles p
    JOIN public.niveis_acesso n ON n.id = p.nivel_id
    WHERE p.empresa_id = public.current_empresa_id()
    ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_funcionario_nivel(p_user_id uuid, p_nivel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_emp uuid;
BEGIN
  IF NOT public.is_local_admin() THEN
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
$function$;

-- 6. Saneamento: níveis "Proprietário" existentes viram admin local com matriz 100% true
UPDATE public.niveis_acesso
  SET is_admin_local = true
  WHERE nome_nivel = 'Proprietário';

UPDATE public.permissoes_matriz m
  SET acesso_kds_cozinha = true,
      acesso_bar = true,
      acesso_atendimento_balcao = true,
      acesso_mesas = true,
      acesso_delivery = true,
      acesso_entregas = true,
      acesso_entrada_estoque = true,
      acesso_sangria_suprimento = true,
      acesso_cadastro_produtos = true,
      acesso_financeiro = true,
      acesso_rh = true,
      acesso_abrir_fechar_caixa = true
  FROM public.niveis_acesso n
  WHERE n.id = m.nivel_id AND n.is_admin_local = true;
