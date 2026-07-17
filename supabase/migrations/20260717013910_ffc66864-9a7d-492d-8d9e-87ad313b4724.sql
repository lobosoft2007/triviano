-- =========================================================
-- Módulo Fiscal v1.0 — Base de dados
-- =========================================================

-- Adiciona dados fiscais às empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cnpj text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS inscricao_estadual text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS regime_tributario text NOT NULL DEFAULT 'simples_nacional';

-- Adiciona campos fiscais aos produtos
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS csosn text,
  ADD COLUMN IF NOT EXISTS cst_icms text,
  ADD COLUMN IF NOT EXISTS origem_icms text DEFAULT '0';

-- =========================================================
-- 1) Configuração fiscal por empresa
-- =========================================================
CREATE TABLE IF NOT EXISTS public.config_fiscal (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'tecnospeed',
  ambiente text NOT NULL DEFAULT 'homologacao',
  regime_tributario text NOT NULL DEFAULT 'simples_nacional',
  serie_nfce text NOT NULL DEFAULT '1',
  numero_nfce_proximo integer NOT NULL DEFAULT 1,
  serie_nfe text NOT NULL DEFAULT '1',
  numero_nfe_proximo integer NOT NULL DEFAULT 1,
  credenciais jsonb NOT NULL DEFAULT '{}'::jsonb,
  certificado_a1_path text,
  certificado_a1_senha_criptografada text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_fiscal TO authenticated;
GRANT ALL ON public.config_fiscal TO service_role;

ALTER TABLE public.config_fiscal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam configuração fiscal"
  ON public.config_fiscal
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 2) Notas fiscais emitidas
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('NFCE', 'NFE')),
  chave_acesso text,
  numero text,
  serie text,
  status text NOT NULL DEFAULT 'pendente',
  xml_envio text,
  xml_autorizacao text,
  pdf_url text,
  pdf_path text,
  valor_total numeric NOT NULL DEFAULT 0,
  data_emissao timestamptz,
  protocolo text,
  mensagem_retorno text,
  ambiente text NOT NULL DEFAULT 'homologacao',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam notas fiscais"
  ON public.notas_fiscais
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_empresa ON public.notas_fiscais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_pedido ON public.notas_fiscais(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_chave ON public.notas_fiscais(chave_acesso);

-- =========================================================
-- 3) Itens das notas fiscais
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notas_fiscais_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  ncm text,
  cfop text,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  csosn text,
  cst_icms text,
  origem_icms text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais_itens TO authenticated;
GRANT ALL ON public.notas_fiscais_itens TO service_role;

ALTER TABLE public.notas_fiscais_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam itens de notas fiscais"
  ON public.notas_fiscais_itens
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_nota ON public.notas_fiscais_itens(nota_fiscal_id);

-- =========================================================
-- 4) Manifestação do destinatário (NF-e de entrada)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.manifestacoes_destinatario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave_acesso text NOT NULL,
  nsu text,
  cnpj_emitente text,
  nome_emitente text,
  valor numeric,
  data_emissao timestamptz,
  tipo_evento text CHECK (tipo_evento IN ('ciencia', 'confirmacao', 'desconhecimento', 'opnr')),
  status text NOT NULL DEFAULT 'pendente',
  xml_path text,
  data_manifestacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave_acesso)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manifestacoes_destinatario TO authenticated;
GRANT ALL ON public.manifestacoes_destinatario TO service_role;

ALTER TABLE public.manifestacoes_destinatario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam manifestações do destinatário"
  ON public.manifestacoes_destinatario
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_manifestacoes_empresa ON public.manifestacoes_destinatario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_manifestacoes_chave ON public.manifestacoes_destinatario(chave_acesso);

-- =========================================================
-- 5) Mapeamento produto do fornecedor → insumo/subproduto/produto
-- =========================================================
CREATE TABLE IF NOT EXISTS public.produtos_fornecedor (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  codigo_fornecedor text,
  descricao_fornecedor text,
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  subproduto_id uuid REFERENCES public.subprodutos(id) ON DELETE SET NULL,
  produto_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  fator_conversao numeric NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_fornecedor TO authenticated;
GRANT ALL ON public.produtos_fornecedor TO service_role;

ALTER TABLE public.produtos_fornecedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam produtos de fornecedor"
  ON public.produtos_fornecedor
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor_fornecedor ON public.produtos_fornecedor(fornecedor_id);

-- =========================================================
-- Triggers de updated_at
-- =========================================================
DROP TRIGGER IF EXISTS update_config_fiscal_updated_at ON public.config_fiscal;
CREATE TRIGGER update_config_fiscal_updated_at
  BEFORE UPDATE ON public.config_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notas_fiscais_updated_at ON public.notas_fiscais;
CREATE TRIGGER update_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_manifestacoes_destinatario_updated_at ON public.manifestacoes_destinatario;
CREATE TRIGGER update_manifestacoes_destinatario_updated_at
  BEFORE UPDATE ON public.manifestacoes_destinatario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_produtos_fornecedor_updated_at ON public.produtos_fornecedor;
CREATE TRIGGER update_produtos_fornecedor_updated_at
  BEFORE UPDATE ON public.produtos_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();