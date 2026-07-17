CREATE TABLE public.relatorios_salvos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default current_empresa_id() references public.empresas(id) on delete cascade,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete set null,
  nome text not null,
  descricao text,
  spec jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_salvos TO authenticated;
GRANT ALL ON public.relatorios_salvos TO service_role;

ALTER TABLE public.relatorios_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage relatorios by empresa"
  ON public.relatorios_salvos
  FOR ALL
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

CREATE INDEX idx_relatorios_salvos_empresa ON public.relatorios_salvos(empresa_id, updated_at DESC);

CREATE TRIGGER trg_relatorios_salvos_updated_at
  BEFORE UPDATE ON public.relatorios_salvos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();