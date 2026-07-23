CREATE OR REPLACE FUNCTION public.create_printer_agent_token(nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_empresa_id uuid;
  v_token text;
  v_hash text;
BEGIN
  v_empresa_id := public.current_empresa_id();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada para o usuário atual.';
  END IF;

  IF nullif(trim(nome), '') IS NULL THEN
    RAISE EXCEPTION 'Informe um nome para o agente.';
  END IF;

  IF NOT (
    public.is_master_admin()
    OR public.can_manage_empresa(v_empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: usuário sem permissão para criar agentes nesta empresa.';
  END IF;

  v_token := 'tpa_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.printer_agent_tokens (empresa_id, nome, token_hash, ativo)
  VALUES (v_empresa_id, trim(nome), v_hash, true);

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_printer_agent_token(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_nome text;
BEGIN
  v_nome := coalesce(payload ->> 'nome', payload ->> 'p_nome');
  RETURN public.create_printer_agent_token(v_nome);
END;
$$;

REVOKE ALL ON FUNCTION public.create_printer_agent_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_printer_agent_token(text) FROM anon;
REVOKE ALL ON FUNCTION public.create_printer_agent_token(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_printer_agent_token(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';