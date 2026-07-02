-- ============================================================
-- MULTI-TENANT: tabela de empresas + isolamento por empresa_id
-- ============================================================

CREATE TABLE public.empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_fantasia text NOT NULL DEFAULT '',
  logotipo_url text NOT NULL DEFAULT '/logo.png',
  taxa_servico_mesa numeric NOT NULL DEFAULT 0,
  cep text NOT NULL DEFAULT '',
  logradouro text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  complemento text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.empresas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Todos (inclusive visitantes) podem ver empresas ativas (branding do PWA)
CREATE POLICY "Empresas ativas são públicas"
  ON public.empresas FOR SELECT
  USING (ativo = true);

-- Administradores podem gerenciar empresas
CREATE POLICY "Admins gerenciam empresas (select)"
  ON public.empresas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam empresas (insert)"
  ON public.empresas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam empresas (update)"
  ON public.empresas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam empresas (delete)"
  ON public.empresas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Primeira empresa (Clube 23) com UUID fixo para servir de default
INSERT INTO public.empresas
  (id, nome_fantasia, logotipo_url, taxa_servico_mesa, cep, logradouro, numero, complemento, bairro, cidade, estado, ativo)
VALUES
  ('00000000-0000-0000-0000-000000000023',
   'Clube 23', '/logo.png', 10,
   '20040-010', 'Avenida Rio Branco', '156', 'Loja 23', 'Centro',
   'Rio de Janeiro', 'RJ', true);

-- ============================================================
-- ISOLAMENTO: adiciona empresa_id nas tabelas principais
-- (DEFAULT preenche linhas existentes e novos inserts do app atual)
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.categories
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.insumos
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.orders
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.contas_financeiras
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.lancamentos_tesouraria
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.regras_combos
  ADD COLUMN empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023'
  REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE INDEX idx_products_empresa ON public.products(empresa_id);
CREATE INDEX idx_categories_empresa ON public.categories(empresa_id);
CREATE INDEX idx_insumos_empresa ON public.insumos(empresa_id);
CREATE INDEX idx_orders_empresa ON public.orders(empresa_id);
CREATE INDEX idx_contas_empresa ON public.contas_financeiras(empresa_id);
CREATE INDEX idx_lancamentos_empresa ON public.lancamentos_tesouraria(empresa_id);
CREATE INDEX idx_regras_combos_empresa ON public.regras_combos(empresa_id);