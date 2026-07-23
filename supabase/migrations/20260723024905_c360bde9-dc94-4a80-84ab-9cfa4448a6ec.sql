-- 1) Corrigir RPCs para chamar can_manage_empresa com empresa_id
CREATE OR REPLACE FUNCTION public.create_printer_agent_token(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_token text;
  v_hash text;
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada para o usuário.';
  END IF;
  IF NOT (public.is_master_admin() OR public.can_manage_empresa(v_empresa)) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas administradores da empresa.';
  END IF;
  IF p_nome IS NULL OR length(btrim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do agente é obrigatório.';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.printer_agent_tokens (empresa_id, nome, token_hash, ativo)
  VALUES (v_empresa, btrim(p_nome), v_hash, true);

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_printer_agent_token(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada para o usuário.';
  END IF;
  IF NOT (public.is_master_admin() OR public.can_manage_empresa(v_empresa)) THEN
    RAISE EXCEPTION 'Acesso restrito: apenas administradores da empresa.';
  END IF;

  UPDATE public.printer_agent_tokens
     SET ativo = false
   WHERE id = p_id
     AND empresa_id = v_empresa;
END;
$$;

-- 2) Ajustar RLS de printer_agent_tokens: master admin OU gerente da empresa
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
     WHERE polrelid = 'public.printer_agent_tokens'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.printer_agent_tokens', r.polname);
  END LOOP;
END $$;

CREATE POLICY "tokens_admin_master"
  ON public.printer_agent_tokens
  FOR ALL
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

CREATE POLICY "tokens_empresa_manager"
  ON public.printer_agent_tokens
  FOR ALL
  TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.can_manage_empresa(public.current_empresa_id())
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.can_manage_empresa(public.current_empresa_id())
  );