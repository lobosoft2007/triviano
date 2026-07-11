-- =========================================================================
-- 1) PEDIDOS: impedir criação de pedido em empresa de outro tenant.
--    A RPC create_order (SECURITY DEFINER, owner postgres/BYPASSRLS) não é
--    afetada; esta política só governa inserts diretos do cliente.
-- =========================================================================
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
  AND empresa_id = public.current_empresa_id()
);

-- =========================================================================
-- 2) PERFIS: impedir auto-atribuição / troca de empresa pelo próprio usuário.
--    handle_new_user e claim_tenant_by_host (SECURITY DEFINER, owner postgres)
--    continuam podendo definir/alterar empresa_id pois ignoram RLS.
-- =========================================================================
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND empresa_id = COALESCE(
        public.current_empresa_id(),
        '00000000-0000-0000-0000-000000000023'::uuid)
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND empresa_id = public.current_empresa_id()
);

-- =========================================================================
-- 3) IMAGENS DO CARDÁPIO: manter leitura pública (URLs assinadas dependem do
--    SELECT para anon), porém escopada a arquivos sob o prefixo <empresa_id>/.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.storage_path_is_empresa_prefixed(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text := split_part(_name, '/', 1);
  v_uuid uuid;
BEGIN
  BEGIN
    v_uuid := v_prefix::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN EXISTS (SELECT 1 FROM public.empresas WHERE id = v_uuid);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.storage_path_is_empresa_prefixed(text)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
CREATE POLICY "Anyone can view menu images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'imagens-cardapio'
  AND public.storage_path_is_empresa_prefixed(name)
);