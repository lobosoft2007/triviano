CREATE OR REPLACE FUNCTION public.admin_get_product_detail_meta(p_id uuid)
RETURNS TABLE(
  manipulado boolean,
  setor_id uuid,
  fornecedor_id uuid,
  margem_revenda numeric,
  custo_compra numeric,
  preco_ifood numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_id
      AND public.can_manage_empresa(p.empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  RETURN QUERY
    SELECT
      p.manipulado,
      p.setor_id,
      p.fornecedor_id,
      COALESCE(p.margem_revenda, 100),
      COALESCE(p.custo_compra, 0),
      p.preco_ifood
    FROM public.products p
    WHERE p.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_product_core(
  p_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_price numeric,
  p_available boolean,
  p_image_url text,
  p_free_addon_limit integer,
  p_eixo_variacao text,
  p_saldo_estoque numeric,
  p_estoque_minimo numeric,
  p_estoque_maximo numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_product_empresa_id uuid;
  v_id uuid;
BEGIN
  SELECT c.empresa_id INTO v_empresa_id
  FROM public.categories c
  WHERE c.id = p_category_id;

  IF v_empresa_id IS NULL OR NOT public.can_manage_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT p.empresa_id INTO v_product_empresa_id
    FROM public.products p
    WHERE p.id = p_id;

    IF v_product_empresa_id IS NULL OR NOT public.can_manage_empresa(v_product_empresa_id) THEN
      RAISE EXCEPTION 'Acesso restrito.';
    END IF;

    UPDATE public.products
    SET
      category_id = p_category_id,
      name = trim(p_name),
      description = COALESCE(trim(p_description), ''),
      price = COALESCE(p_price, 0),
      available = COALESCE(p_available, true),
      image_url = COALESCE(p_image_url, ''),
      free_addon_limit = GREATEST(COALESCE(p_free_addon_limit, 0), 0),
      eixo_variacao = COALESCE(NULLIF(trim(p_eixo_variacao), ''), 'Tamanho'),
      saldo_estoque = COALESCE(p_saldo_estoque, 0),
      estoque_minimo = COALESCE(p_estoque_minimo, 0),
      estoque_maximo = COALESCE(p_estoque_maximo, 0),
      empresa_id = v_empresa_id
    WHERE id = p_id;

    RETURN p_id;
  END IF;

  INSERT INTO public.products (
    category_id,
    name,
    description,
    price,
    available,
    image_url,
    free_addon_limit,
    eixo_variacao,
    saldo_estoque,
    estoque_minimo,
    estoque_maximo,
    empresa_id
  ) VALUES (
    p_category_id,
    trim(p_name),
    COALESCE(trim(p_description), ''),
    COALESCE(p_price, 0),
    COALESCE(p_available, true),
    COALESCE(p_image_url, ''),
    GREATEST(COALESCE(p_free_addon_limit, 0), 0),
    COALESCE(NULLIF(trim(p_eixo_variacao), ''), 'Tamanho'),
    COALESCE(p_saldo_estoque, 0),
    COALESCE(p_estoque_minimo, 0),
    COALESCE(p_estoque_maximo, 0),
    v_empresa_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_product_detail_fields(
  p_id uuid,
  p_manipulado boolean,
  p_setor_id uuid,
  p_fornecedor_id uuid,
  p_margem_revenda numeric,
  p_custo_compra numeric,
  p_preco_ifood numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_id
      AND public.can_manage_empresa(p.empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  UPDATE public.products
  SET
    manipulado = COALESCE(p_manipulado, true),
    setor_id = CASE WHEN COALESCE(p_manipulado, true) THEN NULL ELSE p_setor_id END,
    fornecedor_id = CASE WHEN COALESCE(p_manipulado, true) THEN NULL ELSE p_fornecedor_id END,
    margem_revenda = COALESCE(p_margem_revenda, 100),
    custo_compra = CASE WHEN COALESCE(p_manipulado, true) THEN 0 ELSE round(COALESCE(p_custo_compra, 0), 2) END,
    preco_ifood = CASE WHEN p_preco_ifood IS NOT NULL AND p_preco_ifood > 0 THEN round(p_preco_ifood, 2) ELSE NULL END
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_product_custo_total(
  p_id uuid,
  p_custo_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_id
      AND public.can_manage_empresa(p.empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  UPDATE public.products
  SET custo_total = round(COALESCE(p_custo_total, 0), 2)
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_id
      AND public.can_manage_empresa(p.empresa_id)
  ) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  DELETE FROM public.products
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_product_detail_meta(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_product_core(uuid, uuid, text, text, numeric, boolean, text, integer, text, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_detail_fields(uuid, boolean, uuid, uuid, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_custo_total(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_product(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_product_detail_meta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product_core(uuid, uuid, text, text, numeric, boolean, text, integer, text, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_detail_fields(uuid, boolean, uuid, uuid, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_custo_total(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid) TO authenticated;