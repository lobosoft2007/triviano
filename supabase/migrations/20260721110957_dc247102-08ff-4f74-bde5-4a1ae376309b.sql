
-- orders: add empresa scope to user select
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
FOR SELECT USING (auth.uid() = user_id AND empresa_id = current_empresa_id());

-- comanda_ativa: split into customer (locked financial fields) and staff
DROP POLICY IF EXISTS "Cliente ou operador atualizam comandas" ON public.comanda_ativa;

CREATE POLICY "Staff atualizam comandas" ON public.comanda_ativa
FOR UPDATE USING (can_manage_empresa(empresa_id))
WITH CHECK (can_manage_empresa(empresa_id));

CREATE POLICY "Cliente atualiza comanda campos seguros" ON public.comanda_ativa
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND status IS NOT DISTINCT FROM (SELECT status FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND pago_online IS NOT DISTINCT FROM (SELECT pago_online FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND mp_status IS NOT DISTINCT FROM (SELECT mp_status FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND mp_payment_id IS NOT DISTINCT FROM (SELECT mp_payment_id FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND mp_order_id IS NOT DISTINCT FROM (SELECT mp_order_id FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND total_parcial IS NOT DISTINCT FROM (SELECT total_parcial FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND empresa_id IS NOT DISTINCT FROM (SELECT empresa_id FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
  AND user_id IS NOT DISTINCT FROM (SELECT user_id FROM public.comanda_ativa c WHERE c.id = comanda_ativa.id)
);

-- reservas: split into customer (locked status/payment) and staff
DROP POLICY IF EXISTS "reservas_update_staff" ON public.reservas;

CREATE POLICY "reservas_update_staff" ON public.reservas
FOR UPDATE USING (can_manage_empresa(empresa_id))
WITH CHECK (can_manage_empresa(empresa_id));

CREATE POLICY "reservas_update_own_safe" ON public.reservas
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND status IS NOT DISTINCT FROM (SELECT status FROM public.reservas r WHERE r.id = reservas.id)
  AND numero_mesa IS NOT DISTINCT FROM (SELECT numero_mesa FROM public.reservas r WHERE r.id = reservas.id)
  AND sinal_valor IS NOT DISTINCT FROM (SELECT sinal_valor FROM public.reservas r WHERE r.id = reservas.id)
  AND mp_order_id IS NOT DISTINCT FROM (SELECT mp_order_id FROM public.reservas r WHERE r.id = reservas.id)
  AND mp_payment_id IS NOT DISTINCT FROM (SELECT mp_payment_id FROM public.reservas r WHERE r.id = reservas.id)
  AND empresa_id IS NOT DISTINCT FROM (SELECT empresa_id FROM public.reservas r WHERE r.id = reservas.id)
  AND user_id IS NOT DISTINCT FROM (SELECT user_id FROM public.reservas r WHERE r.id = reservas.id)
);
