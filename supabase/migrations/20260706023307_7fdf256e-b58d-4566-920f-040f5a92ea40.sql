-- ============================================================
-- Mark-up / formação de preço por margem de revenda
-- ============================================================

-- 1) Novos campos na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS margem_revenda numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS preco_ideal_revenda numeric,
  ADD COLUMN IF NOT EXISTS custo_compra numeric NOT NULL DEFAULT 0;

UPDATE public.products
  SET custo_compra = COALESCE(NULLIF(custo_total, 0), price)
  WHERE manipulado = false AND COALESCE(custo_compra, 0) = 0;

-- 2) CMV de itens de revenda passa a refletir o custo de compra real
CREATE OR REPLACE FUNCTION public.compute_product_cmv(p_product_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manipulado boolean;
  v_price numeric;
  v_custo_compra numeric;
  v_base numeric := 0;
  v_max_var numeric := 0;
BEGIN
  SELECT manipulado, price, COALESCE(custo_compra, 0)
    INTO v_manipulado, v_price, v_custo_compra
  FROM public.products WHERE id = p_product_id;

  IF NOT COALESCE(v_manipulado, true) THEN
    RETURN ROUND(COALESCE(v_custo_compra, 0), 2);
  END IF;

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
$function$;

-- 3) Preço ideal de revenda = base * (1 + margem/100) via trigger BEFORE
CREATE OR REPLACE FUNCTION public.products_set_preco_ideal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base numeric;
BEGIN
  IF COALESCE(NEW.manipulado, true) THEN
    v_base := public.compute_product_cmv(NEW.id);
  ELSE
    v_base := COALESCE(NEW.custo_compra, 0);
  END IF;
  NEW.preco_ideal_revenda := ROUND(v_base * (1 + COALESCE(NEW.margem_revenda, 100) / 100.0), 2);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_products_preco_ideal ON public.products;
CREATE TRIGGER trg_products_preco_ideal
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_set_preco_ideal();

-- 4) Recalcular manipulados quando a ficha técnica muda
CREATE OR REPLACE FUNCTION public.recompute_manipulado_preco_ideal(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.products p
    SET preco_ideal_revenda = ROUND(
      public.compute_product_cmv(p.id) * (1 + COALESCE(p.margem_revenda, 100) / 100.0), 2)
    WHERE p.id = ANY(p_ids) AND COALESCE(p.manipulado, true) = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ingredientes_recompute_ideal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recompute_manipulado_preco_ideal(
    ARRAY[COALESCE(NEW.product_id, OLD.product_id)]);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ing_recompute_ideal ON public.ingredientes_produto;
CREATE TRIGGER trg_ing_recompute_ideal
  AFTER INSERT OR UPDATE OR DELETE ON public.ingredientes_produto
  FOR EACH ROW EXECUTE FUNCTION public.ingredientes_recompute_ideal();

-- 5) Recalcular manipulados quando o custo de um insumo muda
CREATE OR REPLACE FUNCTION public.insumos_recompute_ideal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.custo_unitario IS DISTINCT FROM OLD.custo_unitario THEN
    UPDATE public.products p
      SET preco_ideal_revenda = ROUND(
        public.compute_product_cmv(p.id) * (1 + COALESCE(p.margem_revenda, 100) / 100.0), 2)
      WHERE COALESCE(p.manipulado, true) = true
        AND p.id IN (
          SELECT ip.product_id FROM public.ingredientes_produto ip
            WHERE ip.insumo_id = NEW.id
          UNION
          SELECT ip.product_id FROM public.ingredientes_produto ip
            JOIN public.composicao_subproduto cs ON cs.subproduto_id = ip.subproduto_id
            WHERE cs.insumo_id = NEW.id
        );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_insumos_recompute_ideal ON public.insumos;
CREATE TRIGGER trg_insumos_recompute_ideal
  AFTER UPDATE ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION public.insumos_recompute_ideal();

-- 6) Backfill do preço ideal para todos os produtos existentes
UPDATE public.products
  SET preco_ideal_revenda = ROUND(
    (CASE WHEN COALESCE(manipulado, true)
       THEN public.compute_product_cmv(id)
       ELSE COALESCE(custo_compra, 0) END)
    * (1 + COALESCE(margem_revenda, 100) / 100.0), 2);

-- 7) admin_get_products expõe os novos campos
DROP FUNCTION IF EXISTS public.admin_get_products(uuid, boolean);
CREATE OR REPLACE FUNCTION public.admin_get_products(p_id uuid DEFAULT NULL::uuid, p_only_manipulado_false boolean DEFAULT false)
 RETURNS TABLE(id uuid, category_id uuid, name text, description text, price numeric, image_url text, available boolean, sort_order integer, free_addon_limit integer, eixo_variacao text, manipulado boolean, setor_id uuid, fornecedor_id uuid, saldo_estoque numeric, estoque_minimo numeric, estoque_maximo numeric, custo_anterior numeric, custo_total numeric, disponivel boolean, margem_revenda numeric, custo_compra numeric, preco_ideal_revenda numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      END AS disponivel,
      COALESCE(p.margem_revenda, 100) AS margem_revenda,
      COALESCE(p.custo_compra, 0) AS custo_compra,
      p.preco_ideal_revenda
    FROM public.products p
    WHERE (p_id IS NULL OR p.id = p_id)
      AND (NOT p_only_manipulado_false OR p.manipulado = false)
    ORDER BY p.sort_order;
END;
$function$;