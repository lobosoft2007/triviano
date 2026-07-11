-- Safe helper: returns true only when the first folder segment of a storage
-- object path is a valid empresa_id that the current user may manage.
CREATE OR REPLACE FUNCTION public.storage_path_empresa_allowed(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := split_part(_name, '/', 1);
  v_uuid uuid;
BEGIN
  BEGIN
    v_uuid := v_prefix::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.can_manage_empresa(v_uuid);
END;
$$;

-- ============ certificados-fiscais (private, sensitive) ============
DROP POLICY IF EXISTS "Admins read fiscal certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload fiscal certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins update fiscal certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete fiscal certificates" ON storage.objects;

CREATE POLICY "Tenant admins read fiscal certificates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'certificados-fiscais' AND public.storage_path_empresa_allowed(name));

CREATE POLICY "Tenant admins upload fiscal certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificados-fiscais' AND public.storage_path_empresa_allowed(name));

CREATE POLICY "Tenant admins update fiscal certificates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'certificados-fiscais' AND public.storage_path_empresa_allowed(name))
WITH CHECK (bucket_id = 'certificados-fiscais' AND public.storage_path_empresa_allowed(name));

CREATE POLICY "Tenant admins delete fiscal certificates"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'certificados-fiscais' AND public.storage_path_empresa_allowed(name));

-- ============ imagens-cardapio (public read, tenant-scoped writes) ============
DROP POLICY IF EXISTS "Admins can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete menu images" ON storage.objects;
-- "Anyone can view menu images" (public SELECT) is intentionally kept.

CREATE POLICY "Tenant admins can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'imagens-cardapio' AND public.storage_path_empresa_allowed(name));

CREATE POLICY "Tenant admins can update menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.storage_path_empresa_allowed(name))
WITH CHECK (bucket_id = 'imagens-cardapio' AND public.storage_path_empresa_allowed(name));

CREATE POLICY "Tenant admins can delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.storage_path_empresa_allowed(name));