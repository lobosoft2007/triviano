
-- ============================================================================
-- Recebimento de Ordens de Compra
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.recebimento_ordem_seq;

CREATE TABLE public.recebimentos_ordem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.recebimento_ordem_seq'),
  id_ordem_compra uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL DEFAULT current_empresa_id() REFERENCES public.empresas(id),
  id_fornecedor uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  id_conta_financeira uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  com_nf boolean NOT NULL DEFAULT false,
  numero_nf text,
  serie_nf text,
  chave_acesso text,
  data_emissao date,
  data_entrada date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  observacao text NOT NULL DEFAULT '',
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos_ordem TO authenticated;
GRANT ALL ON public.recebimentos_ordem TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.recebimento_ordem_seq TO authenticated, service_role;

ALTER TABLE public.recebimentos_ordem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recebimentos_ordem"
  ON public.recebimentos_ordem
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));

CREATE TRIGGER trg_recebimentos_ordem_empresa
  BEFORE INSERT ON public.recebimentos_ordem
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

CREATE TRIGGER update_recebimentos_ordem_updated_at
  BEFORE UPDATE ON public.recebimentos_ordem
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recebimentos_ordem_ordem ON public.recebimentos_ordem(id_ordem_compra);
CREATE INDEX idx_recebimentos_ordem_empresa ON public.recebimentos_ordem(empresa_id);

-- Itens do recebimento -------------------------------------------------------

CREATE TABLE public.itens_recebimento_ordem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_recebimento uuid NOT NULL REFERENCES public.recebimentos_ordem(id) ON DELETE CASCADE,
  id_item_ordem uuid REFERENCES public.itens_ordem_compra(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('insumo', 'produto', 'livre')),
  ref_id uuid,
  nome text NOT NULL,
  quantidade_recebida numeric NOT NULL DEFAULT 0,
  custo_unitario_pago numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  custo_anterior numeric,
  saldo_apos numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_recebimento_ordem TO authenticated;
GRANT ALL ON public.itens_recebimento_ordem TO service_role;

ALTER TABLE public.itens_recebimento_ordem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage itens_recebimento_ordem"
  ON public.itens_recebimento_ordem
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recebimentos_ordem r
    WHERE r.id = itens_recebimento_ordem.id_recebimento
      AND can_manage_empresa(r.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recebimentos_ordem r
    WHERE r.id = itens_recebimento_ordem.id_recebimento
      AND can_manage_empresa(r.empresa_id)
  ));

CREATE INDEX idx_itens_recebimento_recebimento
  ON public.itens_recebimento_ordem(id_recebimento);

-- ============================================================================
-- RPC: receber_ordem_compra
-- ============================================================================

CREATE OR REPLACE FUNCTION public.receber_ordem_compra(
  p_ordem_id uuid,
  p_cabecalho jsonb,
  p_itens jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT * INTO v_ordem FROM public.ordens_compra WHERE id = p_ordem_id;
  IF v_ordem.id IS NULL THEN
    RAISE EXCEPTION 'Ordem de compra não encontrada.';
  END IF;
  IF NOT public.can_manage_empresa(v_ordem.empresa_id) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF v_ordem.status = 'Recebida' THEN
    RAISE EXCEPTION 'Esta ordem já está totalmente recebida.';
  END IF;

  v_com_nf := COALESCE((p_cabecalho->>'com_nf')::boolean, false);
  v_conta := NULLIF(p_cabecalho->>'id_conta_financeira','')::uuid;

  INSERT INTO public.recebimentos_ordem (
    id_ordem_compra, id_fornecedor, id_conta_financeira,
    com_nf, numero_nf, serie_nf, chave_acesso,
    data_emissao, data_entrada, observacao, valor_total
  ) VALUES (
    p_ordem_id,
    COALESCE(NULLIF(p_cabecalho->>'id_fornecedor','')::uuid, v_ordem.id_fornecedor),
    v_conta,
    v_com_nf,
    NULLIF(p_cabecalho->>'numero_nf',''),
    NULLIF(p_cabecalho->>'serie_nf',''),
    NULLIF(p_cabecalho->>'chave_acesso',''),
    NULLIF(p_cabecalho->>'data_emissao','')::date,
    COALESCE(NULLIF(p_cabecalho->>'data_entrada','')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
    COALESCE(p_cabecalho->>'observacao',''),
    0
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

    IF v_qtd <= 0 THEN
      CONTINUE;
    END IF;

    IF v_tipo = 'insumo' AND v_ref IS NOT NULL THEN
      SELECT custo_unitario INTO v_custo_ant FROM public.insumos WHERE id = v_ref;
      UPDATE public.insumos
        SET custo_anterior = custo_unitario,
            custo_anterior_at = now(),
            custo_unitario = v_custo,
            saldo_estoque = COALESCE(saldo_estoque,0) + v_qtd,
            updated_at = now()
        WHERE id = v_ref
        RETURNING saldo_estoque INTO v_saldo_apos;
    ELSIF v_tipo = 'produto' AND v_ref IS NOT NULL THEN
      SELECT COALESCE(custo_compra,0) INTO v_custo_ant FROM public.products WHERE id = v_ref;
      UPDATE public.products
        SET saldo_estoque = COALESCE(saldo_estoque,0) + v_qtd,
            custo_compra = v_custo,
            margem_revenda = COALESCE(margem_revenda, 100)
        WHERE id = v_ref
        RETURNING saldo_estoque INTO v_saldo_apos;
    END IF;

    INSERT INTO public.itens_recebimento_ordem
      (id_recebimento, id_item_ordem, tipo, ref_id, nome,
       quantidade_recebida, custo_unitario_pago, subtotal,
       custo_anterior, saldo_apos)
    VALUES (v_recebimento, v_id_item_ordem, v_tipo, v_ref, v_nome,
      v_qtd, v_custo, v_qtd * v_custo,
      v_custo_ant, v_saldo_apos);

    v_total := v_total + (v_qtd * v_custo);
  END LOOP;

  UPDATE public.recebimentos_ordem
    SET valor_total = v_total
    WHERE id = v_recebimento;

  -- Lançamento financeiro
  IF v_conta IS NOT NULL AND v_total > 0 THEN
    INSERT INTO public.lancamentos_tesouraria
      (id_conta_financeira, tipo, valor, categoria_fluxo, descricao, data_competencia, data_liquidacao)
    VALUES (v_conta, 'Saída', v_total, 'Compra de Insumos',
      'Recebimento nº ' || v_numero || ' (Ordem #' || v_ordem.numero || ')', now(), now());
    UPDATE public.contas_financeiras
      SET saldo_atual = saldo_atual - v_total, updated_at = now()
      WHERE id = v_conta;
  END IF;

  -- Recalcular status da ordem
  SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_pedida_total
    FROM public.itens_ordem_compra WHERE id_ordem_compra = p_ordem_id;
  SELECT COALESCE(SUM(ir.quantidade_recebida),0) INTO v_qtd_recebida_total
    FROM public.itens_recebimento_ordem ir
    JOIN public.recebimentos_ordem r ON r.id = ir.id_recebimento
   WHERE r.id_ordem_compra = p_ordem_id;

  UPDATE public.ordens_compra
    SET status = CASE
      WHEN v_qtd_recebida_total >= v_qtd_pedida_total THEN 'Recebida'
      ELSE 'Parcial'
    END,
    updated_at = now()
    WHERE id = p_ordem_id;

  RETURN v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receber_ordem_compra(uuid, jsonb, jsonb) TO authenticated;

-- ============================================================================
-- RPC: get_recebimentos_ordem
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_recebimentos_ordem(p_ordem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_result jsonb;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.ordens_compra WHERE id = p_ordem_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT jsonb_agg(row_to_json(r) ORDER BY r.numero DESC) INTO v_result
  FROM (
    SELECT
      r.id, r.numero, r.com_nf, r.numero_nf, r.serie_nf, r.chave_acesso,
      r.data_emissao, r.data_entrada, r.observacao, r.valor_total,
      r.id_conta_financeira, r.created_at,
      f.fornecedor AS fornecedor_nome,
      cf.nome AS conta_nome,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'tipo', i.tipo, 'ref_id', i.ref_id, 'nome', i.nome,
          'quantidade_recebida', i.quantidade_recebida,
          'custo_unitario_pago', i.custo_unitario_pago,
          'subtotal', i.subtotal,
          'custo_anterior', i.custo_anterior,
          'saldo_apos', i.saldo_apos
        ) ORDER BY i.created_at)
        FROM public.itens_recebimento_ordem i WHERE i.id_recebimento = r.id
      ) AS itens
    FROM public.recebimentos_ordem r
    LEFT JOIN public.fornecedores f ON f.id = r.id_fornecedor
    LEFT JOIN public.contas_financeiras cf ON cf.id = r.id_conta_financeira
    WHERE r.id_ordem_compra = p_ordem_id
  ) r;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recebimentos_ordem(uuid) TO authenticated;

-- ============================================================================
-- RPC: encerrar_ordem_compra (encerramento forçado, sem novo recebimento)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encerrar_ordem_compra(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.ordens_compra WHERE id = p_ordem_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.ordens_compra SET status = 'Recebida', updated_at = now() WHERE id = p_ordem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_ordem_compra(uuid) TO authenticated;
