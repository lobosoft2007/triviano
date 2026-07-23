CREATE OR REPLACE FUNCTION public.create_printer_agent_token(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF NOT (
    public.is_master_admin()
    OR public.can_manage_empresa(v_empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: usuário sem permissão para criar agentes nesta empresa.';
  END IF;

  v_token := 'tpa_' || encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.printer_agent_tokens (empresa_id, nome, token_hash, ativo)
  VALUES (v_empresa_id, trim(p_nome), v_hash, true);

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_printer_agent_token(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.printer_agent_tokens
  WHERE id = p_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Agente de impressão não encontrado.';
  END IF;

  IF NOT (
    public.is_master_admin()
    OR public.can_manage_empresa(v_empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: usuário sem permissão para revogar agentes nesta empresa.';
  END IF;

  UPDATE public.printer_agent_tokens
  SET ativo = false
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_printer_agent_token(uuid) TO authenticated;

DROP POLICY IF EXISTS "Master admin lê agent tokens" ON public.printer_agent_tokens;
DROP POLICY IF EXISTS "Master admin insere agent tokens" ON public.printer_agent_tokens;
DROP POLICY IF EXISTS "Master admin atualiza agent tokens" ON public.printer_agent_tokens;
DROP POLICY IF EXISTS "Master admin deleta agent tokens" ON public.printer_agent_tokens;
DROP POLICY IF EXISTS "tokens_admin_master" ON public.printer_agent_tokens;
DROP POLICY IF EXISTS "tokens_empresa_manager" ON public.printer_agent_tokens;

CREATE POLICY "tokens_admin_master"
ON public.printer_agent_tokens
FOR ALL
TO authenticated
USING (
  public.is_master_admin()
)
WITH CHECK (
  public.is_master_admin()
);

CREATE POLICY "tokens_empresa_manager"
ON public.printer_agent_tokens
FOR ALL
TO authenticated
USING (
  empresa_id = public.current_empresa_id()
  AND public.can_manage_empresa(empresa_id)
)
WITH CHECK (
  empresa_id = public.current_empresa_id()
  AND public.can_manage_empresa(empresa_id)
);