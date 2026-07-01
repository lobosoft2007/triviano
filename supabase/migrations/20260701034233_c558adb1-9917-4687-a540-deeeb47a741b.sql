-- 1. Métricas de estoque (mín/máx). saldo_estoque = estoque atual.
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS estoque_minimo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_maximo numeric NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS saldo_estoque numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_minimo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_maximo numeric NOT NULL DEFAULT 0;

-- 2. Motor de explosão de ficha técnica (baixa de estoque)
CREATE OR REPLACE FUNCTION public.explode_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_ing RECORD;
  v_comp RECORD;
  v_rend numeric;
BEGIN
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.manipulado
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    IF v_item.manipulado = false THEN
      -- Produto pronto (ex.: bebidas): abate direto do saldo do produto
      UPDATE public.products
        SET saldo_estoque = saldo_estoque - v_item.quantity
        WHERE id = v_item.product_id;
    ELSE
      -- Produto manipulado: explode a ficha técnica
      FOR v_ing IN
        SELECT insumo_id, subproduto_id, quantidade
        FROM public.ingredientes_produto
        WHERE product_id = v_item.product_id
      LOOP
        IF v_ing.insumo_id IS NOT NULL THEN
          -- Insumo direto estocável
          UPDATE public.insumos
            SET saldo_estoque = saldo_estoque - (v_ing.quantidade * v_item.quantity),
                updated_at = now()
            WHERE id = v_ing.insumo_id AND estocavel = true;
        ELSIF v_ing.subproduto_id IS NOT NULL THEN
          -- Subproduto: abate proporcional dos insumos brutos que o formam
          SELECT COALESCE(NULLIF(rendimento_porcoes, 0), 1) INTO v_rend
            FROM public.subprodutos WHERE id = v_ing.subproduto_id;
          IF v_rend IS NULL THEN v_rend := 1; END IF;
          FOR v_comp IN
            SELECT cs.insumo_id, cs.quantidade
            FROM public.composicao_subproduto cs
            WHERE cs.subproduto_id = v_ing.subproduto_id
          LOOP
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque
                    - (v_comp.quantidade / v_rend * v_ing.quantidade * v_item.quantity),
                  updated_at = now()
              WHERE id = v_comp.insumo_id AND estocavel = true;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.explode_order_stock(uuid) FROM public, anon;

-- 3. Gatilho de baixa dentro da finalização do pedido
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
  v_cashback numeric;
  v_conta RECORD;
  v_liquido numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT user_id, total, status_pedido INTO v_user, v_total, v_status
  FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Encerrado e pago' THEN RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user); END IF;

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;

  FOR v_pag IN
    SELECT pp.valor_pago, pp.id_meio_pagamento, mp.nome
    FROM public.pagamentos_pedido pp
    JOIN public.meios_pagamento mp ON mp.id = pp.id_meio_pagamento
    WHERE pp.id_pedido = p_order_id
  LOOP
    -- Record a revenue line for every payment method for reconciliation.
    IF v_caixa IS NOT NULL AND v_pag.id_meio_pagamento IS NOT NULL THEN
      INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
      VALUES (v_caixa, 'Recebimento Pedido', v_pag.valor_pago,
        'Pedido ' || substr(p_order_id::text,1,6) || ' (' || v_pag.nome || ')', v_pag.id_meio_pagamento);
    END IF;

    -- Treasury: card receivables projection (D+N + acquirer fee)
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
      INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento)
      VALUES (v_user, p_order_id, 'Debito_Compra', v_pag.valor_pago,
        (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user));
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa');
    END IF;
  END LOOP;

  -- credit 5% cashback on the order total
  v_cashback := round(COALESCE(v_total,0) * 0.05, 2);
  IF v_cashback > 0 THEN
    UPDATE public.profiles SET saldo_cashback = saldo_cashback + v_cashback WHERE id = v_user;
    INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao)
    VALUES (v_user, p_order_id, 'Credito', v_cashback, 'Cashback de 5% sobre a compra');
  END IF;

  -- EXPLOSÃO DE ESTOQUE: baixa automática no momento do pagamento
  PERFORM public.explode_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- 4. Patrimônio líquido em estoque (valor de custo total), admin-only
CREATE OR REPLACE FUNCTION public.get_patrimonio_estoque()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  SELECT
    COALESCE((SELECT SUM(saldo_estoque * custo_unitario) FROM public.insumos WHERE estocavel = true), 0)
    + COALESCE((SELECT SUM(saldo_estoque * price) FROM public.products WHERE manipulado = false), 0)
  INTO v;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_patrimonio_estoque() FROM public, anon;

-- 5. Ordens de compra (manual / avulsa)
CREATE SEQUENCE IF NOT EXISTS public.ordem_compra_seq START 1;

CREATE TABLE IF NOT EXISTS public.ordens_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.ordem_compra_seq'),
  id_fornecedor uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Aberta',
  origem text NOT NULL DEFAULT 'Manual',
  observacao text NOT NULL DEFAULT '',
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_compra TO authenticated;
GRANT ALL ON public.ordens_compra TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ordem_compra_seq TO authenticated, service_role;
ALTER TABLE public.ordens_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ordens_compra" ON public.ordens_compra
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.itens_ordem_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ordem_compra uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'insumo',
  ref_id uuid,
  nome text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  custo_unitario numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_ordem_compra TO authenticated;
GRANT ALL ON public.itens_ordem_compra TO service_role;
ALTER TABLE public.itens_ordem_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage itens_ordem_compra" ON public.itens_ordem_compra
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ordens_compra_updated_at
  BEFORE UPDATE ON public.ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC para criar ordem de compra
CREATE OR REPLACE FUNCTION public.criar_ordem_compra(
  p_fornecedor uuid,
  p_observacao text,
  p_origem text,
  p_itens jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem uuid;
  v_numero integer;
  v_total numeric := 0;
  v_item jsonb;
  v_qtd numeric;
  v_custo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  INSERT INTO public.ordens_compra (id_fornecedor, observacao, origem, valor_total)
  VALUES (p_fornecedor, COALESCE(p_observacao, ''), COALESCE(NULLIF(p_origem, ''), 'Manual'), 0)
  RETURNING id, numero INTO v_ordem, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::numeric, 0);
    INSERT INTO public.itens_ordem_compra
      (id_ordem_compra, tipo, ref_id, nome, quantidade, custo_unitario)
    VALUES (v_ordem,
      COALESCE(v_item->>'tipo', 'insumo'),
      NULLIF(v_item->>'ref_id', '')::uuid,
      COALESCE(v_item->>'nome', ''),
      v_qtd, v_custo);
    v_total := v_total + (v_qtd * v_custo);
  END LOOP;

  UPDATE public.ordens_compra SET valor_total = v_total WHERE id = v_ordem;
  RETURN v_numero;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_ordem_compra(uuid, text, text, jsonb) FROM public, anon;

-- 6. Tempo real para atualização automática do patrimônio
ALTER TABLE public.insumos REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.insumos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;