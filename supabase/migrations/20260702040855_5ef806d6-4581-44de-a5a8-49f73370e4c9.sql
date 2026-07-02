-- =========================================================
-- Lint 0028: fechar execução anônima de funções SECURITY DEFINER
-- 1) Revoga EXECUTE de PUBLIC e anon em TODAS as funções do schema public
-- 2) Concede EXECUTE apenas a authenticated para as RPCs de aplicação
-- 3) Funções internas/gatilho ficam restritas ao motor interno (service_role/postgres)
-- =========================================================

-- ---- Trigger / internal-only functions: sem acesso via API ----
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.explode_order_stock(uuid) FROM PUBLIC, anon, authenticated;

-- ---- has_role: usada pelas policies RLS (apenas authenticated) ----
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- ---- RPCs chamadas pelo app: somente usuários autenticados ----
REVOKE EXECUTE ON FUNCTION public.get_active_pix_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_pix_config() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.redeem_cashback_for_order(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_cashback_for_order(uuid, numeric) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.registrar_entrada_avulsa(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_avulsa(uuid, uuid, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.finalize_order_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_order_paid(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_patrimonio_estoque() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patrimonio_estoque() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.criar_ordem_compra(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_ordem_compra(uuid, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) TO authenticated;

-- set_cliente_bloqueado estava exposta a PUBLIC/anon (vulnerabilidade principal)
REVOKE EXECUTE ON FUNCTION public.set_cliente_bloqueado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cliente_bloqueado(uuid, boolean) TO authenticated;