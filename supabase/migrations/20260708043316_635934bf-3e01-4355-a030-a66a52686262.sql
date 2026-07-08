
-- ============================================================
-- FASE 2d — Isolamento multi-tenant: FINANCEIRO / TESOURARIA
-- Tabelas já possuem empresa_id; troca default fixo por
-- current_empresa_id(), adiciona trigger e escopa policies.
-- ============================================================

-- ------------------------------------------------------------
-- Defaults + triggers de preenchimento automático
-- ------------------------------------------------------------
ALTER TABLE public.contas_financeiras ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_contas_financeiras_empresa ON public.contas_financeiras;
CREATE TRIGGER trg_contas_financeiras_empresa BEFORE INSERT ON public.contas_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

ALTER TABLE public.lancamentos_tesouraria ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_lancamentos_tesouraria_empresa ON public.lancamentos_tesouraria;
CREATE TRIGGER trg_lancamentos_tesouraria_empresa BEFORE INSERT ON public.lancamentos_tesouraria
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- ------------------------------------------------------------
-- POLICIES — escopo direto por empresa_id
-- ------------------------------------------------------------

-- CONTAS_FINANCEIRAS
DROP POLICY IF EXISTS "Admins manage contas_financeiras" ON public.contas_financeiras;
CREATE POLICY "Admins manage contas_financeiras" ON public.contas_financeiras
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- LANCAMENTOS_TESOURARIA
DROP POLICY IF EXISTS "Admins manage lancamentos_tesouraria" ON public.lancamentos_tesouraria;
CREATE POLICY "Admins manage lancamentos_tesouraria" ON public.lancamentos_tesouraria
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
