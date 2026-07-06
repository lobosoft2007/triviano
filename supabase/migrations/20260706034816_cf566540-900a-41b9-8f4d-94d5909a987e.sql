CREATE OR REPLACE FUNCTION public.registrar_entrada_produtos(
  p_fornecedor uuid,
  p_conta_financeira uuid,
  p_observacao text,
  p_itens jsonb
)
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
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  INSERT INTO public.entradas_avulsas_estoque (id_fornecedor, observacao, valor_total)
  VALUES (p_fornecedor, COALESCE(p_observacao, ''), 0)
  RETURNING id, numero_documento_interno INTO v_entrada, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto := (v_item->>'id_produto')::uuid;
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::numeric, 0);

    IF v_produto IS NULL OR v_qtd <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(custo_compra, 0) INTO v_custo_ant
      FROM public.products WHERE id = v_produto;

    UPDATE public.products
      SET saldo_estoque = COALESCE(saldo_estoque, 0) + v_qtd,
          custo_compra = v_custo,
          margem_revenda = COALESCE(margem_revenda, 100)
      WHERE id = v_produto
      RETURNING saldo_estoque INTO v_saldo_apos;

    INSERT INTO public.itens_entrada_produto
      (id_entrada_avulsa, id_produto, quantidade, custo_unitario_momento, custo_anterior_momento, saldo_apos)
    VALUES (v_entrada, v_produto, v_qtd, v_custo, COALESCE(v_custo_ant, 0), v_saldo_apos);

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

  RETURN v_numero;
END;
$function$;