DROP POLICY IF EXISTS tap_card_select_own_empresa ON public.tap_card_charges;

CREATE POLICY tap_card_select_staff_or_owner ON public.tap_card_charges
FOR SELECT TO authenticated
USING (
  public.can_manage_empresa(empresa_id)
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = tap_card_charges.order_id
      AND o.user_id = auth.uid()
  )
);