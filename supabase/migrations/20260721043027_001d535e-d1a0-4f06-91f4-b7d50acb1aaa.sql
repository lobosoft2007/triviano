
-- =========================================================
-- 1) Núcleo: recalcular custo_total de UM produto
-- =========================================================
CREATE OR REPLACE FUNCTION public._compute_product_custo_total(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manipulado boolean;
  v_custo_compra numeric;
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(manipulado, true), COALESCE(custo_compra, 0)
    INTO v_manipulado, v_custo_compra
    FROM public.products WHERE id = p_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Revenda: custo = custo_compra
  IF v_manipulado IS NOT TRUE THEN
    RETURN ROUND(v_custo_compra::numeric, 2);
  END IF;

  -- Manipulado: soma da ficha base (price_option_id IS NULL)
  --   insumos:   quantidade * fator_conversao * custo_unitario
  --   subprod.:  quantidade * (custo_composicao / rendimento_porcoes)
  WITH base AS (
    SELECT ip.insumo_id, ip.subproduto_id, ip.quantidade
      FROM public.ingredientes_produto ip
     WHERE ip.id_produto = p_id AND ip.price_option_id IS NULL
  ),
  insumo_lines AS (
    SELECT b.quantidade * COALESCE(i.fator_conversao, 1) * COALESCE(i.custo_unitario, 0) AS v
      FROM base b JOIN public.insumos i ON i.id = b.insumo_id
     WHERE b.insumo_id IS NOT NULL
  ),
  sub_costs AS (
    SELECT s.id AS subproduto_id,
           CASE WHEN COALESCE(s.rendimento_porcoes,0) > 0
                THEN COALESCE(SUM(c.quantidade * COALESCE(i.fator_conversao,1) * COALESCE(i.custo_unitario,0)),0)
                     / s.rendimento_porcoes
                ELSE 0 END AS unit_cost
      FROM public.subprodutos s
      LEFT JOIN public.composicao_subproduto c ON c.subproduto_id = s.id
      LEFT JOIN public.insumos i ON i.id = c.insumo_id
     GROUP BY s.id, s.rendimento_porcoes
  ),
  sub_lines AS (
    SELECT b.quantidade * COALESCE(sc.unit_cost,0) AS v
      FROM base b LEFT JOIN sub_costs sc ON sc.subproduto_id = b.subproduto_id
     WHERE b.subproduto_id IS NOT NULL
  )
  SELECT COALESCE((SELECT SUM(v) FROM insumo_lines),0)
       + COALESCE((SELECT SUM(v) FROM sub_lines),0)
    INTO v_total;

  RETURN ROUND(v_total::numeric, 2);
END;
$$;

-- =========================================================
-- 2) Recalcula e persiste para uma lista de produtos
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_recompute_products_custo_total(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN RETURN 0; END IF;
  FOREACH v_id IN ARRAY p_ids LOOP
    UPDATE public.products
       SET custo_total = public._compute_product_custo_total(v_id)
     WHERE id = v_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- =========================================================
-- 3) Recalcula manipulados afetados por mudança em insumos
--    (direto na ficha OU via subproduto)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_recompute_products_by_insumos(p_insumo_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_insumo_ids IS NULL OR array_length(p_insumo_ids,1) IS NULL THEN RETURN 0; END IF;

  SELECT ARRAY(
    SELECT DISTINCT p.id
      FROM public.products p
      JOIN public.ingredientes_produto ip ON ip.id_produto = p.id
     WHERE p.manipulado = true
       AND (
         ip.insumo_id = ANY(p_insumo_ids)
         OR ip.subproduto_id IN (
           SELECT DISTINCT c.subproduto_id
             FROM public.composicao_subproduto c
            WHERE c.insumo_id = ANY(p_insumo_ids)
         )
       )
  ) INTO v_ids;

  RETURN public.admin_recompute_products_custo_total(v_ids);
END;
$$;

-- =========================================================
-- 4) Recalcula TODOS os produtos (bala de prata)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_recompute_all_custo_total()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  SELECT ARRAY(SELECT id FROM public.products) INTO v_ids;
  RETURN public.admin_recompute_products_custo_total(v_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_recompute_all_custo_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recompute_products_custo_total(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recompute_products_by_insumos(uuid[]) TO authenticated;

-- =========================================================
-- 5) receber_ordem_compra: recalcular após atualizar saldos
-- =========================================================
CREATE OR REPLACE FUNCTION public.receber_ordem_compra(p_ordem_id uuid, p_cabecalho jsonb, p_itens jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem public.ordens_compra%ROWTYPE;
  v_recebimento uuid;
  v_numero integer;
  v_total numeric := 0;
  v_item jsonb;
  v_tipo text;
  v_ref uuid;
  v_qtd numeric;
  v_custo numeric;
  v_nome text;
  v_id_item_ordem uuid;
  v_custo_ant numeric;
  v_saldo_apos numeric;
  v_conta uuid;
  v_com_nf boolean;
  v_qtd_pedida_total numeric := 0;
  v_qtd_recebida_total numeric := 0;
  v_produto_ids uuid[] := ARRAY[]::uuid[];
  v_insumo_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_ordem FROM public.ordens_compra WHERE id = p_ordem_id;
  IF v_ordem.id IS NULL THEN RAISE EXCEPTION 'Ordem de compra não encontrada.'; END IF;
  IF NOT public.can_manage_empresa(v_ordem.empresa_id) THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
  IF v_ordem.status = 'Recebida' THEN RAISE EXCEPTION 'Esta ordem já está totalmente recebida.'; END IF;

  v_com_nf := COALESCE((p_cabecalho->>'com_nf')::boolean, false);
  v_conta := NULLIF(p_cabecalho->>'id_conta_financeira','')::uuid;

  INSERT INTO public.recebimentos_ordem (
    id_ordem_compra, id_fornecedor, id_conta_financeira,
    com_nf, numero_nf, serie_nf, chave_acesso,
    data_emissao, data_entrada, observacao, valor_total
  ) VALUES (
    p_ordem_id,
    COALESCE(NULLIF(p_cabecalho->>'id_fornecedor','')::uuid, v_ordem.id_fornecedor),
    v_conta, v_com_nf,
    NULLIF(p_cabecalho->>'numero_nf',''),
    NULLIF(p_cabecalho->>'serie_nf',''),
    NULLIF(p_cabecalho->>'chave_acesso',''),
    NULLIF(p_cabecalho->>'data_emissao','')::date,
    COALESCE(NULLIF(p_cabecalho->>'data_entrada','')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
    COALESCE(p_cabecalho->>'observacao',''), 0
  ) RETURNING id, numero INTO v_recebimento, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_tipo := COALESCE(v_item->>'tipo','insumo');
    v_ref := NULLIF(v_item->>'ref_id','')::uuid;
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::numeric, 0);
    v_nome := COALESCE(v_item->>'nome','');
    v_id_item_ordem := NULLIF(v_item->>'id_item_ordem','')::uuid;
    v_custo_ant := NULL;
    v_saldo_apos := NULL;

    IF v_qtd <= 0 THEN CONTINUE; END IF;

    IF v_tipo = 'insumo' AND v_ref IS NOT NULL THEN
      SELECT custo_unitario INTO v_custo_ant FROM public.insumos WHERE id = v_ref;
      UPDATE public.insumos
        SET custo_anterior = custo_unitario, custo_anterior_at = now(),
            custo_unitario = v_custo,
            saldo_estoque = COALESCE(saldo_estoque,0) + v_qtd,
            updated_at = now()
        WHERE id = v_ref
        RETURNING saldo_estoque INTO v_saldo_apos;
      v_insumo_ids := v_insumo_ids || v_ref;
    ELSIF v_tipo = 'produto' AND v_ref IS NOT NULL THEN
      SELECT COALESCE(custo_compra,0) INTO v_custo_ant FROM public.products WHERE id = v_ref;
      UPDATE public.products
        SET saldo_estoque = COALESCE(saldo_estoque,0) + v_qtd,
            custo_compra = v_custo,
            margem_revenda = COALESCE(margem_revenda, 100)
        WHERE id = v_ref
        RETURNING saldo_estoque INTO v_saldo_apos;
      v_produto_ids := v_produto_ids || v_ref;
    END IF;

    INSERT INTO public.itens_recebimento_ordem
      (id_recebimento, id_item_ordem, tipo, ref_id, nome,
       quantidade_recebida, custo_unitario_pago, subtotal, custo_anterior, saldo_apos)
    VALUES (v_recebimento, v_id_item_ordem, v_tipo, v_ref, v_nome,
      v_qtd, v_custo, v_qtd * v_custo, v_custo_ant, v_saldo_apos);

    v_total := v_total + (v_qtd * v_custo);
  END LOOP;

  UPDATE public.recebimentos_ordem SET valor_total = v_total WHERE id = v_recebimento;

  IF v_conta IS NOT NULL AND v_total > 0 THEN
    INSERT INTO public.lancamentos_tesouraria
      (id_conta_financeira, tipo, valor, categoria_fluxo, descricao, data_competencia, data_liquidacao)
    VALUES (v_conta, 'Saída', v_total, 'Compra de Insumos',
      'Recebimento nº ' || v_numero || ' (Ordem #' || v_ordem.numero || ')', now(), now());
    UPDATE public.contas_financeiras
      SET saldo_atual = saldo_atual - v_total, updated_at = now()
      WHERE id = v_conta;
  END IF;

  SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_pedida_total
    FROM public.itens_ordem_compra WHERE id_ordem_compra = p_ordem_id;
  SELECT COALESCE(SUM(ir.quantidade_recebida),0) INTO v_qtd_recebida_total
    FROM public.itens_recebimento_ordem ir
    JOIN public.recebimentos_ordem r ON r.id = ir.id_recebimento
   WHERE r.id_ordem_compra = p_ordem_id;

  UPDATE public.ordens_compra
    SET status = CASE WHEN v_qtd_recebida_total >= v_qtd_pedida_total THEN 'Recebida' ELSE 'Parcial' END,
        updated_at = now()
    WHERE id = p_ordem_id;

  -- Recalcular CMV
  IF array_length(v_produto_ids,1) IS NOT NULL THEN
    PERFORM public.admin_recompute_products_custo_total(v_produto_ids);
  END IF;
  IF array_length(v_insumo_ids,1) IS NOT NULL THEN
    PERFORM public.admin_recompute_products_by_insumos(v_insumo_ids);
  END IF;

  RETURN v_numero;
END;
$function$;

-- =========================================================
-- 6) registrar_entrada_avulsa: recalcular manipulados afetados
-- =========================================================
CREATE OR REPLACE FUNCTION public.registrar_entrada_avulsa(p_fornecedor uuid, p_conta_financeira uuid, p_observacao text, p_itens jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entrada uuid;
  v_numero integer;
  v_total numeric := 0;
  v_item jsonb;
  v_insumo uuid;
  v_qtd numeric;
  v_custo numeric;
  v_custo_ant numeric;
  v_insumo_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;

  INSERT INTO public.entradas_avulsas_estoque (id_fornecedor, observacao, valor_total)
  VALUES (p_fornecedor, COALESCE(p_observacao, ''), 0)
  RETURNING id, numero_documento_interno INTO v_entrada, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_insumo := (v_item->>'id_insumo')::uuid;
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::numeric, 0);

    SELECT custo_unitario INTO v_custo_ant FROM public.insumos WHERE id = v_insumo;

    INSERT INTO public.itens_entrada_avulsa
      (id_entrada_avulsa, id_insumo, quantidade, custo_unitario_momento, custo_anterior_momento)
    VALUES (v_entrada, v_insumo, v_qtd, v_custo, COALESCE(v_custo_ant, 0));

    UPDATE public.insumos
      SET custo_anterior = custo_unitario, custo_anterior_at = now(),
          custo_unitario = v_custo,
          saldo_estoque = saldo_estoque + v_qtd,
          updated_at = now()
      WHERE id = v_insumo;

    v_insumo_ids := v_insumo_ids || v_insumo;
    v_total := v_total + (v_qtd * v_custo);
  END LOOP;

  UPDATE public.entradas_avulsas_estoque SET valor_total = v_total WHERE id = v_entrada;

  IF p_conta_financeira IS NOT NULL AND v_total > 0 THEN
    INSERT INTO public.lancamentos_tesouraria
      (id_conta_financeira, tipo, valor, categoria_fluxo, descricao, data_competencia, data_liquidacao)
    VALUES (p_conta_financeira, 'Saída', v_total, 'Compra de Insumos',
      'Entrada avulsa nº ' || v_numero, now(), now());
    UPDATE public.contas_financeiras
      SET saldo_atual = saldo_atual - v_total, updated_at = now()
      WHERE id = p_conta_financeira;
  END IF;

  IF array_length(v_insumo_ids,1) IS NOT NULL THEN
    PERFORM public.admin_recompute_products_by_insumos(v_insumo_ids);
  END IF;

  RETURN v_numero;
END;
$function$;

-- =========================================================
-- 7) registrar_entrada_produtos: recalcular produtos recebidos
-- =========================================================
CREATE OR REPLACE FUNCTION public.registrar_entrada_produtos(p_fornecedor uuid, p_conta_financeira uuid, p_observacao text, p_itens jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entrada uuid;
  v_numero integer;
  v_total numeric := 0;
  v_item jsonb;
  v_produto uuid;
  v_qtd numeric;
  v_custo numeric;
  v_custo_ant numeric;
  v_saldo_apos numeric;
  v_produto_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;

  INSERT INTO public.entradas_avulsas_estoque (id_fornecedor, observacao, valor_total)
  VALUES (p_fornecedor, COALESCE(p_observacao, ''), 0)
  RETURNING id, numero_documento_interno INTO v_entrada, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto := (v_item->>'id_produto')::uuid;
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::numeric, 0);

    IF v_produto IS NULL OR v_qtd <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(custo_compra, 0) INTO v_custo_ant FROM public.products WHERE id = v_produto;

    UPDATE public.products
      SET saldo_estoque = COALESCE(saldo_estoque, 0) + v_qtd,
          custo_compra = v_custo,
          margem_revenda = COALESCE(margem_revenda, 100)
      WHERE id = v_produto
      RETURNING saldo_estoque INTO v_saldo_apos;

    INSERT INTO public.itens_entrada_produto
      (id_entrada_avulsa, id_produto, quantidade, custo_unitario_momento, custo_anterior_momento, saldo_apos)
    VALUES (v_entrada, v_produto, v_qtd, v_custo, COALESCE(v_custo_ant, 0), v_saldo_apos);

    v_produto_ids := v_produto_ids || v_produto;
    v_total := v_total + (v_qtd * v_custo);
  END LOOP;

  UPDATE public.entradas_avulsas_estoque SET valor_total = v_total WHERE id = v_entrada;

  IF p_conta_financeira IS NOT NULL AND v_total > 0 THEN
    INSERT INTO public.lancamentos_tesouraria
      (id_conta_financeira, tipo, valor, categoria_fluxo, descricao, data_competencia, data_liquidacao)
    VALUES (p_conta_financeira, 'Saída', v_total, 'Compra de Insumos',
      'Entrada de produtos nº ' || v_numero, now(), now());
    UPDATE public.contas_financeiras
      SET saldo_atual = saldo_atual - v_total, updated_at = now()
      WHERE id = p_conta_financeira;
  END IF;

  IF array_length(v_produto_ids,1) IS NOT NULL THEN
    PERFORM public.admin_recompute_products_custo_total(v_produto_ids);
  END IF;

  RETURN v_numero;
END;
$function$;
