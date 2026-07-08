
-- ============================================================
-- FASE 2c — Isolamento multi-tenant: ESTOQUE / COMPRAS
-- Padrão: can_manage_empresa(empresa_id) direto quando há coluna,
--         EXISTS via pai quando é tabela de itens.
-- ============================================================

-- ------------------------------------------------------------
-- Colunas empresa_id nas tabelas "pai" que ainda não têm
-- ------------------------------------------------------------

-- fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.fornecedores SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_fornecedores_empresa ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_empresa BEFORE INSERT ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- entradas_avulsas_estoque
ALTER TABLE public.entradas_avulsas_estoque ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.entradas_avulsas_estoque SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.entradas_avulsas_estoque ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.entradas_avulsas_estoque ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_entradas_avulsas_empresa ON public.entradas_avulsas_estoque;
CREATE TRIGGER trg_entradas_avulsas_empresa BEFORE INSERT ON public.entradas_avulsas_estoque
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- ordens_compra
ALTER TABLE public.ordens_compra ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.ordens_compra SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.ordens_compra ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.ordens_compra ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_ordens_compra_empresa ON public.ordens_compra;
CREATE TRIGGER trg_ordens_compra_empresa BEFORE INSERT ON public.ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- ------------------------------------------------------------
-- Tabelas que JÁ têm empresa_id: garantir default + trigger
-- ------------------------------------------------------------
ALTER TABLE public.insumos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_insumos_empresa ON public.insumos;
CREATE TRIGGER trg_insumos_empresa BEFORE INSERT ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

ALTER TABLE public.ajustes_estoque ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_ajustes_estoque_empresa ON public.ajustes_estoque;
CREATE TRIGGER trg_ajustes_estoque_empresa BEFORE INSERT ON public.ajustes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- ============================================================
-- POLICIES — escopo direto por empresa_id
-- ============================================================

-- INSUMOS
DROP POLICY IF EXISTS "Admins can view insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admins can insert insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admins can update insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admins can delete insumos" ON public.insumos;
CREATE POLICY "Admins can view insumos" ON public.insumos
  FOR SELECT USING (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can insert insumos" ON public.insumos
  FOR INSERT WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can update insumos" ON public.insumos
  FOR UPDATE USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can delete insumos" ON public.insumos
  FOR DELETE USING (public.can_manage_empresa(empresa_id));

-- AJUSTES_ESTOQUE
DROP POLICY IF EXISTS "Admins manage ajustes_estoque" ON public.ajustes_estoque;
CREATE POLICY "Admins manage ajustes_estoque" ON public.ajustes_estoque
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- FORNECEDORES
DROP POLICY IF EXISTS "Admins can view fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admins can insert fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admins can update fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Admins can delete fornecedores" ON public.fornecedores;
CREATE POLICY "Admins can view fornecedores" ON public.fornecedores
  FOR SELECT USING (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can insert fornecedores" ON public.fornecedores
  FOR INSERT WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can update fornecedores" ON public.fornecedores
  FOR UPDATE USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can delete fornecedores" ON public.fornecedores
  FOR DELETE USING (public.can_manage_empresa(empresa_id));

-- ENTRADAS_AVULSAS_ESTOQUE
DROP POLICY IF EXISTS "Admins manage entradas_avulsas_estoque" ON public.entradas_avulsas_estoque;
CREATE POLICY "Admins manage entradas_avulsas_estoque" ON public.entradas_avulsas_estoque
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- ORDENS_COMPRA
DROP POLICY IF EXISTS "Admins manage ordens_compra" ON public.ordens_compra;
CREATE POLICY "Admins manage ordens_compra" ON public.ordens_compra
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- ============================================================
-- POLICIES — escopo via tabela pai (itens)
-- ============================================================

-- ITENS_ENTRADA_AVULSA -> entradas_avulsas_estoque
DROP POLICY IF EXISTS "Admins manage itens_entrada_avulsa" ON public.itens_entrada_avulsa;
CREATE POLICY "Admins manage itens_entrada_avulsa" ON public.itens_entrada_avulsa
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.entradas_avulsas_estoque e
    WHERE e.id = itens_entrada_avulsa.id_entrada_avulsa
      AND public.can_manage_empresa(e.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.entradas_avulsas_estoque e
    WHERE e.id = itens_entrada_avulsa.id_entrada_avulsa
      AND public.can_manage_empresa(e.empresa_id)
  ));

-- ITENS_ENTRADA_PRODUTO -> entradas_avulsas_estoque
DROP POLICY IF EXISTS "Admins manage itens_entrada_produto" ON public.itens_entrada_produto;
CREATE POLICY "Admins manage itens_entrada_produto" ON public.itens_entrada_produto
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.entradas_avulsas_estoque e
    WHERE e.id = itens_entrada_produto.id_entrada_avulsa
      AND public.can_manage_empresa(e.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.entradas_avulsas_estoque e
    WHERE e.id = itens_entrada_produto.id_entrada_avulsa
      AND public.can_manage_empresa(e.empresa_id)
  ));

-- ITENS_ORDEM_COMPRA -> ordens_compra
DROP POLICY IF EXISTS "Admins manage itens_ordem_compra" ON public.itens_ordem_compra;
CREATE POLICY "Admins manage itens_ordem_compra" ON public.itens_ordem_compra
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.ordens_compra o
    WHERE o.id = itens_ordem_compra.id_ordem_compra
      AND public.can_manage_empresa(o.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_compra o
    WHERE o.id = itens_ordem_compra.id_ordem_compra
      AND public.can_manage_empresa(o.empresa_id)
  ));

-- ============================================================
-- SECURITY DEFINER: escopar patrimônio por empresa do operador
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_patrimonio_estoque()
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v numeric;
  v_emp uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_emp := public.current_empresa_id();
  SELECT
    COALESCE((SELECT SUM(saldo_estoque * custo_unitario) FROM public.insumos
              WHERE estocavel = true AND empresa_id = v_emp), 0)
    + COALESCE((SELECT SUM(saldo_estoque * price) FROM public.products
                WHERE manipulado = false AND empresa_id = v_emp), 0)
  INTO v;
  RETURN v;
END;
$function$;
