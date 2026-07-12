ALTER TABLE public.permissoes_matriz
  ADD COLUMN IF NOT EXISTS acesso_bar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acesso_rh boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acesso_entregas boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_my_permissions();

CREATE FUNCTION public.get_my_permissions()
  RETURNS TABLE(
    is_admin boolean,
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
    acesso_entregas boolean
  )
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_nivel uuid;
BEGIN
  IF public.is_master_admin() THEN
    RETURN QUERY SELECT true, false, true, true, true, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  SELECT p.nivel_id INTO v_nivel FROM public.profiles p WHERE p.id = auth.uid();
  IF v_nivel IS NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false, true,
      m.acesso_kds_cozinha, m.acesso_atendimento_balcao, m.acesso_mesas, m.acesso_delivery,
      m.acesso_entrada_estoque, m.acesso_sangria_suprimento, m.acesso_cadastro_produtos, m.acesso_financeiro,
      m.acesso_bar, m.acesso_rh, m.acesso_entregas
    FROM public.permissoes_matriz m
    WHERE m.nivel_id = v_nivel;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, true, false, false, false, false, false, false, false, false, false, false, false;
  END IF;
END;
$function$;