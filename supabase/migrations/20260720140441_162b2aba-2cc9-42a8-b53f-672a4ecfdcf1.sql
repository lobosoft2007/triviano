
-- get_ordem_compra
CREATE OR REPLACE FUNCTION public.get_ordem_compra(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ordem jsonb;
  v_itens jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'numero', o.numero,
    'id_fornecedor', o.id_fornecedor,
    'fornecedor_nome', f.fornecedor,
    'fornecedor_telefone', f.telefone,
    'fornecedor_cnpj', f.cnpj,
    'status', o.status,
    'origem', o.origem,
    'observacao', o.observacao,
    'valor_total', o.valor_total,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  )
  INTO v_ordem
  FROM public.ordens_compra o
  LEFT JOIN public.fornecedores f ON f.id = o.id_fornecedor
  WHERE o.id = p_id
    AND o.empresa_id = public.current_empresa_id();

  IF v_ordem IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'tipo', i.tipo,
    'ref_id', i.ref_id,
    'nome', i.nome,
    'quantidade', i.quantidade,
    'custo_unitario', i.custo_unitario
  ) ORDER BY i.created_at), '[]'::jsonb)
  INTO v_itens
  FROM public.itens_ordem_compra i
  WHERE i.id_ordem_compra = p_id;

  RETURN v_ordem || jsonb_build_object('itens', v_itens);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ordem_compra(uuid) TO authenticated;

-- atualizar_ordem_compra
CREATE OR REPLACE FUNCTION public.atualizar_ordem_compra(
  p_id uuid,
  p_fornecedor uuid,
  p_observacao text,
  p_itens jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_total numeric := 0;
  v_item jsonb;
  v_qtd numeric;
  v_custo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT status INTO v_status
  FROM public.ordens_compra
  WHERE id = p_id AND empresa_id = public.current_empresa_id()
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;
  IF v_status <> 'Aberta' THEN
    RAISE EXCEPTION 'Somente ordens em Aberta podem ser editadas (status: %).', v_status;
  END IF;

  DELETE FROM public.itens_ordem_compra WHERE id_ordem_compra = p_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::numeric, 0);
    IF v_qtd > 0 THEN
      INSERT INTO public.itens_ordem_compra
        (id_ordem_compra, tipo, ref_id, nome, quantidade, custo_unitario)
      VALUES (p_id,
        COALESCE(v_item->>'tipo', 'insumo'),
        NULLIF(v_item->>'ref_id', '')::uuid,
        COALESCE(v_item->>'nome', ''),
        v_qtd, v_custo);
      v_total := v_total + (v_qtd * v_custo);
    END IF;
  END LOOP;

  UPDATE public.ordens_compra
     SET id_fornecedor = p_fornecedor,
         observacao = COALESCE(p_observacao, ''),
         valor_total = v_total,
         updated_at = now()
   WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_ordem_compra(uuid, uuid, text, jsonb) TO authenticated;

-- excluir_ordem_compra
CREATE OR REPLACE FUNCTION public.excluir_ordem_compra(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT status INTO v_status
  FROM public.ordens_compra
  WHERE id = p_id AND empresa_id = public.current_empresa_id()
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;
  IF v_status <> 'Aberta' THEN
    RAISE EXCEPTION 'Somente ordens em Aberta podem ser excluídas (status: %).', v_status;
  END IF;

  DELETE FROM public.itens_ordem_compra WHERE id_ordem_compra = p_id;
  DELETE FROM public.ordens_compra WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_ordem_compra(uuid) TO authenticated;
