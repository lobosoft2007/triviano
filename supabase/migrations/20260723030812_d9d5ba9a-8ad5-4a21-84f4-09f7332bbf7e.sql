CREATE OR REPLACE FUNCTION public.create_printer_agent_token(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_nome text;
BEGIN
  v_nome := coalesce(payload->>'nome', payload->>'p_nome');
  RETURN public.create_printer_agent_token(v_nome);
END;
$$;

REVOKE ALL ON FUNCTION public.create_printer_agent_token(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_printer_agent_token(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';