-- comanda_ativa
DROP POLICY IF EXISTS "Cliente atualiza comanda campos seguros" ON public.comanda_ativa;
CREATE POLICY "Cliente atualiza comanda campos seguros"
ON public.comanda_ativa
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  (user_id = auth.uid())
  AND (NOT (status IS DISTINCT FROM (SELECT c.status FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (pago_online IS DISTINCT FROM (SELECT c.pago_online FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (mp_status IS DISTINCT FROM (SELECT c.mp_status FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (mp_payment_id IS DISTINCT FROM (SELECT c.mp_payment_id FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (mp_order_id IS DISTINCT FROM (SELECT c.mp_order_id FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (total_parcial IS DISTINCT FROM (SELECT c.total_parcial FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (empresa_id IS DISTINCT FROM (SELECT c.empresa_id FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
  AND (NOT (user_id IS DISTINCT FROM (SELECT c.user_id FROM comanda_ativa c WHERE c.id = comanda_ativa.id)))
);

-- reservas
DROP POLICY IF EXISTS "reservas_update_own_safe" ON public.reservas;
CREATE POLICY "reservas_update_own_safe"
ON public.reservas
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  (user_id = auth.uid())
  AND (NOT (status IS DISTINCT FROM (SELECT r.status FROM reservas r WHERE r.id = reservas.id)))
  AND (NOT (numero_mesa IS DISTINCT FROM (SELECT r.numero_mesa FROM reservas r WHERE r.id = reservas.id)))
  AND (NOT (sinal_valor IS DISTINCT FROM (SELECT r.sinal_valor FROM reservas r WHERE r.id = reservas.id)))
  AND (NOT (mp_order_id IS DISTINCT FROM (SELECT r.mp_order_id FROM reservas r WHERE r.id = reservas.id)))
  AND (NOT (mp_payment_id IS DISTINCT FROM (SELECT r.mp_payment_id FROM reservas r WHERE r.id = reservas.id)))
  AND (NOT (empresa_id IS DISTINCT FROM (SELECT r.empresa_id FROM reservas r WHERE r.id = reservas.id)))
  AND (NOT (user_id IS DISTINCT FROM (SELECT r.user_id FROM reservas r WHERE r.id = reservas.id)))
);

DROP POLICY IF EXISTS "reservas_update_staff" ON public.reservas;
CREATE POLICY "reservas_update_staff"
ON public.reservas
FOR UPDATE
TO authenticated
USING (can_manage_empresa(empresa_id))
WITH CHECK (can_manage_empresa(empresa_id));

-- orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) AND (empresa_id = current_empresa_id()));