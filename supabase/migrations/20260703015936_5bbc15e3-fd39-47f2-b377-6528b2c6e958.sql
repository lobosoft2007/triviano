-- LINT 0011: Fixar search_path nas funções auxiliares da fila de e-mails
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';

-- LINT 0028: Revogar execução anônima/pública das funções SECURITY DEFINER internas
-- (get_public_menu é intencionalmente público e NÃO é alterado)
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;