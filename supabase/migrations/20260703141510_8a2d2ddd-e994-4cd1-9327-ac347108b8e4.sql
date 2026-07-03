
-- =========================================================
-- 1) FIX: mutable search_path on email queue helper functions
--    (bodies preserved exactly; only SET search_path added)
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- =========================================================
-- 2) EMPRESAS: restrict authenticated to checkout/branding columns
-- =========================================================
-- Remove the broad table-level SELECT grant (exposed every column).
REVOKE SELECT ON public.empresas FROM authenticated;

-- Column-level SELECT for logged-in customers: only what checkout + theming need.
GRANT SELECT (
  id, nome_fantasia, logotipo_url, dominio_customizado, ativo,
  cor_primaria, cor_secundaria, modo_fundo, taxa_servico_mesa
) ON public.empresas TO authenticated;

-- Admin/super-admin full config read (address + cashback) via secured function.
CREATE OR REPLACE FUNCTION public.admin_get_empresa_config()
 RETURNS TABLE(
   id uuid, nome_fantasia text, logotipo_url text, taxa_servico_mesa numeric,
   dominio_customizado text, cep text, logradouro text, numero text, complemento text,
   bairro text, cidade text, estado text, ativo boolean,
   cor_primaria text, cor_secundaria text, modo_fundo text,
   percentual_cashback numeric, cashback_ativo boolean
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.nome_fantasia, e.logotipo_url, e.taxa_servico_mesa,
           e.dominio_customizado, e.cep, e.logradouro, e.numero, e.complemento,
           e.bairro, e.cidade, e.estado, e.ativo,
           e.cor_primaria, e.cor_secundaria, e.modo_fundo,
           e.percentual_cashback, e.cashback_ativo
    FROM public.empresas e
    WHERE e.ativo = true
    ORDER BY e.created_at ASC
    LIMIT 1;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_get_empresa_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_empresa_config() TO authenticated;

-- Super-admin ecosystem-wide listing via secured function.
CREATE OR REPLACE FUNCTION public.admin_list_empresas()
 RETURNS TABLE(
   id uuid, nome_fantasia text, logotipo_url text, taxa_servico_mesa numeric,
   dominio_customizado text, cep text, logradouro text, numero text, complemento text,
   bairro text, cidade text, estado text, ativo boolean,
   cor_primaria text, cor_secundaria text, modo_fundo text,
   percentual_cashback numeric, cashback_ativo boolean, created_at timestamptz
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.nome_fantasia, e.logotipo_url, e.taxa_servico_mesa,
           e.dominio_customizado, e.cep, e.logradouro, e.numero, e.complemento,
           e.bairro, e.cidade, e.estado, e.ativo,
           e.cor_primaria, e.cor_secundaria, e.modo_fundo,
           e.percentual_cashback, e.cashback_ativo, e.created_at
    FROM public.empresas e
    ORDER BY e.created_at ASC;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_list_empresas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_empresas() TO authenticated;

-- =========================================================
-- 3) INGREDIENTES_PRODUTO: hide internal reference columns
-- =========================================================
DROP POLICY IF EXISTS "Public can view removable ingredientes" ON public.ingredientes_produto;

-- Remove any all-column read access.
REVOKE SELECT ON public.ingredientes_produto FROM authenticated;
REVOKE SELECT (id, product_id, nome, insumo_id, subproduto_id, quantidade, permitir_exclusao, price_option_id, sort_order)
  ON public.ingredientes_produto FROM anon;

-- Safe columns only, for both roles (matches public menu needs).
GRANT SELECT (id, product_id, nome, permitir_exclusao, sort_order)
  ON public.ingredientes_produto TO anon, authenticated;

-- Restore row visibility of removable ingredients (safe columns only via grants).
CREATE POLICY "Public can view removable ingredientes"
  ON public.ingredientes_produto
  FOR SELECT
  TO anon, authenticated
  USING (permitir_exclusao = true);

-- Admin editor reads internal recipe columns via secured function.
CREATE OR REPLACE FUNCTION public.admin_get_ingredientes(p_product_id uuid)
 RETURNS TABLE(
   id uuid, product_id uuid, nome text, insumo_id uuid, subproduto_id uuid,
   quantidade numeric, permitir_exclusao boolean, price_option_id uuid, sort_order integer
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT i.id, i.product_id, i.nome, i.insumo_id, i.subproduto_id,
           i.quantidade, i.permitir_exclusao, i.price_option_id, i.sort_order
    FROM public.ingredientes_produto i
    WHERE i.product_id = p_product_id
    ORDER BY i.sort_order;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_get_ingredientes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ingredientes(uuid) TO authenticated;

-- =========================================================
-- 4) PRODUTOS_ADDONS: hide insumo_id / quantidade
-- =========================================================
REVOKE SELECT ON public.produtos_addons FROM authenticated;
REVOKE SELECT (id, produto_id, nome, preco, sort_order, insumo_id, quantidade)
  ON public.produtos_addons FROM anon;
GRANT SELECT (id, produto_id, nome, preco, sort_order)
  ON public.produtos_addons TO anon, authenticated;

-- =========================================================
-- 5) PRODUTOS_FREE_ADDONS: hide insumo_id / quantidade
-- =========================================================
REVOKE SELECT ON public.produtos_free_addons FROM authenticated;
REVOKE SELECT (id, produto_id, nome, preco, sort_order, insumo_id, quantidade)
  ON public.produtos_free_addons FROM anon;
GRANT SELECT (id, produto_id, nome, preco, sort_order)
  ON public.produtos_free_addons TO anon, authenticated;
