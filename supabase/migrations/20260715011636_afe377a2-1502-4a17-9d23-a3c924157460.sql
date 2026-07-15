
REVOKE SELECT ON public.categories FROM anon;
GRANT SELECT (
  id, empresa_id, name, slug, sort_order, min_items, allows_half,
  combo_role, cor_fonte, tamanho_fonte, created_at
) ON public.categories TO anon;

CREATE OR REPLACE FUNCTION public.storage_path_is_empresa_ativa(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  RETURN EXISTS (SELECT 1 FROM public.empresas WHERE id = v_uuid AND ativo = true);
END;
$function$;

DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
CREATE POLICY "Anyone can view menu images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'imagens-cardapio'
  AND public.storage_path_is_empresa_ativa(name)
);
