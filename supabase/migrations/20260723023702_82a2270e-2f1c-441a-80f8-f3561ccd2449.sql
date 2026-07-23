CREATE OR REPLACE FUNCTION public.create_printer_agent_token(p_nome text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_token text;
  v_hash text;
BEGIN
  IF NOT (public.is_master_admin() OR public.can_manage_empresa()) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;
  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Informe um nome para o agente.';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.printer_agent_tokens(empresa_id, nome, token_hash)
  VALUES (v_empresa, btrim(p_nome), v_hash);

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_printer_agent_token(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_master_admin() OR public.can_manage_empresa()) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.printer_agent_tokens
     SET ativo = false
   WHERE id = p_id
     AND empresa_id = public.current_empresa_id();
END;
$function$;