-- 1) Remove a constraint antiga ANTES do backfill (ela não conhece 'Finalizado')
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_pedido_check;

-- 2) Backfill dos pedidos existentes
UPDATE public.orders
   SET status_pedido = 'Finalizado'
 WHERE status_pedido = 'Encerrado e pago';

-- 3) Adiciona a nova constraint com 'Finalizado'
ALTER TABLE public.orders ADD CONSTRAINT orders_status_pedido_check
  CHECK (status_pedido = ANY (ARRAY[
    'Recebido'::text,
    'Em preparação'::text,
    'Pronto'::text,
    'Aguardando entregador'::text,
    'Em entrega'::text,
    'Entregue'::text,
    'Finalizado'::text,
    'Cancelado'::text
  ]));

-- 4) Recria finalize_order_paid com 'Finalizado'
CREATE OR REPLACE FUNCTION public.finalize_order_paid(p_order_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_total numeric;
  v_status text;
  v_caixa uuid;
  v_pag RECORD;
  v_disp numeric;
  v_conta RECORD;
  v_liquido numeric;
  v_empresa uuid;
  v_novo_cash numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT user_id, total, status_pedido INTO v_user, v_total, v_status
  FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Finalizado' THEN RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user); END IF;

  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto'
      AND public.user_empresa_id(id_usuario) = public.current_empresa_id()
    ORDER BY data_hora_abertura DESC LIMIT 1;

  FOR v_pag IN
    SELECT pp.valor_pago, pp.id_meio_pagamento, mp.nome
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = p_order_id
  LOOP
    IF v_caixa IS NOT NULL AND v_pag.id_meio_pagamento IS NOT NULL THEN
      INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
      VALUES (v_caixa, 'Recebimento Pedido', v_pag.valor_pago,
        'Pedido ' || substr(p_order_id::text,1,6) || ' (' || v_pag.nome || ')', v_pag.id_meio_pagamento);
    END IF;

    SELECT * INTO v_conta FROM public.contas_financeiras
      WHERE id_meio_pagamento = v_pag.id_meio_pagamento AND ativo = true
      ORDER BY updated_at DESC LIMIT 1;
    IF v_conta.id IS NOT NULL THEN
      v_liquido := round(v_pag.valor_pago * (1 - COALESCE(v_conta.taxa_percentual,0) / 100.0), 2);
      INSERT INTO public.lancamentos_tesouraria
        (id_conta_financeira, tipo, valor, categoria_fluxo, descricao, id_pedido, data_competencia, data_liquidacao)
      VALUES (v_conta.id, 'Entrada', v_liquido, 'Venda',
        'Recebível cartão - Pedido ' || substr(p_order_id::text,1,6) ||
        ' (taxa ' || COALESCE(v_conta.taxa_percentual,0) || '%)',
        p_order_id, now(), now() + (COALESCE(v_conta.dias_liquidacao,0) || ' days')::interval);
    END IF;

    IF v_pag.nome = 'Fiado' THEN
      IF NOT (SELECT fiado_autorizado FROM public.profiles WHERE id = v_user) THEN
        RAISE EXCEPTION 'Cliente não está autorizado a comprar no fiado.';
      END IF;
      SELECT (limite_fiado - saldo_devedor_fiado) INTO v_disp
        FROM public.profiles WHERE id = v_user;
      IF v_pag.valor_pago > v_disp THEN
        RAISE EXCEPTION 'Limite de fiado insuficiente. Disponível: %', v_disp;
      END IF;
      UPDATE public.profiles SET saldo_devedor_fiado = saldo_devedor_fiado + v_pag.valor_pago
        WHERE id = v_user;
      INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
      VALUES (v_user, p_order_id, 'Debito_Compra', v_pag.valor_pago,
        (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user), v_empresa);
      INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, id_pedido, saldo_devedor_momento)
      VALUES (v_user, v_empresa, 'Debito', v_pag.valor_pago,
        'Compra no fiado - Pedido ' || substr(p_order_id::text,1,6),
        p_order_id, (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user));

      UPDATE public.clientes_fiado
        SET saldo_devedor_atual = (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user),
            updated_at = now()
        WHERE user_id = v_user;
      PERFORM public.notify_fiado(v_user, v_pag.valor_pago, 'debito_compra');
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user
        RETURNING saldo_cashback INTO v_novo_cash;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa', v_empresa);
      INSERT INTO public.extrato_cashback
        (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
      VALUES (COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023'),
        v_user, p_order_id, 'debito_uso', v_pag.valor_pago, COALESCE(v_novo_cash, 0));
    END IF;
  END LOOP;

  PERFORM public.explode_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Finalizado', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- 5) Recria award_order_cashback com 'Finalizado'
CREATE OR REPLACE FUNCTION public.award_order_cashback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid; v_emp uuid; v_pct numeric; v_ativo boolean;
  v_cashback numeric; v_has_fiado boolean; v_novo_saldo numeric;
BEGIN
  IF NEW.status_pedido <> 'Finalizado'
     OR OLD.status_pedido IS NOT DISTINCT FROM NEW.status_pedido THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.extrato_cashback
    WHERE pedido_id = NEW.id AND tipo_movimentacao = 'credito_ganho'
  ) THEN
    RETURN NEW;
  END IF;

  v_user := NEW.user_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = NEW.id AND mp.nome = 'Fiado'
  ) INTO v_has_fiado;
  IF v_has_fiado THEN RETURN NEW; END IF;

  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = v_user;
  SELECT percentual_cashback, cashback_ativo INTO v_pct, v_ativo
    FROM public.empresas WHERE id = v_emp;
  IF NOT COALESCE(v_ativo, true) THEN RETURN NEW; END IF;

  v_cashback := round(COALESCE(NEW.total, 0) * COALESCE(v_pct, 0) / 100.0, 2);
  IF v_cashback <= 0 THEN RETURN NEW; END IF;

  UPDATE public.profiles
    SET saldo_cashback = saldo_cashback + v_cashback
    WHERE id = v_user
    RETURNING saldo_cashback INTO v_novo_saldo;

  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
  VALUES (v_user, NEW.id, 'Credito', v_cashback,
    'Cashback de ' || COALESCE(v_pct,0) || '% sobre a compra', v_emp);

  INSERT INTO public.extrato_cashback
    (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
  VALUES (COALESCE(v_emp, '00000000-0000-0000-0000-000000000023'),
    v_user, NEW.id, 'credito_ganho', v_cashback, v_novo_saldo);

  PERFORM public.notify_cashback(v_user, v_cashback, 'credito_ganho');

  RETURN NEW;
END;
$function$;

-- 6) Recria repeat_order: só permite repetir pedidos 'Finalizado' ou 'Cancelado'
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
  v_status_pedido text;

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

  SELECT o.user_id, o.empresa_id, o.status_pedido
    INTO v_owner, v_empresa, v_status_pedido
    FROM public.orders o
    WHERE o.id = p_order_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Pedido inválido para este usuário.';
  END IF;

  -- Elegibilidade: só pedidos 'Finalizado' ou 'Cancelado' podem ser repetidos.
  IF v_status_pedido NOT IN ('Finalizado', 'Cancelado') THEN
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

    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

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