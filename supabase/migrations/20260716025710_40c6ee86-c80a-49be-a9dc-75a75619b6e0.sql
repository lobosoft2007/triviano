-- 1. Tabela de horários por categoria
CREATE TABLE public.category_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);

CREATE INDEX category_horarios_cat_dia_idx
  ON public.category_horarios(categoria_id, dia_semana);
CREATE INDEX category_horarios_empresa_idx
  ON public.category_horarios(empresa_id);

GRANT SELECT ON public.category_horarios TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.category_horarios TO authenticated;
GRANT ALL ON public.category_horarios TO service_role;

ALTER TABLE public.category_horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Horários visíveis publicamente"
  ON public.category_horarios FOR SELECT
  USING (true);

CREATE POLICY "Admin local gerencia horários da sua empresa"
  ON public.category_horarios FOR ALL
  TO authenticated
  USING (public.is_local_admin() AND empresa_id = public.current_empresa_id())
  WITH CHECK (public.is_local_admin() AND empresa_id = public.current_empresa_id());

-- Trigger: preenche empresa_id a partir da categoria + updated_at
CREATE OR REPLACE FUNCTION public.category_horarios_fill_empresa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    SELECT empresa_id INTO NEW.empresa_id
      FROM public.categories WHERE id = NEW.categoria_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_category_horarios_fill
  BEFORE INSERT OR UPDATE ON public.category_horarios
  FOR EACH ROW EXECUTE FUNCTION public.category_horarios_fill_empresa();

-- 2. Função utilitária: categoria está aberta agora?
CREATE OR REPLACE FUNCTION public.is_categoria_aberta(
  p_categoria_id uuid,
  p_at timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_local timestamptz;
  v_dow smallint;
  v_time time;
  v_has_rows boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.category_horarios WHERE categoria_id = p_categoria_id)
    INTO v_has_rows;
  IF NOT v_has_rows THEN
    RETURN true; -- sem restrição = sempre aberta
  END IF;

  v_local := timezone('America/Sao_Paulo', p_at);
  v_dow := EXTRACT(DOW FROM v_local)::smallint;
  v_time := v_local::time;

  RETURN EXISTS (
    SELECT 1 FROM public.category_horarios
    WHERE categoria_id = p_categoria_id
      AND dia_semana = v_dow
      AND hora_inicio <= v_time
      AND hora_fim > v_time
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_categoria_aberta(uuid, timestamptz) TO anon, authenticated;

-- 3. Próxima abertura (varre até 7 dias à frente entre as categorias da empresa)
CREATE OR REPLACE FUNCTION public.get_next_opening(p_empresa_id uuid)
RETURNS TABLE(dia_semana smallint, hora_inicio time, categoria_nome text, quando timestamptz)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_local timestamptz;
  v_today date;
  v_now_time time;
  v_offset int;
  v_check_date date;
  v_check_dow smallint;
BEGIN
  v_local := timezone('America/Sao_Paulo', now());
  v_today := v_local::date;
  v_now_time := v_local::time;

  FOR v_offset IN 0..7 LOOP
    v_check_date := v_today + v_offset;
    v_check_dow := EXTRACT(DOW FROM v_check_date)::smallint;

    RETURN QUERY
      SELECT h.dia_semana, h.hora_inicio, c.name,
             (v_check_date + h.hora_inicio) AT TIME ZONE 'America/Sao_Paulo'
      FROM public.category_horarios h
      JOIN public.categories c ON c.id = h.categoria_id
      WHERE c.empresa_id = p_empresa_id
        AND h.dia_semana = v_check_dow
        AND (v_offset > 0 OR h.hora_inicio > v_now_time)
      ORDER BY h.hora_inicio ASC
      LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_opening(uuid) TO anon, authenticated;

-- 4. RPC do admin: substitui todas as janelas de uma categoria de uma vez
CREATE OR REPLACE FUNCTION public.admin_set_category_horarios(
  p_categoria_id uuid,
  p_horarios jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid;
  v_cat_empresa uuid;
  v_row jsonb;
BEGIN
  IF NOT public.is_local_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  v_empresa := public.current_empresa_id();
  SELECT empresa_id INTO v_cat_empresa
    FROM public.categories WHERE id = p_categoria_id;
  IF v_cat_empresa IS NULL OR v_cat_empresa <> v_empresa THEN
    RAISE EXCEPTION 'Categoria não pertence a esta empresa.';
  END IF;

  DELETE FROM public.category_horarios WHERE categoria_id = p_categoria_id;

  IF p_horarios IS NULL OR jsonb_typeof(p_horarios) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_horarios) LOOP
    INSERT INTO public.category_horarios(
      categoria_id, empresa_id, dia_semana, hora_inicio, hora_fim
    ) VALUES (
      p_categoria_id,
      v_empresa,
      (v_row->>'dia_semana')::smallint,
      (v_row->>'hora_inicio')::time,
      (v_row->>'hora_fim')::time
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_category_horarios(uuid, jsonb) TO authenticated;

-- 5. Guarda no create_order: recusa itens de categoria fora do horário
CREATE OR REPLACE FUNCTION public.create_order(p_items jsonb, p_delivery_address text, p_phone text, p_notes text, p_tipo_atendimento text, p_numero_mesa integer, p_cashback_used numeric DEFAULT 0, p_host text DEFAULT NULL::text, p_pagamento_online boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_order_id uuid;
  v_tipo attendance_type;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;

  v_item jsonb;
  v_addon jsonb;
  v_pid uuid;
  v_size text;
  v_second text;
  v_qty integer;

  v_price numeric;
  v_pname text;
  v_free_limit integer;
  v_catid uuid;
  v_slug text;
  v_allows_half boolean;

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
  k integer;

  best record;
  r record;
  s text;
  cnt integer;
  val numeric;
  disc numeric;
  pct numeric;
  ok boolean;
  best_disc numeric;
  round_i integer;
  max_rounds integer;
  v_tipo_pagamento text;
  v_aguardando_pagamento boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND bloqueado = true) THEN
    RAISE EXCEPTION 'Sua conta está temporariamente bloqueada. Entre em contato com o restaurante.';
  END IF;

  v_empresa := public.resolve_empresa_id_by_host(p_host);
  IF v_empresa IS NULL OR NOT public.is_empresa_ativa(v_empresa) THEN
    SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;
  END IF;
  v_empresa := COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023');

  v_tipo := COALESCE(NULLIF(p_tipo_atendimento, ''), 'Delivery')::attendance_type;

  v_tipo_pagamento := CASE
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: PIX%' THEN 'pix'
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: Dinheiro%' THEN 'dinheiro_entrega'
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: Cartão de Crédito%' AND COALESCE(p_pagamento_online, false) THEN 'cartao_credito_online'
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: Cartão de Débito%' AND COALESCE(p_pagamento_online, false) THEN 'cartao_debito_online'
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: Cartão de Crédito%' THEN 'cartao_credito_entrega'
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: Cartão de Débito%' THEN 'cartao_debito_entrega'
    WHEN COALESCE(p_notes, '') ILIKE 'Forma de pagamento: Conta Corrente%' THEN 'conta_corrente'
    ELSE CASE WHEN COALESCE(p_pagamento_online, false) THEN 'online' ELSE 'nao_informado' END
  END;

  v_aguardando_pagamento := CASE
    WHEN v_tipo_pagamento = 'pix' THEN true
    WHEN v_tipo_pagamento IN ('cartao_credito_online', 'cartao_debito_online', 'online') THEN true
    ELSE false
  END;

  CREATE TEMP TABLE IF NOT EXISTS combo_pool (slug text, price numeric) ON COMMIT DROP;
  TRUNCATE combo_pool;

  INSERT INTO public.orders (
    user_id, total, discount, delivery_address, phone, notes, status,
    tipo_atendimento, numero_mesa, empresa_id, tipo_pagamento, aguardando_pagamento
  ) VALUES (
    v_user, 0, 0, COALESCE(p_delivery_address, ''), COALESCE(p_phone, ''),
    COALESCE(p_notes, ''),
    CASE WHEN v_aguardando_pagamento THEN 'rascunho_pagamento' ELSE 'pending' END,
    v_tipo,
    CASE WHEN v_tipo = 'Presencial' THEN p_numero_mesa ELSE NULL END,
    v_empresa, v_tipo_pagamento, v_aguardando_pagamento
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_size := COALESCE(v_item->>'size', '');
    v_second := COALESCE(v_item->>'second_flavor', '');
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_qty <= 0 THEN v_qty := 1; END IF;

    SELECT p.price, p.name, p.free_addon_limit, p.category_id, c.slug, c.allows_half
      INTO v_price, v_pname, v_free_limit, v_catid, v_slug, v_allows_half
      FROM public.products p
      JOIN public.categories c ON c.id = p.category_id
      WHERE p.id = v_pid AND p.available = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível no cardápio.';
    END IF;

    -- Guarda de horário: recusa itens de categoria fechada agora.
    IF NOT public.is_categoria_aberta(v_catid) THEN
      RAISE EXCEPTION 'O item "%" está fora do horário de funcionamento no momento.', v_pname;
    END IF;

    SELECT preco INTO v_base FROM public.produtos_price_options
      WHERE produto_id = v_pid AND tamanho = v_size
      ORDER BY sort_order LIMIT 1;
    IF v_base IS NULL THEN v_base := v_price; END IF;

    v_is_acai := (COALESCE(v_free_limit, 0) > 0
      AND EXISTS (SELECT 1 FROM public.produtos_free_addons WHERE produto_id = v_pid));

    IF v_is_acai THEN
      v_total_free := 0;
      v_premium := 0;
      SELECT preco INTO v_free_price FROM public.produtos_free_addons
        WHERE produto_id = v_pid ORDER BY sort_order LIMIT 1;
      v_free_price := COALESCE(v_free_price, 0);

      IF jsonb_typeof(v_item->'addons') = 'array' THEN
        FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item->'addons') LOOP
          v_aname := COALESCE(v_addon->>'name', v_addon->>'nome', '');
          v_aqty := COALESCE((v_addon->>'quantity')::numeric, 1);
          IF v_aname = '' THEN CONTINUE; END IF;
          IF EXISTS (SELECT 1 FROM public.produtos_free_addons
                     WHERE produto_id = v_pid AND nome = v_aname) THEN
            v_total_free := v_total_free + v_aqty;
          ELSE
            SELECT preco INTO v_aprice FROM public.produtos_addons
              WHERE produto_id = v_pid AND nome = v_aname LIMIT 1;
            IF v_aprice IS NOT NULL THEN
              v_premium := v_premium + v_aqty * v_aprice;
            END IF;
          END IF;
        END LOOP;
      END IF;

      v_overflow := GREATEST(0, v_total_free - COALESCE(v_free_limit, 0));
      v_unit := round(v_base + v_overflow * v_free_price + v_premium, 2);
    ELSE
      v_bp := v_base;
      IF v_allows_half AND v_second <> '' THEN
        SELECT po.preco INTO v_secbase
          FROM public.produtos_price_options po
          JOIN public.products sp ON sp.id = po.produto_id
          WHERE sp.name = v_second AND sp.category_id = v_catid
          ORDER BY po.sort_order LIMIT 1;
        IF v_secbase IS NULL THEN
          SELECT price INTO v_secbase FROM public.products
            WHERE name = v_second AND category_id = v_catid LIMIT 1;
        END IF;
        IF v_secbase IS NULL THEN v_secbase := v_base; END IF;
        v_bp := round((v_base + v_secbase) / 2, 2);
      END IF;

      v_addons_total := 0;
      IF jsonb_typeof(v_item->'addons') = 'array' THEN
        FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item->'addons') LOOP
          v_aname := COALESCE(v_addon->>'name', v_addon->>'nome', '');
          IF v_aname = '' THEN CONTINUE; END IF;
          SELECT preco INTO v_aprice FROM public.produtos_addons
            WHERE produto_id = v_pid AND nome = v_aname LIMIT 1;
          IF v_aprice IS NOT NULL THEN
            v_addons_total := v_addons_total + v_aprice;
          END IF;
        END LOOP;
      END IF;

      v_unit := round(v_bp + v_addons_total, 2);
    END IF;

    SELECT count(*) INTO v_opt_count FROM public.produtos_price_options WHERE produto_id = v_pid;
    IF v_allows_half AND v_second <> '' THEN
      v_display := '½ ' || v_pname || ' / ½ ' || v_second;
    ELSIF v_opt_count > 1 THEN
      v_display := v_pname || ' (' || v_size || ')';
    ELSE
      v_display := v_pname;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, size,
      addons, second_flavor, remocoes
    ) VALUES (
      v_order_id, v_pid, v_display, v_unit, v_qty, v_size,
      COALESCE(v_item->'addons', '[]'::jsonb),
      v_second,
      CASE WHEN jsonb_typeof(v_item->'remocoes') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'remocoes'))
           ELSE '{}'::text[] END
    );

    v_subtotal := v_subtotal + v_unit * v_qty;

    FOR k IN 1..v_qty LOOP
      INSERT INTO combo_pool (slug, price) VALUES (v_slug, v_unit);
    END LOOP;
  END LOOP;

  v_discount := 0;
  SELECT count(*) + 1 INTO max_rounds FROM combo_pool;

  FOR round_i IN 1..max_rounds LOOP
    best_disc := 0;
    best := NULL;

    FOR r IN
      SELECT rc.tipo_promocao, rc.quantidade_requerida, rc.valor_desconto,
             array_remove(ARRAY[c1.slug, c2.slug, c3.slug], NULL) AS slugs
      FROM public.regras_combos rc
      LEFT JOIN public.categories c1 ON c1.id = rc.id_categoria_1
      LEFT JOIN public.categories c2 ON c2.id = rc.id_categoria_2
      LEFT JOIN public.categories c3 ON c3.id = rc.id_categoria_3
      WHERE rc.ativo = true AND rc.valor_desconto > 0
    LOOP
      IF array_length(r.slugs, 1) IS NULL THEN CONTINUE; END IF;

      IF r.tipo_promocao = 'Pack' THEN
        s := r.slugs[1];
        SELECT count(*) INTO cnt FROM combo_pool WHERE slug = s;
        IF cnt < r.quantidade_requerida THEN CONTINUE; END IF;
        SELECT COALESCE(sum(price), 0) INTO val FROM (
          SELECT price FROM combo_pool WHERE slug = s
          ORDER BY price DESC LIMIT r.quantidade_requerida
        ) t;
        pct := LEAST(100, GREATEST(0, r.valor_desconto));
        disc := round(val * pct / 100.0, 2);
      ELSE
        ok := true;
        FOREACH s IN ARRAY r.slugs LOOP
          IF NOT EXISTS (SELECT 1 FROM combo_pool WHERE slug = s) THEN
            ok := false; EXIT;
          END IF;
        END LOOP;
        IF NOT ok THEN CONTINUE; END IF;
        disc := r.valor_desconto;
      END IF;

      IF disc > best_disc THEN
        best_disc := disc;
        best := r;
      END IF;
    END LOOP;

    IF best IS NULL OR best_disc <= 0 THEN EXIT; END IF;

    IF best.tipo_promocao = 'Pack' THEN
      s := best.slugs[1];
      DELETE FROM combo_pool WHERE ctid IN (
        SELECT ctid FROM combo_pool WHERE slug = s
        ORDER BY price DESC LIMIT best.quantidade_requerida
      );
    ELSE
      FOREACH s IN ARRAY best.slugs LOOP
        DELETE FROM combo_pool WHERE ctid IN (
          SELECT ctid FROM combo_pool WHERE slug = s
          ORDER BY price ASC LIMIT 1
        );
      END LOOP;
    END IF;

    v_discount := v_discount + best_disc;
  END LOOP;

  v_total := GREATEST(0, round(v_subtotal - v_discount, 2));

  UPDATE public.orders
    SET total = v_total, discount = round(v_discount, 2)
    WHERE id = v_order_id;

  IF COALESCE(p_cashback_used, 0) > 0 THEN
    PERFORM public.redeem_cashback_for_order(v_order_id, p_cashback_used);
  END IF;

  RETURN v_order_id;
END;
$function$;