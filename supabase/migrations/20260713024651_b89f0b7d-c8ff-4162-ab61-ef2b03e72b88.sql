-- orders: tighten admin policies from role "public" to "authenticated"
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (can_manage_empresa(empresa_id));

-- pagamentos_pedido: tighten admin ALL policy from role "public" to "authenticated"
DROP POLICY IF EXISTS "Admins manage order payments" ON public.pagamentos_pedido;
CREATE POLICY "Admins manage order payments" ON public.pagamentos_pedido
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = pagamentos_pedido.id_pedido AND can_manage_empresa(o.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = pagamentos_pedido.id_pedido AND can_manage_empresa(o.empresa_id)
  ));