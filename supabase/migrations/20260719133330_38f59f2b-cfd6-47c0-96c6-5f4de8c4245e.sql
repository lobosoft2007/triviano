
-- config_impressoras
DROP POLICY IF EXISTS "Admins can delete printers" ON public.config_impressoras;
DROP POLICY IF EXISTS "Admins can insert printers" ON public.config_impressoras;
DROP POLICY IF EXISTS "Admins can update printers" ON public.config_impressoras;
DROP POLICY IF EXISTS "Admins can view printers" ON public.config_impressoras;
CREATE POLICY "Admins can delete printers" ON public.config_impressoras FOR DELETE TO authenticated USING (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can insert printers" ON public.config_impressoras FOR INSERT TO authenticated WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can update printers" ON public.config_impressoras FOR UPDATE TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can view printers" ON public.config_impressoras FOR SELECT TO authenticated USING (can_manage_empresa(empresa_id));

-- entregador_sessoes
DROP POLICY IF EXISTS "entregador_sessoes_manage" ON public.entregador_sessoes;
CREATE POLICY "entregador_sessoes_manage" ON public.entregador_sessoes FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- historico_cashback
DROP POLICY IF EXISTS "Admins manage cashback history" ON public.historico_cashback;
DROP POLICY IF EXISTS "Users view own cashback history" ON public.historico_cashback;
CREATE POLICY "Admins manage cashback history" ON public.historico_cashback FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Users view own cashback history" ON public.historico_cashback FOR SELECT TO authenticated USING ((auth.uid() = id_usuario) OR can_manage_empresa(empresa_id));

-- ifood_event_log
DROP POLICY IF EXISTS "ifood_event_log_manage" ON public.ifood_event_log;
CREATE POLICY "ifood_event_log_manage" ON public.ifood_event_log FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- ifood_merchants
DROP POLICY IF EXISTS "ifood_merchants_manage" ON public.ifood_merchants;
CREATE POLICY "ifood_merchants_manage" ON public.ifood_merchants FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- ifood_produto_map
DROP POLICY IF EXISTS "ifood_produto_map_manage" ON public.ifood_produto_map;
CREATE POLICY "ifood_produto_map_manage" ON public.ifood_produto_map FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));
