-- 1) ENUMS -----------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.forma_pagamento_tipo AS ENUM ('PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ambiente_emissao_tipo AS ENUM ('Homologação/Testes', 'Produção');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) ORDERS: production conveyor status + operator fields --------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status_pedido text NOT NULL DEFAULT 'Recebido',
  ADD COLUMN IF NOT EXISTS observacoes_operador text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS desconto_manual numeric NOT NULL DEFAULT 0;

UPDATE public.orders SET status_pedido = CASE status
  WHEN 'pending' THEN 'Recebido'
  WHEN 'preparing' THEN 'Em preparação'
  WHEN 'delivered' THEN 'Entregue'
  WHEN 'cancelled' THEN 'Cancelado'
  ELSE 'Recebido'
END;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_status_pedido_check
    CHECK (status_pedido IN ('Recebido','Em preparação','Aguardando entregador','Em entrega','Entregue','Pago','Cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) PAGAMENTOS_PEDIDO: split payment lines ---------------------------
CREATE TABLE IF NOT EXISTS public.pagamentos_pedido (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_pedido uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  forma_pagamento public.forma_pagamento_tipo NOT NULL,
  valor_pago numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido_id_pedido ON public.pagamentos_pedido(id_pedido);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_pedido TO authenticated;
GRANT ALL ON public.pagamentos_pedido TO service_role;

ALTER TABLE public.pagamentos_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order payments" ON public.pagamentos_pedido;
CREATE POLICY "Admins manage order payments"
  ON public.pagamentos_pedido FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view payments of their own orders" ON public.pagamentos_pedido;
CREATE POLICY "Users view payments of their own orders"
  ON public.pagamentos_pedido FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = pagamentos_pedido.id_pedido AND o.user_id = auth.uid()
  ));

ALTER TABLE public.pagamentos_pedido REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_pedido;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) CONFIG_PAGAMENTOS: fiscal / digital certificate metadata --------
ALTER TABLE public.config_pagamentos
  ADD COLUMN IF NOT EXISTS certificado_a1_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certificado_a1_validade timestamp with time zone,
  ADD COLUMN IF NOT EXISTS certificado_a1_senha_criptografada text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certificado_a1_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ambiente_emissao public.ambiente_emissao_tipo NOT NULL DEFAULT 'Homologação/Testes';

-- 5) STORAGE: certificate file access restricted to admins -----------
DROP POLICY IF EXISTS "Admins read fiscal certificates" ON storage.objects;
CREATE POLICY "Admins read fiscal certificates"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificados-fiscais' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins upload fiscal certificates" ON storage.objects;
CREATE POLICY "Admins upload fiscal certificates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados-fiscais' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update fiscal certificates" ON storage.objects;
CREATE POLICY "Admins update fiscal certificates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificados-fiscais' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'certificados-fiscais' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete fiscal certificates" ON storage.objects;
CREATE POLICY "Admins delete fiscal certificates"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificados-fiscais' AND has_role(auth.uid(), 'admin'::app_role));