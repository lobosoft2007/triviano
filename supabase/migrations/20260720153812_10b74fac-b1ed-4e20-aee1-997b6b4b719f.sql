CREATE OR REPLACE FUNCTION public.admin_get_product_detail(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_fiscais jsonb := '{}'::jsonb;
  v_price_options jsonb := '[]'::jsonb;
  v_addons jsonb := '[]'::jsonb;
  v_free_addons jsonb := '[]'::jsonb;
  v_ingredientes jsonb := '[]'::jsonb;
BEGIN
  SELECT p.*
    INTO v_product
  FROM public.products p
  WHERE p.id = p_id;

  IF v_product.id IS NULL OR NOT public.can_manage_empresa(v_product.empresa_id) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT COALESCE(ft.dados_fiscais, '{}'::jsonb)
    INTO v_fiscais
  FROM public.fichas_tecnicas ft
  WHERE ft.product_id = p_id
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', po.id,
        'tamanho', po.tamanho,
        'preco', po.preco,
        'preco_ifood', po.preco_ifood,
        'sort_order', po.sort_order
      )
      ORDER BY po.sort_order, po.tamanho
    ),
    '[]'::jsonb
  )
    INTO v_price_options
  FROM public.produtos_price_options po
  WHERE po.produto_id = p_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'nome', pa.nome,
        'preco', pa.preco,
        'preco_ifood', pa.preco_ifood,
        'sort_order', pa.sort_order
      )
      ORDER BY pa.sort_order, pa.nome
    ),
    '[]'::jsonb
  )
    INTO v_addons
  FROM public.produtos_addons pa
  WHERE pa.produto_id = p_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'nome', pfa.nome,
        'preco', pfa.preco,
        'sort_order', pfa.sort_order
      )
      ORDER BY pfa.sort_order, pfa.nome
    ),
    '[]'::jsonb
  )
    INTO v_free_addons
  FROM public.produtos_free_addons pfa
  WHERE pfa.produto_id = p_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tipo', CASE WHEN ip.subproduto_id IS NOT NULL THEN 'subproduto' ELSE 'insumo' END,
        'ref_id', COALESCE(ip.subproduto_id, ip.insumo_id),
        'nome', ip.nome,
        'quantidade', ip.quantidade,
        'permitir_exclusao', ip.permitir_exclusao,
        'price_option_id', ip.price_option_id,
        'sort_order', ip.sort_order
      )
      ORDER BY ip.sort_order, ip.nome
    ),
    '[]'::jsonb
  )
    INTO v_ingredientes
  FROM public.ingredientes_produto ip
  WHERE ip.product_id = p_id;

  RETURN jsonb_build_object(
    'product', jsonb_build_object(
      'id', v_product.id,
      'category_id', v_product.category_id,
      'name', v_product.name,
      'description', v_product.description,
      'price', v_product.price,
      'image_url', v_product.image_url,
      'available', v_product.available,
      'sort_order', v_product.sort_order,
      'free_addon_limit', v_product.free_addon_limit,
      'eixo_variacao', v_product.eixo_variacao,
      'manipulado', COALESCE(v_product.manipulado, true),
      'setor_id', v_product.setor_id,
      'fornecedor_id', v_product.fornecedor_id,
      'saldo_estoque', v_product.saldo_estoque,
      'estoque_minimo', v_product.estoque_minimo,
      'estoque_maximo', v_product.estoque_maximo,
      'margem_revenda', COALESCE(v_product.margem_revenda, 100),
      'custo_compra', COALESCE(v_product.custo_compra, 0),
      'preco_ideal_revenda', v_product.preco_ideal_revenda,
      'preco_ifood', v_product.preco_ifood
    ),
    'dados_fiscais', COALESCE(v_fiscais, '{}'::jsonb),
    'price_options', v_price_options,
    'addons', v_addons,
    'free_addons', v_free_addons,
    'ingredientes', v_ingredientes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_product_detail(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_get_product_detail(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_product_category_counts()
RETURNS TABLE(category_id uuid, product_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.category_id, count(*)::bigint AS product_count
  FROM public.products p
  WHERE p.category_id IS NOT NULL
    AND public.can_manage_empresa(p.empresa_id)
  GROUP BY p.category_id
$$;

GRANT EXECUTE ON FUNCTION public.admin_product_category_counts() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_product_category_counts() FROM anon;

CREATE OR REPLACE FUNCTION public.admin_quick_adjust_product(
  p_id uuid,
  p_saldo_estoque numeric,
  p_custo_compra numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  SELECT p.* INTO v_product
  FROM public.products p
  WHERE p.id = p_id;

  IF v_product.id IS NULL OR NOT public.can_manage_empresa(v_product.empresa_id) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  UPDATE public.products
  SET
    saldo_estoque = COALESCE(p_saldo_estoque, 0),
    custo_compra = CASE
      WHEN COALESCE(v_product.manipulado, true) = false AND p_custo_compra IS NOT NULL THEN p_custo_compra
      ELSE custo_compra
    END
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_quick_adjust_product(uuid, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_quick_adjust_product(uuid, numeric, numeric) FROM anon;