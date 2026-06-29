
-- 1. Enum for attendance type
DO $$ BEGIN
  CREATE TYPE public.attendance_type AS ENUM ('Delivery', 'Presencial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tipo_atendimento public.attendance_type NOT NULL DEFAULT 'Delivery',
  ADD COLUMN IF NOT EXISTS numero_mesa integer,
  ADD COLUMN IF NOT EXISTS impresso_cozinha boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impresso_conta boolean NOT NULL DEFAULT false;

-- 3. fluxo_caixa
CREATE TABLE IF NOT EXISTS public.fluxo_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_hora_abertura timestamptz NOT NULL DEFAULT now(),
  data_hora_fechamento timestamptz,
  valor_abertura numeric(10,2) NOT NULL DEFAULT 0,
  valor_fechamento numeric(10,2),
  status text NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Fechado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_caixa TO authenticated;
GRANT ALL ON public.fluxo_caixa TO service_role;

ALTER TABLE public.fluxo_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cash flow"
  ON public.fluxo_caixa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. movimentacoes_caixa
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_caixa uuid NOT NULL REFERENCES public.fluxo_caixa(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('Sangria', 'Suprimento', 'Recebimento Pedido')),
  valor numeric(10,2) NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_caixa TO authenticated;
GRANT ALL ON public.movimentacoes_caixa TO service_role;

ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cash movements"
  ON public.movimentacoes_caixa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. updated_at trigger on fluxo_caixa
CREATE TRIGGER update_fluxo_caixa_updated_at
  BEFORE UPDATE ON public.fluxo_caixa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Admin access to all orders / order_items for the cashier panel
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
