-- 1) Adicionar empresa_id direto em fluxo_caixa / movimentacoes_caixa e reescrever políticas
ALTER TABLE public.fluxo_caixa
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE public.fluxo_caixa fc
   SET empresa_id = p.empresa_id
  FROM public.profiles p
 WHERE fc.empresa_id IS NULL AND p.id = fc.id_usuario;

ALTER TABLE public.fluxo_caixa
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id(),
  ALTER COLUMN empresa_id SET NOT NULL;

ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE public.movimentacoes_caixa mc
   SET empresa_id = fc.empresa_id
  FROM public.fluxo_caixa fc
 WHERE mc.empresa_id IS NULL AND fc.id = mc.id_caixa;

ALTER TABLE public.movimentacoes_caixa
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id(),
  ALTER COLUMN empresa_id SET NOT NULL;

DROP POLICY IF EXISTS "Admins manage cash flow" ON public.fluxo_caixa;
CREATE POLICY "Admins manage cash flow" ON public.fluxo_caixa
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Admins manage cash movements" ON public.movimentacoes_caixa;
CREATE POLICY "Admins manage cash movements" ON public.movimentacoes_caixa
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 2) Restringir políticas de {public} para {authenticated} (least-privilege).
-- entregadores
DROP POLICY IF EXISTS "entregadores_manage" ON public.entregadores;
CREATE POLICY "entregadores_manage" ON public.entregadores
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "entregadores_self_select" ON public.entregadores;
CREATE POLICY "entregadores_self_select" ON public.entregadores
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- entregas
DROP POLICY IF EXISTS "entregas_manage" ON public.entregas;
CREATE POLICY "entregas_manage" ON public.entregas
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "entregas_entregador_self" ON public.entregas;
CREATE POLICY "entregas_entregador_self" ON public.entregas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (entregador_id IN (SELECT id FROM public.entregadores WHERE user_id = auth.uid()));

-- clientes_cashback
DROP POLICY IF EXISTS "Cliente lê o próprio cashback" ON public.clientes_cashback;
CREATE POLICY "Cliente lê o próprio cashback" ON public.clientes_cashback
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((cliente_id = auth.uid()) OR public.can_manage_empresa(empresa_id));

-- clientes_fiado
DROP POLICY IF EXISTS "Admins manage fiado credit" ON public.clientes_fiado;
CREATE POLICY "Admins manage fiado credit" ON public.clientes_fiado
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- extrato_cashback
DROP POLICY IF EXISTS "Cliente lê o próprio extrato de cashback" ON public.extrato_cashback;
CREATE POLICY "Cliente lê o próprio extrato de cashback" ON public.extrato_cashback
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((cliente_id = auth.uid()) OR public.can_manage_empresa(empresa_id));

-- extrato_fiado
DROP POLICY IF EXISTS "Admins manage fiado statement" ON public.extrato_fiado;
CREATE POLICY "Admins manage fiado statement" ON public.extrato_fiado
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Users view own fiado statement" ON public.extrato_fiado;
CREATE POLICY "Users view own fiado statement" ON public.extrato_fiado
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = id_usuario) OR public.can_manage_empresa(empresa_id));

-- extrato_conta_corrente
DROP POLICY IF EXISTS "Admins manage current account" ON public.extrato_conta_corrente;
CREATE POLICY "Admins manage current account" ON public.extrato_conta_corrente
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Users view own current account" ON public.extrato_conta_corrente;
CREATE POLICY "Users view own current account" ON public.extrato_conta_corrente
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.can_manage_empresa(empresa_id));

-- contadores_senha
DROP POLICY IF EXISTS "Admins veem contadores de senha" ON public.contadores_senha;
CREATE POLICY "Admins veem contadores de senha" ON public.contadores_senha
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_manage_empresa(empresa_id));

-- empresas (SELECT/UPDATE admin scope)
DROP POLICY IF EXISTS "Admins gerenciam empresas (select)" ON public.empresas;
CREATE POLICY "Admins gerenciam empresas (select)" ON public.empresas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_manage_empresa(id));

DROP POLICY IF EXISTS "Admins gerenciam empresas (update)" ON public.empresas;
CREATE POLICY "Admins gerenciam empresas (update)" ON public.empresas
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_manage_empresa(id))
  WITH CHECK (public.can_manage_empresa(id));

-- notificacoes_cliente / order_items: restringir políticas {public} -> {authenticated}
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename, cmd, qual, with_check, permissive
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('notificacoes_cliente','order_items')
       AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO authenticated%s%s',
      r.policyname, r.tablename,
      CASE WHEN r.permissive='PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      CASE r.cmd WHEN 'ALL' THEN 'ALL' WHEN 'SELECT' THEN 'SELECT' WHEN 'INSERT' THEN 'INSERT' WHEN 'UPDATE' THEN 'UPDATE' WHEN 'DELETE' THEN 'DELETE' END,
      CASE WHEN r.qual IS NOT NULL THEN ' USING ('||r.qual||')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK ('||r.with_check||')' ELSE '' END
    );
  END LOOP;
END $$;