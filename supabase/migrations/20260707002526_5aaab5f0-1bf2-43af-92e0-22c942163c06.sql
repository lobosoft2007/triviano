-- 1) profiles: restrict self-update to non-financial columns via column-level grants.
-- The existing "Users can update their own profile" RLS policy still scopes to auth.uid() = id.
-- SECURITY DEFINER RPCs (admin_update_cliente, finalize_order_paid, pay_fiado,
-- redeem_cashback_for_order, abater_fiado_com_cashback, set_cliente_bloqueado, etc.)
-- run as table owner and bypass these column grants, so they keep working.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, phone, address, push_token,
  tipo_logradouro, logradouro, numero, complemento, bairro,
  municipio, estado, cep, ddd, telefone, latitude, longitude
) ON public.profiles TO authenticated;

-- 2) orders: tighten the direct INSERT policy so clients cannot self-set financial fields.
-- Real orders are created through the create_order SECURITY DEFINER RPC (which bypasses RLS),
-- so any direct client insert must carry zeroed financial values.
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(total, 0) = 0
  AND COALESCE(discount, 0) = 0
  AND COALESCE(desconto_manual, 0) = 0
  AND COALESCE(cashback_usado, 0) = 0
);