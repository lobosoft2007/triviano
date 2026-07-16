CREATE OR REPLACE FUNCTION public.get_my_permissions()
 RETURNS TABLE(is_admin boolean, is_manager boolean, is_funcionario boolean, acesso_kds_cozinha boolean, acesso_atendimento_balcao boolean, acesso_mesas boolean, acesso_delivery boolean, acesso_entrada_estoque boolean, acesso_sangria_suprimento boolean, acesso_cadastro_produtos boolean, acesso_financeiro boolean, acesso_bar boolean, acesso_rh boolean, acesso_entregas boolean, acesso_abrir_fechar_caixa boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_nivel uuid;
  v_admin_local boolean := false;
  v_bloqueado boolean := false;
BEGIN
  IF public.is_master_admin() THEN
    RETURN QUERY SELECT true, true, false, true, true, true, true, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  SELECT p.nivel_id, COALESCE(p.bloqueado, false)
    INTO v_nivel, v_bloqueado
    FROM public.profiles p WHERE p.id = auth.uid();

  IF v_bloqueado AND v_nivel IS NOT NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  IF v_nivel IS NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  SELECT n.is_admin_local INTO v_admin_local FROM public.niveis_acesso n WHERE n.id = v_nivel;

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

DROP FUNCTION IF EXISTS public.admin_list_funcionarios();

CREATE OR REPLACE FUNCTION public.admin_list_funcionarios()
 RETURNS TABLE(id uuid, full_name text, nivel_id uuid, nome_nivel text, bloqueado boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_local_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.nivel_id, n.nome_nivel, COALESCE(p.bloqueado, false), p.created_at
    FROM public.profiles p
    JOIN public.niveis_acesso n ON n.id = p.nivel_id
    WHERE p.empresa_id = public.current_empresa_id()
    ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_funcionario_bloqueado(
  p_user_id uuid, p_bloqueado boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_target_empresa uuid;
  v_target_nivel uuid;
BEGIN
  IF NOT public.is_local_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_empresa := public.current_empresa_id();
  SELECT empresa_id, nivel_id INTO v_target_empresa, v_target_nivel
    FROM public.profiles WHERE id = p_user_id;
  IF v_target_empresa IS NULL OR v_target_empresa <> v_empresa THEN
    RAISE EXCEPTION 'Funcionário não encontrado nesta empresa.';
  END IF;
  IF v_target_nivel IS NULL THEN
    RAISE EXCEPTION 'Este usuário não é um funcionário.';
  END IF;
  UPDATE public.profiles SET bloqueado = p_bloqueado WHERE id = p_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_set_funcionario_bloqueado(uuid, boolean) TO authenticated;