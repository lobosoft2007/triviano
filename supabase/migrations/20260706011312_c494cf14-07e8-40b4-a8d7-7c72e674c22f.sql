
-- Unit cost of a subproduto per KG (or per yield unit).
CREATE OR REPLACE FUNCTION public.subproduto_unit_cost(p_sub_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    SUM(cs.quantidade * COALESCE(NULLIF(i.fator_conversao, 0), 1) * COALESCE(i.custo_unitario, 0)),
    0
  ) / COALESCE(
    NULLIF((SELECT rendimento_porcoes FROM public.subprodutos WHERE id = p_sub_id), 0),
    1
  )
  FROM public.composicao_subproduto cs
  JOIN public.insumos i ON i.id = cs.insumo_id
  WHERE cs.subproduto_id = p_sub_id;
$$;

-- Highest CMV (production cost) of a product: base recipe + most expensive variation.
CREATE OR REPLACE FUNCTION public.compute_product_cmv(p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_manipulado boolean;
  v_price numeric;
  v_base numeric := 0;
  v_max_var numeric := 0;
BEGIN
  SELECT manipulado, price INTO v_manipulado, v_price
  FROM public.products WHERE id = p_product_id;

  IF NOT COALESCE(v_manipulado, true) THEN
    RETURN ROUND(COALESCE(v_price, 0), 2);
  END IF;

  -- Base recipe (lines not tied to a variation).
  SELECT COALESCE(SUM(
    ip.quantidade * CASE
      WHEN ip.insumo_id IS NOT NULL
        THEN COALESCE(NULLIF(i.fator_conversao, 0), 1) * COALESCE(i.custo_unitario, 0)
      WHEN ip.subproduto_id IS NOT NULL
        THEN public.subproduto_unit_cost(ip.subproduto_id)
      ELSE 0
    END
  ), 0) INTO v_base
  FROM public.ingredientes_produto ip
  LEFT JOIN public.insumos i ON i.id = ip.insumo_id
  WHERE ip.product_id = p_product_id AND ip.price_option_id IS NULL;

  -- Most expensive variation (lines grouped by price_option_id).
  SELECT COALESCE(MAX(var_cost), 0) INTO v_max_var FROM (
    SELECT ip.price_option_id, SUM(
      ip.quantidade * CASE
        WHEN ip.insumo_id IS NOT NULL
          THEN COALESCE(NULLIF(i.fator_conversao, 0), 1) * COALESCE(i.custo_unitario, 0)
        WHEN ip.subproduto_id IS NOT NULL
          THEN public.subproduto_unit_cost(ip.subproduto_id)
        ELSE 0
      END
    ) AS var_cost
    FROM public.ingredientes_produto ip
    LEFT JOIN public.insumos i ON i.id = ip.insumo_id
    WHERE ip.product_id = p_product_id AND ip.price_option_id IS NOT NULL
    GROUP BY ip.price_option_id
  ) t;

  RETURN ROUND(v_base + v_max_var, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subproduto_unit_cost(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_product_cmv(uuid) TO authenticated, service_role;

-- admin_get_products now returns the live, correct CMV as custo_total.
DROP FUNCTION IF EXISTS public.admin_get_products(uuid, boolean);

CREATE OR REPLACE FUNCTION public.admin_get_products(
  p_id uuid DEFAULT NULL::uuid,
  p_only_manipulado_false boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, category_id uuid, name text, description text, price numeric,
  image_url text, available boolean, sort_order integer, free_addon_limit integer,
  eixo_variacao text, manipulado boolean, setor_id uuid, fornecedor_id uuid,
  saldo_estoque numeric, estoque_minimo numeric, estoque_maximo numeric,
  custo_anterior numeric, custo_total numeric, disponivel boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT
      p.id, p.category_id, p.name, p.description, p.price,
      p.image_url, p.available, p.sort_order, p.free_addon_limit,
      p.eixo_variacao, p.manipulado, p.setor_id, p.fornecedor_id,
      p.saldo_estoque, p.estoque_minimo, p.estoque_maximo,
      p.custo_anterior,
      public.compute_product_cmv(p.id) AS custo_total,
      CASE
        WHEN p.manipulado = false THEN
          NOT (p.estoque_maximo > 0 AND p.saldo_estoque <= 0)
        ELSE
          NOT EXISTS (
            SELECT 1
            FROM public.ingredientes_produto ip
            JOIN public.insumos i ON i.id = ip.insumo_id
            WHERE ip.product_id = p.id
              AND ip.price_option_id IS NULL
              AND i.controlado = true
              AND i.estocavel = true
              AND i.saldo_estoque < (ip.quantidade * COALESCE(NULLIF(i.fator_conversao, 0), 1))
          )
      END AS disponivel
    FROM public.products p
    WHERE (p_id IS NULL OR p.id = p_id)
      AND (NOT p_only_manipulado_false OR p.manipulado = false)
    ORDER BY p.sort_order;
END;
$$;
