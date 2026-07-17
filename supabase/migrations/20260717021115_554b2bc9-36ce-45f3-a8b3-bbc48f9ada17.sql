
-- =====================================================
-- 1. Isolamento por empresa nas tabelas fiscais
-- =====================================================

-- config_fiscal
DROP POLICY IF EXISTS "Admins gerenciam configuração fiscal" ON public.config_fiscal;
CREATE POLICY "Admins gerenciam configuração fiscal da própria empresa"
  ON public.config_fiscal
  FOR ALL
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- manifestacoes_destinatario
DROP POLICY IF EXISTS "Admins gerenciam manifestações do destinatário" ON public.manifestacoes_destinatario;
CREATE POLICY "Admins gerenciam manifestações da própria empresa"
  ON public.manifestacoes_destinatario
  FOR ALL
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- notas_fiscais
DROP POLICY IF EXISTS "Admins gerenciam notas fiscais" ON public.notas_fiscais;
CREATE POLICY "Admins gerenciam notas fiscais da própria empresa"
  ON public.notas_fiscais
  FOR ALL
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- notas_fiscais_itens (sem empresa_id direto — via nota_fiscal_id)
DROP POLICY IF EXISTS "Admins gerenciam itens de notas fiscais" ON public.notas_fiscais_itens;
CREATE POLICY "Admins gerenciam itens de notas da própria empresa"
  ON public.notas_fiscais_itens
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.id = notas_fiscais_itens.nota_fiscal_id
        AND public.can_manage_empresa(nf.empresa_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notas_fiscais nf
      WHERE nf.id = notas_fiscais_itens.nota_fiscal_id
        AND public.can_manage_empresa(nf.empresa_id)
    )
  );

-- produtos_fornecedor (empresa_id vem via fornecedor_id -> fornecedores.empresa_id)
DROP POLICY IF EXISTS "Admins gerenciam produtos de fornecedor" ON public.produtos_fornecedor;
CREATE POLICY "Admins gerenciam produtos de fornecedor da própria empresa"
  ON public.produtos_fornecedor
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fornecedores f
      WHERE f.id = produtos_fornecedor.fornecedor_id
        AND public.can_manage_empresa(f.empresa_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fornecedores f
      WHERE f.id = produtos_fornecedor.fornecedor_id
        AND public.can_manage_empresa(f.empresa_id)
    )
  );

-- =====================================================
-- 2. Remoção dos UUIDs fixos de fallback
-- =====================================================

ALTER TABLE public.profiles
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

ALTER TABLE public.regras_combos
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

-- Ajustar política de INSERT de profiles para não aceitar o UUID fixo
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND empresa_id IS NOT NULL
    AND empresa_id = public.current_empresa_id()
  );
