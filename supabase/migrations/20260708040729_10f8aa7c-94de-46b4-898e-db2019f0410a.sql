
-- Helper: empresa de um usuário (SECURITY DEFINER para evitar RLS recursiva em profiles)
CREATE OR REPLACE FUNCTION public.user_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id
$$;

-- Trigger genérico para preencher empresa_id com a empresa do operador
CREATE OR REPLACE FUNCTION public.set_empresa_id_from_current()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ===== meios_pagamento: adicionar empresa_id =====
ALTER TABLE public.meios_pagamento ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.meios_pagamento SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.meios_pagamento ALTER COLUMN empresa_id SET NOT NULL;
DROP TRIGGER IF EXISTS trg_meios_pagamento_empresa ON public.meios_pagamento;
CREATE TRIGGER trg_meios_pagamento_empresa BEFORE INSERT ON public.meios_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- ===== config_pagamentos: adicionar empresa_id =====
ALTER TABLE public.config_pagamentos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.config_pagamentos SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.config_pagamentos ALTER COLUMN empresa_id SET NOT NULL;
DROP TRIGGER IF EXISTS trg_config_pagamentos_empresa ON public.config_pagamentos;
CREATE TRIGGER trg_config_pagamentos_empresa BEFORE INSERT ON public.config_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

-- ============================================================
-- ORDERS
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders" ON public.orders
  FOR UPDATE USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE USING (public.can_manage_empresa(empresa_id));

-- ============================================================
-- ORDER_ITEMS (escopo via pedido pai)
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND public.can_manage_empresa(o.empresa_id)
  ));

-- ============================================================
-- PAGAMENTOS_PEDIDO (escopo via pedido pai)
-- ============================================================
DROP POLICY IF EXISTS "Admins manage order payments" ON public.pagamentos_pedido;
CREATE POLICY "Admins manage order payments" ON public.pagamentos_pedido
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = pagamentos_pedido.id_pedido AND public.can_manage_empresa(o.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = pagamentos_pedido.id_pedido AND public.can_manage_empresa(o.empresa_id)
  ));

-- ============================================================
-- FLUXO_CAIXA (escopo via empresa do operador)
-- ============================================================
DROP POLICY IF EXISTS "Admins manage cash flow" ON public.fluxo_caixa;
CREATE POLICY "Admins manage cash flow" ON public.fluxo_caixa
  FOR ALL USING (public.can_manage_empresa(public.user_empresa_id(id_usuario)))
  WITH CHECK (public.can_manage_empresa(public.user_empresa_id(id_usuario)));

-- ============================================================
-- MOVIMENTACOES_CAIXA (escopo via caixa pai)
-- ============================================================
DROP POLICY IF EXISTS "Admins manage cash movements" ON public.movimentacoes_caixa;
CREATE POLICY "Admins manage cash movements" ON public.movimentacoes_caixa
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.fluxo_caixa fc
    WHERE fc.id = movimentacoes_caixa.id_caixa
      AND public.can_manage_empresa(public.user_empresa_id(fc.id_usuario))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fluxo_caixa fc
    WHERE fc.id = movimentacoes_caixa.id_caixa
      AND public.can_manage_empresa(public.user_empresa_id(fc.id_usuario))
  ));

-- ============================================================
-- CONTADORES_SENHA (já possui empresa_id)
-- ============================================================
DROP POLICY IF EXISTS "Admins veem contadores de senha" ON public.contadores_senha;
CREATE POLICY "Admins veem contadores de senha" ON public.contadores_senha
  FOR SELECT USING (public.can_manage_empresa(empresa_id));

-- ============================================================
-- MEIOS_PAGAMENTO
-- ============================================================
DROP POLICY IF EXISTS "Admins manage payment methods" ON public.meios_pagamento;
CREATE POLICY "Admins manage payment methods" ON public.meios_pagamento
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- ============================================================
-- CONFIG_PAGAMENTOS
-- ============================================================
DROP POLICY IF EXISTS "Admins manage payment config" ON public.config_pagamentos;
CREATE POLICY "Admins manage payment config" ON public.config_pagamentos
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- ============================================================
-- NOTIFICACOES_CLIENTE (escopo via empresa do cliente destinatário)
-- ============================================================
DROP POLICY IF EXISTS "Clients read own notifications" ON public.notificacoes_cliente;
CREATE POLICY "Clients read own notifications" ON public.notificacoes_cliente
  FOR SELECT USING (
    id_usuario = auth.uid()
    OR public.can_manage_empresa(public.user_empresa_id(id_usuario))
  );

DROP POLICY IF EXISTS "Admins create notifications" ON public.notificacoes_cliente;
CREATE POLICY "Admins create notifications" ON public.notificacoes_cliente
  FOR INSERT WITH CHECK (public.can_manage_empresa(public.user_empresa_id(id_usuario)));

DROP POLICY IF EXISTS "Admins delete notifications" ON public.notificacoes_cliente;
CREATE POLICY "Admins delete notifications" ON public.notificacoes_cliente
  FOR DELETE USING (public.can_manage_empresa(public.user_empresa_id(id_usuario)));
