-- ============================================================
-- BACK-OFFICE & TESOURARIA CORPORATIVA
-- ============================================================

-- 1) ENUMS ----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.tipo_conta_financeira AS ENUM ('Físico', 'Banco', 'Recebível_Futuro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_lancamento_tesouraria AS ENUM ('Entrada', 'Saída');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) CONTAS FINANCEIRAS --------------------------------------
CREATE TABLE public.contas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  saldo_atual numeric NOT NULL DEFAULT 0,
  tipo_conta public.tipo_conta_financeira NOT NULL DEFAULT 'Físico',
  ativo boolean NOT NULL DEFAULT true,
  -- acquirer settings (used for card receivables projection)
  id_meio_pagamento uuid REFERENCES public.meios_pagamento(id) ON DELETE SET NULL,
  taxa_percentual numeric NOT NULL DEFAULT 0,
  dias_liquidacao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_financeiras TO authenticated;
GRANT ALL ON public.contas_financeiras TO service_role;
ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contas_financeiras"
  ON public.contas_financeiras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_contas_financeiras_updated
  BEFORE UPDATE ON public.contas_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) LANCAMENTOS TESOURARIA ----------------------------------
CREATE TABLE public.lancamentos_tesouraria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_conta_financeira uuid NOT NULL REFERENCES public.contas_financeiras(id) ON DELETE CASCADE,
  tipo public.tipo_lancamento_tesouraria NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  categoria_fluxo text NOT NULL DEFAULT 'Venda',
  descricao text NOT NULL DEFAULT '',
  id_pedido uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  data_competencia timestamptz NOT NULL DEFAULT now(),
  data_liquidacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_tesouraria TO authenticated;
GRANT ALL ON public.lancamentos_tesouraria TO service_role;
ALTER TABLE public.lancamentos_tesouraria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lancamentos_tesouraria"
  ON public.lancamentos_tesouraria FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_lancamentos_conta ON public.lancamentos_tesouraria(id_conta_financeira);
CREATE INDEX idx_lancamentos_liquidacao ON public.lancamentos_tesouraria(data_liquidacao);

-- 4) ESTOQUE: saldo no insumo (Kardex) -----------------------
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS saldo_estoque numeric NOT NULL DEFAULT 0;

-- 5) ENTRADAS AVULSAS DE ESTOQUE -----------------------------
CREATE SEQUENCE IF NOT EXISTS public.entrada_avulsa_doc_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.entradas_avulsas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_documento_interno integer NOT NULL DEFAULT nextval('public.entrada_avulsa_doc_seq'),
  id_fornecedor uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entradas_avulsas_estoque TO authenticated;
GRANT ALL ON public.entradas_avulsas_estoque TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.entrada_avulsa_doc_seq TO authenticated, service_role;
ALTER TABLE public.entradas_avulsas_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage entradas_avulsas_estoque"
  ON public.entradas_avulsas_estoque FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.itens_entrada_avulsa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_entrada_avulsa uuid NOT NULL REFERENCES public.entradas_avulsas_estoque(id) ON DELETE CASCADE,
  id_insumo uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  custo_unitario_momento numeric NOT NULL DEFAULT 0,
  custo_anterior_momento numeric NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_entrada_avulsa TO authenticated;
GRANT ALL ON public.itens_entrada_avulsa TO service_role;
ALTER TABLE public.itens_entrada_avulsa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage itens_entrada_avulsa"
  ON public.itens_entrada_avulsa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_itens_entrada_avulsa_entrada ON public.itens_entrada_avulsa(id_entrada_avulsa);

-- 6) RPC: registrar entrada avulsa de estoque ----------------
CREATE OR REPLACE FUNCTION public.registrar_entrada_avulsa(
  p_fornecedor uuid,
  p_conta_financeira uuid,
  p_observacao text,
  p_itens jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrada uuid;
  v_numero integer;
  v_total numeric := 0;
  v_item jsonb;
  v_insumo uuid;
  v_qtd numeric;
  v_custo numeric;
  v_custo_ant numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

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
      SET custo_anterior = custo_unitario,
          custo_anterior_at = now(),
          custo_unitario = v_custo,
          saldo_estoque = saldo_estoque + v_qtd,
          updated_at = now()
      WHERE id = v_insumo;

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

  RETURN v_numero;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_entrada_avulsa(uuid, uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_avulsa(uuid, uuid, text, jsonb) TO authenticated;

-- 7) finalize_order_paid: projeção de recebíveis de cartão ---
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

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_order_paid(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_order_paid(uuid) TO authenticated;