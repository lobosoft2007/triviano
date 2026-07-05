
CREATE OR REPLACE FUNCTION public.get_menu_availability()
 RETURNS TABLE(id uuid, esgotado boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id,
    CASE
      WHEN p.manipulado = false THEN (p.estoque_maximo > 0 AND p.saldo_estoque <= 0)
      ELSE EXISTS (
        SELECT 1
        FROM public.ingredientes_produto ip
        JOIN public.insumos i ON i.id = ip.insumo_id
        WHERE ip.product_id = p.id
          AND ip.price_option_id IS NULL
          AND i.controlado = true
          AND i.estocavel = true
          AND i.saldo_estoque < (ip.quantidade * COALESCE(NULLIF(i.fator_conversao, 0), 1))
      )
    END AS esgotado
  FROM public.products p
  WHERE p.available = true;
$function$;

CREATE OR REPLACE FUNCTION public.explode_order_stock(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_ing RECORD;
  v_comp RECORD;
  v_addon jsonb;
  v_addon_name text;
  v_addon_qtd numeric;
  v_rend numeric;
  v_done boolean;
  v_po uuid;
  v_fator numeric;
  v_controlado boolean;
  v_nome text;
  v_saldo numeric;
  v_deduct numeric;
BEGIN
  SELECT estoque_baixado INTO v_done FROM public.orders WHERE id = p_order_id;
  IF COALESCE(v_done, false) THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.size, oi.addons, oi.remocoes, p.manipulado
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    IF v_item.manipulado = false THEN
      UPDATE public.products
        SET saldo_estoque = saldo_estoque - v_item.quantity
        WHERE id = v_item.product_id;
      CONTINUE;
    END IF;

    v_po := NULL;
    IF COALESCE(v_item.size, '') <> '' THEN
      SELECT id INTO v_po FROM public.produtos_price_options
        WHERE produto_id = v_item.product_id AND tamanho = v_item.size
        LIMIT 1;
    END IF;

    FOR v_ing IN
      SELECT ip.insumo_id, ip.subproduto_id, ip.quantidade, ip.nome
      FROM public.ingredientes_produto ip
      WHERE ip.product_id = v_item.product_id
        AND (ip.price_option_id IS NULL OR ip.price_option_id = v_po)
    LOOP
      IF v_item.remocoes IS NOT NULL AND v_ing.nome = ANY(v_item.remocoes) THEN
        CONTINUE;
      END IF;

      IF v_ing.insumo_id IS NOT NULL THEN
        SELECT fator_conversao, controlado, nome
          INTO v_fator, v_controlado, v_nome
          FROM public.insumos WHERE id = v_ing.insumo_id AND estocavel = true;
        IF FOUND THEN
          v_deduct := (v_ing.quantidade * v_item.quantity) * COALESCE(NULLIF(v_fator, 0), 1);
          UPDATE public.insumos
            SET saldo_estoque = saldo_estoque - v_deduct, updated_at = now()
            WHERE id = v_ing.insumo_id
            RETURNING saldo_estoque, controlado, nome INTO v_saldo, v_controlado, v_nome;
          IF v_controlado AND v_saldo < 0 THEN
            RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE: %', v_nome USING ERRCODE = 'P0001';
          END IF;
        END IF;

      ELSIF v_ing.subproduto_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(rendimento_porcoes, 0), 1) INTO v_rend
          FROM public.subprodutos WHERE id = v_ing.subproduto_id;
        IF v_rend IS NULL THEN v_rend := 1; END IF;
        FOR v_comp IN
          SELECT cs.insumo_id, cs.quantidade
          FROM public.composicao_subproduto cs
          WHERE cs.subproduto_id = v_ing.subproduto_id
        LOOP
          SELECT fator_conversao, controlado, nome
            INTO v_fator, v_controlado, v_nome
            FROM public.insumos WHERE id = v_comp.insumo_id AND estocavel = true;
          IF FOUND THEN
            v_deduct := (v_comp.quantidade / v_rend * v_ing.quantidade * v_item.quantity)
                        * COALESCE(NULLIF(v_fator, 0), 1);
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque - v_deduct, updated_at = now()
              WHERE id = v_comp.insumo_id
              RETURNING saldo_estoque, controlado, nome INTO v_saldo, v_controlado, v_nome;
            IF v_controlado AND v_saldo < 0 THEN
              RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE: %', v_nome USING ERRCODE = 'P0001';
            END IF;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    IF jsonb_typeof(v_item.addons) = 'array' THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item.addons)
      LOOP
        v_addon_name := COALESCE(v_addon->>'name', v_addon->>'nome', '');
        v_addon_qtd := COALESCE(NULLIF(v_addon->>'quantity', '')::numeric, 1);
        IF v_addon_name = '' THEN CONTINUE; END IF;
        FOR v_ing IN
          SELECT insumo_id, quantidade FROM public.produtos_addons
            WHERE produto_id = v_item.product_id AND nome = v_addon_name AND insumo_id IS NOT NULL
          UNION ALL
          SELECT insumo_id, quantidade FROM public.produtos_free_addons
            WHERE produto_id = v_item.product_id AND nome = v_addon_name AND insumo_id IS NOT NULL
        LOOP
          SELECT fator_conversao, controlado, nome
            INTO v_fator, v_controlado, v_nome
            FROM public.insumos WHERE id = v_ing.insumo_id AND estocavel = true;
          IF FOUND THEN
            v_deduct := (v_ing.quantidade * v_addon_qtd * v_item.quantity) * COALESCE(NULLIF(v_fator, 0), 1);
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque - v_deduct, updated_at = now()
              WHERE id = v_ing.insumo_id
              RETURNING saldo_estoque, controlado, nome INTO v_saldo, v_controlado, v_nome;
            IF v_controlado AND v_saldo < 0 THEN
              RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE: %', v_nome USING ERRCODE = 'P0001';
            END IF;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.orders SET estoque_baixado = true WHERE id = p_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_order_stock(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_ing RECORD;
  v_comp RECORD;
  v_addon jsonb;
  v_addon_name text;
  v_addon_qtd numeric;
  v_rend numeric;
  v_done boolean;
  v_po uuid;
  v_fator numeric;
  v_add numeric;
BEGIN
  SELECT estoque_baixado INTO v_done FROM public.orders WHERE id = p_order_id;
  IF NOT COALESCE(v_done, false) THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.size, oi.addons, oi.remocoes, p.manipulado
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    IF v_item.manipulado = false THEN
      UPDATE public.products
        SET saldo_estoque = saldo_estoque + v_item.quantity
        WHERE id = v_item.product_id;
      CONTINUE;
    END IF;

    v_po := NULL;
    IF COALESCE(v_item.size, '') <> '' THEN
      SELECT id INTO v_po FROM public.produtos_price_options
        WHERE produto_id = v_item.product_id AND tamanho = v_item.size
        LIMIT 1;
    END IF;

    FOR v_ing IN
      SELECT ip.insumo_id, ip.subproduto_id, ip.quantidade, ip.nome
      FROM public.ingredientes_produto ip
      WHERE ip.product_id = v_item.product_id
        AND (ip.price_option_id IS NULL OR ip.price_option_id = v_po)
    LOOP
      IF v_item.remocoes IS NOT NULL AND v_ing.nome = ANY(v_item.remocoes) THEN
        CONTINUE;
      END IF;

      IF v_ing.insumo_id IS NOT NULL THEN
        SELECT fator_conversao INTO v_fator
          FROM public.insumos WHERE id = v_ing.insumo_id AND estocavel = true;
        IF FOUND THEN
          v_add := (v_ing.quantidade * v_item.quantity) * COALESCE(NULLIF(v_fator, 0), 1);
          UPDATE public.insumos
            SET saldo_estoque = saldo_estoque + v_add, updated_at = now()
            WHERE id = v_ing.insumo_id;
        END IF;
      ELSIF v_ing.subproduto_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(rendimento_porcoes, 0), 1) INTO v_rend
          FROM public.subprodutos WHERE id = v_ing.subproduto_id;
        IF v_rend IS NULL THEN v_rend := 1; END IF;
        FOR v_comp IN
          SELECT cs.insumo_id, cs.quantidade
          FROM public.composicao_subproduto cs
          WHERE cs.subproduto_id = v_ing.subproduto_id
        LOOP
          SELECT fator_conversao INTO v_fator
            FROM public.insumos WHERE id = v_comp.insumo_id AND estocavel = true;
          IF FOUND THEN
            v_add := (v_comp.quantidade / v_rend * v_ing.quantidade * v_item.quantity)
                     * COALESCE(NULLIF(v_fator, 0), 1);
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque + v_add, updated_at = now()
              WHERE id = v_comp.insumo_id;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    IF jsonb_typeof(v_item.addons) = 'array' THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item.addons)
      LOOP
        v_addon_name := COALESCE(v_addon->>'name', v_addon->>'nome', '');
        v_addon_qtd := COALESCE(NULLIF(v_addon->>'quantity', '')::numeric, 1);
        IF v_addon_name = '' THEN CONTINUE; END IF;
        FOR v_ing IN
          SELECT insumo_id, quantidade FROM public.produtos_addons
            WHERE produto_id = v_item.product_id AND nome = v_addon_name AND insumo_id IS NOT NULL
          UNION ALL
          SELECT insumo_id, quantidade FROM public.produtos_free_addons
            WHERE produto_id = v_item.product_id AND nome = v_addon_name AND insumo_id IS NOT NULL
        LOOP
          SELECT fator_conversao INTO v_fator
            FROM public.insumos WHERE id = v_ing.insumo_id AND estocavel = true;
          IF FOUND THEN
            v_add := (v_ing.quantidade * v_addon_qtd * v_item.quantity) * COALESCE(NULLIF(v_fator, 0), 1);
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque + v_add, updated_at = now()
              WHERE id = v_ing.insumo_id;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.orders SET estoque_baixado = false WHERE id = p_order_id;
END;
$function$;
