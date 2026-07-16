
-- config_pagamentos
DROP POLICY IF EXISTS "Admins manage payment config" ON public.config_pagamentos;
CREATE POLICY "Admins manage payment config" ON public.config_pagamentos
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- insumos
DROP POLICY IF EXISTS "Admins can view insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admins can insert insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admins can update insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admins can delete insumos" ON public.insumos;
CREATE POLICY "Admins can view insumos" ON public.insumos FOR SELECT TO authenticated USING (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can insert insumos" ON public.insumos FOR INSERT TO authenticated WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can update insumos" ON public.insumos FOR UPDATE TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can delete insumos" ON public.insumos FOR DELETE TO authenticated USING (can_manage_empresa(empresa_id));

-- fornecedores
DROP POLICY IF EXISTS "Admins can view fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admins can insert fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admins can update fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admins can delete fornecedores" ON public.fornecedores;
CREATE POLICY "Admins can view fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));
CREATE POLICY "Admins can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (can_manage_empresa(empresa_id));

-- contas_financeiras
DROP POLICY IF EXISTS "Admins manage contas_financeiras" ON public.contas_financeiras;
CREATE POLICY "Admins manage contas_financeiras" ON public.contas_financeiras FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- ordens_compra
DROP POLICY IF EXISTS "Admins manage ordens_compra" ON public.ordens_compra;
CREATE POLICY "Admins manage ordens_compra" ON public.ordens_compra FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- itens_ordem_compra
DROP POLICY IF EXISTS "Admins manage itens_ordem_compra" ON public.itens_ordem_compra;
CREATE POLICY "Admins manage itens_ordem_compra" ON public.itens_ordem_compra FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_compra o WHERE o.id = itens_ordem_compra.id_ordem_compra AND can_manage_empresa(o.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ordens_compra o WHERE o.id = itens_ordem_compra.id_ordem_compra AND can_manage_empresa(o.empresa_id)));

-- itens_entrada_produto
DROP POLICY IF EXISTS "Admins manage itens_entrada_produto" ON public.itens_entrada_produto;
CREATE POLICY "Admins manage itens_entrada_produto" ON public.itens_entrada_produto FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entradas_avulsas_estoque e WHERE e.id = itens_entrada_produto.id_entrada_avulsa AND can_manage_empresa(e.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entradas_avulsas_estoque e WHERE e.id = itens_entrada_produto.id_entrada_avulsa AND can_manage_empresa(e.empresa_id)));

-- entradas_avulsas_estoque
DROP POLICY IF EXISTS "Admins manage entradas_avulsas_estoque" ON public.entradas_avulsas_estoque;
CREATE POLICY "Admins manage entradas_avulsas_estoque" ON public.entradas_avulsas_estoque FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- itens_entrada_avulsa
DROP POLICY IF EXISTS "Admins manage itens_entrada_avulsa" ON public.itens_entrada_avulsa;
CREATE POLICY "Admins manage itens_entrada_avulsa" ON public.itens_entrada_avulsa FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entradas_avulsas_estoque e WHERE e.id = itens_entrada_avulsa.id_entrada_avulsa AND can_manage_empresa(e.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entradas_avulsas_estoque e WHERE e.id = itens_entrada_avulsa.id_entrada_avulsa AND can_manage_empresa(e.empresa_id)));

-- lancamentos_tesouraria
DROP POLICY IF EXISTS "Admins manage lancamentos_tesouraria" ON public.lancamentos_tesouraria;
CREATE POLICY "Admins manage lancamentos_tesouraria" ON public.lancamentos_tesouraria FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- fluxo_caixa (uses user_empresa_id)
DROP POLICY IF EXISTS "Admins manage cash flow" ON public.fluxo_caixa;
CREATE POLICY "Admins manage cash flow" ON public.fluxo_caixa FOR ALL TO authenticated
  USING (can_manage_empresa(user_empresa_id(id_usuario)))
  WITH CHECK (can_manage_empresa(user_empresa_id(id_usuario)));

-- ajustes_estoque
DROP POLICY IF EXISTS "Admins manage ajustes_estoque" ON public.ajustes_estoque;
CREATE POLICY "Admins manage ajustes_estoque" ON public.ajustes_estoque FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- meios_pagamento
DROP POLICY IF EXISTS "Admins manage payment methods" ON public.meios_pagamento;
CREATE POLICY "Admins manage payment methods" ON public.meios_pagamento FOR ALL TO authenticated USING (can_manage_empresa(empresa_id)) WITH CHECK (can_manage_empresa(empresa_id));

-- Prevent self-privilege escalation via profiles.nivel_id
CREATE OR REPLACE FUNCTION public.prevent_profile_nivel_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nivel_id IS DISTINCT FROM OLD.nivel_id THEN
    IF NOT public.can_manage_empresa(OLD.empresa_id) THEN
      RAISE EXCEPTION 'Somente administradores podem alterar o nível de acesso deste perfil';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_nivel_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_nivel_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_nivel_self_escalation();
