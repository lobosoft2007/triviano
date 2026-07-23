CREATE OR REPLACE FUNCTION public.enqueue_print_jobs(p_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_created integer := 0;
  v_printer record;
  v_items jsonb;
  v_items_sector jsonb;
  v_client_phone text;
  v_client_name text;
BEGIN
  SELECT o.*, p.full_name AS cliente_nome
    INTO v_order
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido % não encontrado.', p_order_id;
  END IF;

  v_client_name := COALESCE(v_order.cliente_nome, '');
  v_client_phone := COALESCE(v_order.phone, '');

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'size', oi.size,
      'addons', oi.addons,
      'second_flavor', oi.second_flavor,
      'remocoes', oi.remocoes,
      'category_id', p.category_id,
      'printer_id', c.id_impressora_destino
    ) ORDER BY oi.created_at
  ), '[]'::jsonb)
    INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE oi.order_id = p_order_id;

  FOR v_printer IN
    SELECT DISTINCT ci.*
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    JOIN public.config_impressoras ci
      ON ci.id = c.id_impressora_destino
     AND ci.empresa_id = v_order.empresa_id
     AND ci.ativo = true
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT jsonb_agg(item ORDER BY (item->>'product_name'))
      INTO v_items_sector
    FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'printer_id')::uuid = v_printer.id;

    IF v_items_sector IS NULL OR jsonb_array_length(v_items_sector) = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.print_jobs(
      empresa_id, printer_id, order_id, tipo, payload
    ) VALUES (
      v_order.empresa_id, v_printer.id, p_order_id, 'setor',
      jsonb_build_object(
        'sector_name', v_printer.nome,
        'order', jsonb_build_object(
          'id', v_order.id,
          'senha', v_order.senha,
          'senha_diaria', v_order.senha_diaria,
          'tipo_atendimento', v_order.tipo_atendimento,
          'numero_mesa', v_order.numero_mesa,
          'observacoes_operador', v_order.observacoes_operador,
          'notes', v_order.notes,
          'created_at', v_order.created_at,
          'cliente_nome', v_client_name,
          'phone', v_client_phone
        ),
        'items', v_items_sector
      )
    );
    v_created := v_created + 1;
  END LOOP;

  FOR v_printer IN
    SELECT * FROM public.config_impressoras
    WHERE empresa_id = v_order.empresa_id
      AND ativo = true
      AND imprime_pedido_completo = true
  LOOP
    INSERT INTO public.print_jobs(
      empresa_id, printer_id, order_id, tipo, payload
    ) VALUES (
      v_order.empresa_id, v_printer.id, p_order_id, 'pedido_completo',
      jsonb_build_object(
        'sector_name', v_printer.nome,
        'order', jsonb_build_object(
          'id', v_order.id,
          'senha', v_order.senha,
          'senha_diaria', v_order.senha_diaria,
          'tipo_atendimento', v_order.tipo_atendimento,
          'numero_mesa', v_order.numero_mesa,
          'delivery_address', v_order.delivery_address,
          'observacoes_operador', v_order.observacoes_operador,
          'notes', v_order.notes,
          'total', v_order.total,
          'discount', v_order.discount,
          'desconto_manual', v_order.desconto_manual,
          'cashback_usado', v_order.cashback_usado,
          'tipo_pagamento', v_order.tipo_pagamento,
          'created_at', v_order.created_at,
          'cliente_nome', v_client_name,
          'phone', v_client_phone
        ),
        'items', v_items
      )
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$function$;