REVOKE ALL ON FUNCTION public.create_printer_agent_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_printer_agent_token(text) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_printer_agent_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_printer_agent_token(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_printer_agent_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_printer_agent_token(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';