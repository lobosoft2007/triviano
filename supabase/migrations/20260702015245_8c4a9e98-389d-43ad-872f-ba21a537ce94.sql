-- Motor de Combos Dinâmicos: regras relacionais amarradas a categorias
CREATE TABLE public.regras_combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_combo text NOT NULL,
  id_categoria_1 uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  id_categoria_2 uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  id_categoria_3 uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  valor_desconto numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_combos TO authenticated;
GRANT SELECT ON public.regras_combos TO anon;
GRANT ALL ON public.regras_combos TO service_role;

ALTER TABLE public.regras_combos ENABLE ROW LEVEL SECURITY;

-- Leitura pública das regras ativas (o carrinho do cliente precisa lê-las)
CREATE POLICY "Combo rules are viewable by everyone"
  ON public.regras_combos FOR SELECT
  USING (true);

-- Somente administradores gerenciam as regras
CREATE POLICY "Admins can insert combo rules"
  ON public.regras_combos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update combo rules"
  ON public.regras_combos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete combo rules"
  ON public.regras_combos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_regras_combos_updated_at
  BEFORE UPDATE ON public.regras_combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();