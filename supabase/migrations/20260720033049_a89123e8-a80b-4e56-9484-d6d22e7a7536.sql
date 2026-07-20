
DROP FUNCTION IF EXISTS public.get_my_permissions();
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(
  is_admin boolean, is_manager boolean, is_funcionario boolean,
  acesso_kds_cozinha boolean, acesso_atendimento_balcao boolean, acesso_mesas boolean,
  acesso_delivery boolean, acesso_entrada_estoque boolean, acesso_sangria_suprimento boolean,
  acesso_cadastro_produtos boolean, acesso_financeiro boolean, acesso_bar boolean,
  acesso_rh boolean, acesso_entregas boolean, acesso_abrir_fechar_caixa boolean,
  acesso_recepcao boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nivel uuid;
  v_admin_local boolean := false;
  v_bloqueado boolean := false;
BEGIN
  IF public.is_master_admin() THEN
    RETURN QUERY SELECT true, true, false, true, true, true, true, true, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  SELECT p.nivel_id, COALESCE(p.bloqueado, false)
    INTO v_nivel, v_bloqueado
    FROM public.profiles p WHERE p.id = auth.uid();

  IF v_bloqueado AND v_nivel IS NOT NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  SELECT n.is_admin_local INTO v_admin_local FROM public.niveis_acesso n WHERE n.id = v_nivel;

  IF v_admin_local THEN
    RETURN QUERY SELECT false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false, false, true,
      m.acesso_kds_cozinha, m.acesso_atendimento_balcao, m.acesso_mesas, m.acesso_delivery,
      m.acesso_entrada_estoque, m.acesso_sangria_suprimento, m.acesso_cadastro_produtos, m.acesso_financeiro,
      m.acesso_bar, m.acesso_rh, m.acesso_entregas, m.acesso_abrir_fechar_caixa,
      COALESCE(m.acesso_recepcao, false)
    FROM public.permissoes_matriz m
    WHERE m.nivel_id = v_nivel;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;
