CREATE OR REPLACE FUNCTION public.claim_tenant_by_host(p_host text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_current uuid;
  v_has_orders boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT empresa_id INTO v_current FROM public.profiles WHERE id = v_uid;

  -- Staff/admins ficam permanentemente vinculados à sua empresa: nunca re-vincula.
  IF public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin') THEN
    RETURN v_current;
  END IF;

  v_target := public.resolve_empresa_id_by_host(p_host);

  -- Host sem tenant reconhecível (preview/dev/domínio desconhecido) ou empresa
  -- inativa: não faz nada.
  IF v_target IS NULL OR NOT public.is_empresa_ativa(v_target) THEN
    RETURN v_current;
  END IF;

  IF v_current = v_target THEN
    RETURN v_current;
  END IF;

  -- Só reivindica contas de cliente NOVAS (sem nenhum pedido no estabelecimento
  -- atual). Assim vinculamos usuários novos (magic link / OAuth) ao tenant da
  -- URL onde entraram, sem nunca arrancar um cliente que já tem histórico.
  SELECT EXISTS (SELECT 1 FROM public.orders WHERE user_id = v_uid) INTO v_has_orders;
  IF v_has_orders THEN
    RETURN v_current;
  END IF;

  UPDATE public.profiles SET empresa_id = v_target WHERE id = v_uid;
  RETURN v_target;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_tenant_by_host(text) TO authenticated;