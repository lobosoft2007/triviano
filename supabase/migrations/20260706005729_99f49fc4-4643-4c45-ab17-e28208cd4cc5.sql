ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custo_total numeric DEFAULT 0;

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
      p.custo_anterior, p.custo_total,
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