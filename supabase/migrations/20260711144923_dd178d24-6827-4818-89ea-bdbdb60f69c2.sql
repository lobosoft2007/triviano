CREATE OR REPLACE FUNCTION public.repeat_order(p_order_id uuid, p_host text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_empresa uuid;
  v_status text;
  v_aguardando boolean;
  v_pago_online boolean;

  v_item RECORD;
  v_addon jsonb;

  v_price numeric;
  v_pname text;
  v_free_limit integer;
  v_catid uuid;
  v_slug text;
  v_combo_role text;
  v_allows_half boolean;
  v_img text;

  v_base numeric;
  v_bp numeric;
  v_secbase numeric;
  v_is_acai boolean;
  v_free_price numeric;
  v_total_free numeric;
  v_overflow numeric;
  v_premium numeric;
  v_addons_total numeric;
  v_aname text;
  v_aqty numeric;
  v_aprice numeric;
  v_unit numeric;
  v_display text;
  v_opt_count integer;

  v_addons_out jsonb;
  v_items_out jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_available integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.';
  END IF;

  SELECT o.user_id, o.empresa_id, o.status,
         COALESCE(o.aguardando_pagamento, false), COALESCE(o.pago_online, false)
    INTO v_owner, v_empresa, v_status, v_aguardando, v_pago_online
    FROM public.orders o
    WHERE o.id = p_order_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Pedido inválido para este usuário.';
  END IF;

  -- Elegibilidade: rascunho / aguardando pagamento não podem ser repetidos.
  IF v_status IN ('rascunho_pagamento', 'pagamento_abandonado')
     OR (v_aguardando = true AND v_pago_online = false) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'total_items', 0,
      'available_items', 0,
      'skipped_items', 0,
      'items', '[]'::jsonb
    );
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.size, oi.second_flavor, oi.addons, oi.remocoes
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    v_total := v_total + 1;

    SELECT p.price, p.name, p.free_addon_limit, p.category_id, p.image_url,
           c.slug, c.combo_role, c.allows_half
      INTO v_price, v_pname, v_free_limit, v_catid, v_img, v_slug, v_combo_role, v_allows_half
      FROM public.products p
      JOIN public.categories c ON c.id = p.category_id
      WHERE p.id = v_item.product_id
        AND p.available = true
        AND p.empresa_id = v_empresa;

    -- Item saiu do cardápio (ou indisponível) -> pula.
    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- base pelo tamanho
    SELECT preco INTO v_base FROM public.produtos_price_options
      WHERE produto_id = v_item.product_id AND tamanho = COALESCE(v_item.size, '')
      ORDER BY sort_order LIMIT 1;
    IF v_base IS NULL THEN v_base := v_price; END IF;

    v_is_acai := (COALESCE(v_free_limit, 0) > 0
      AND EXISTS (SELECT 1 FROM public.produtos_free_addons WHERE produto_id = v_item.product_id));

    v_addons_out := '[]'::jsonb;

    IF v_is_acai THEN
      v_total_free := 0;
      v_premium := 0;
      SELECT preco INTO v_free_price FROM public.produtos_free_addons
        WHERE produto_id = v_item.product_id ORDER BY sort_order LIMIT 1;
      v_free_price := COALESCE(v_free_price, 0);

      IF jsonb_typeof(v_item.addons) = 'array' THEN
        FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item.addons) LOOP
          v_aname := COALESCE(v_addon->>'name', v_addon->>'nome', '');
          v_aqty := COALESCE(NULLIF(v_addon->>'quantity','')::numeric, 1);
          IF v_aname = '' THEN CONTINUE; END IF;
          IF EXISTS (SELECT 1 FROM public.produtos_free_addons
                     WHERE produto_id = v_item.product_id AND nome = v_aname) THEN
            v_total_free := v_total_free + v_aqty;
            v_addons_out := v_addons_out || jsonb_build_object(
              'name', v_aname, 'price', 0, 'quantity', v_aqty);
          ELSE
            SELECT preco INTO v_aprice FROM public.produtos_addons
              WHERE produto_id = v_item.product_id AND nome = v_aname LIMIT 1;
            IF v_aprice IS NOT NULL THEN
              v_premium := v_premium + v_aqty * v_aprice;
              v_addons_out := v_addons_out || jsonb_build_object(
                'name', v_aname, 'price', v_aprice, 'quantity', v_aqty);
            END IF;
          END IF;
        END LOOP;
      END IF;

      v_overflow := GREATEST(0, v_total_free - COALESCE(v_free_limit, 0));
      v_unit := round(v_base + v_overflow * v_free_price + v_premium, 2);
    ELSE
      v_bp := v_base;
      IF v_allows_half AND COALESCE(v_item.second_flavor, '') <> '' THEN
        SELECT po.preco INTO v_secbase
          FROM public.produtos_price_options po
          JOIN public.products sp ON sp.id = po.produto_id
          WHERE sp.name = v_item.second_flavor AND sp.category_id = v_catid
            AND sp.available = true
          ORDER BY po.sort_order LIMIT 1;
        IF v_secbase IS NULL THEN
          SELECT price INTO v_secbase FROM public.products
            WHERE name = v_item.second_flavor AND category_id = v_catid
              AND available = true LIMIT 1;
        END IF;
        -- Se o 2º sabor sumiu do cardápio, degrada para sabor único (v_secbase nulo).
        IF v_secbase IS NOT NULL THEN
          v_bp := round((v_base + v_secbase) / 2, 2);
        END IF;
      END IF;

      v_addons_total := 0;
      IF jsonb_typeof(v_item.addons) = 'array' THEN
        FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item.addons) LOOP
          v_aname := COALESCE(v_addon->>'name', v_addon->>'nome', '');
          v_aqty := COALESCE(NULLIF(v_addon->>'quantity','')::numeric, 1);
          IF v_aname = '' THEN CONTINUE; END IF;
          SELECT preco INTO v_aprice FROM public.produtos_addons
            WHERE produto_id = v_item.product_id AND nome = v_aname LIMIT 1;
          IF v_aprice IS NOT NULL THEN
            v_addons_total := v_addons_total + v_aprice;
            v_addons_out := v_addons_out || jsonb_build_object(
              'name', v_aname, 'price', v_aprice, 'quantity', GREATEST(1, floor(v_aqty))::int);
          END IF;
        END LOOP;
      END IF;

      v_unit := round(v_bp + v_addons_total, 2);
    END IF;

    -- display_name igual ao create_order
    SELECT count(*) INTO v_opt_count FROM public.produtos_price_options
      WHERE produto_id = v_item.product_id;
    IF v_allows_half AND COALESCE(v_item.second_flavor, '') <> ''
       AND v_bp IS DISTINCT FROM v_base THEN
      v_display := '½ ' || v_pname || ' / ½ ' || v_item.second_flavor;
    ELSIF v_opt_count > 1 THEN
      v_display := v_pname || ' (' || COALESCE(v_item.size, '') || ')';
    ELSE
      v_display := v_pname;
    END IF;

    v_available := v_available + 1;

    v_items_out := v_items_out || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_pname,
      'display_name', v_display,
      'category_slug', COALESCE(v_slug, ''),
      'combo_role', COALESCE(v_combo_role, ''),
      'size', COALESCE(v_item.size, ''),
      'second_flavor',
        CASE WHEN v_allows_half AND v_bp IS DISTINCT FROM v_base
             THEN COALESCE(v_item.second_flavor, '') ELSE '' END,
      'addons', v_addons_out,
      'remocoes', COALESCE(to_jsonb(v_item.remocoes), '[]'::jsonb),
      'unit_price', v_unit,
      'image_url', COALESCE(v_img, ''),
      'quantity', GREATEST(1, v_item.quantity)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'eligible', true,
    'total_items', v_total,
    'available_items', v_available,
    'skipped_items', v_skipped,
    'items', v_items_out
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repeat_order(uuid, text) TO authenticated;