-- 1) Printer / sector configuration table
CREATE TABLE public.config_impressoras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo_conexao text NOT NULL DEFAULT 'USB',
  endereco_ip text,
  porta integer,
  caminho_usb text,
  cor text NOT NULL DEFAULT '#2563eb',
  is_default boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT config_impressoras_tipo_conexao_check CHECK (tipo_conexao IN ('USB','IP'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_impressoras TO authenticated;
GRANT ALL ON public.config_impressoras TO service_role;

ALTER TABLE public.config_impressoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view printers"
  ON public.config_impressoras FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert printers"
  ON public.config_impressoras FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update printers"
  ON public.config_impressoras FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete printers"
  ON public.config_impressoras FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_config_impressoras_updated_at
  BEFORE UPDATE ON public.config_impressoras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Link categories to a destination printer
ALTER TABLE public.categories
  ADD COLUMN id_impressora_destino uuid
  REFERENCES public.config_impressoras(id) ON DELETE SET NULL;