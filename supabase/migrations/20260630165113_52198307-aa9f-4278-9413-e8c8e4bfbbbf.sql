-- =========================================================
-- 1. ENUMS for cashback / fiado ledgers
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.cashback_tipo AS ENUM ('Credito','Debito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fiado_tipo AS ENUM ('Debito_Compra','Credito_Pagamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 2. meios_pagamento (relational payment methods)
-- =========================================================
CREATE TABLE public.meios_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  exige_maquineta boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meios_pagamento TO authenticated;
GRANT ALL ON public.meios_pagamento TO service_role;

ALTER TABLE public.meios_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read payment methods"
  ON public.meios_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage payment methods"
  ON public.meios_pagamento FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_meios_pagamento_updated_at
  BEFORE UPDATE ON public.meios_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.meios_pagamento (nome, exige_maquineta) VALUES
  ('Dinheiro', false),
  ('PIX', false),
  ('Cartão de Crédito', true),
  ('Cartão de Débito', true),
  ('Cashback', false),
  ('Fiado', false);

-- =========================================================
-- 3. Normalize pagamentos_pedido -> id_meio_pagamento FK
-- =========================================================
ALTER TABLE public.pagamentos_pedido
  ADD COLUMN id_meio_pagamento uuid REFERENCES public.meios_pagamento(id);

UPDATE public.pagamentos_pedido p
  SET id_meio_pagamento = m.id
  FROM public.meios_pagamento m
  WHERE m.nome = p.forma_pagamento::text;

ALTER TABLE public.pagamentos_pedido DROP COLUMN forma_pagamento;
DROP TYPE IF EXISTS public.forma_pagamento_tipo;

-- =========================================================
-- 4. movimentacoes_caixa -> id_meio_pagamento FK (revenue tagging)
-- =========================================================
ALTER TABLE public.movimentacoes_caixa
  ADD COLUMN id_meio_pagamento uuid REFERENCES public.meios_pagamento(id);

-- =========================================================
-- 5. profiles: cashback + fiado wallets
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saldo_cashback numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiado_autorizado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limite_fiado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_devedor_fiado numeric NOT NULL DEFAULT 0;

-- orders: how much cashback the customer redeemed on this order
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cashback_usado numeric NOT NULL DEFAULT 0;

-- =========================================================
-- 6. historico_cashback ledger
-- =========================================================
CREATE TABLE public.historico_cashback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_pedido uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  tipo public.cashback_tipo NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_cashback TO authenticated;
GRANT ALL ON public.historico_cashback TO service_role;

ALTER TABLE public.historico_cashback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cashback history"
  ON public.historico_cashback FOR SELECT TO authenticated
  USING (auth.uid() = id_usuario OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage cashback history"
  ON public.historico_cashback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 7. extrato_fiado ledger
-- =========================================================
CREATE TABLE public.extrato_fiado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_pedido uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  tipo public.fiado_tipo NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  saldo_devedor_momento numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extrato_fiado TO authenticated;
GRANT ALL ON public.extrato_fiado TO service_role;

ALTER TABLE public.extrato_fiado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fiado statement"
  ON public.extrato_fiado FOR SELECT TO authenticated
  USING (auth.uid() = id_usuario OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage fiado statement"
  ON public.extrato_fiado FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 8. RPC: customer redeems own cashback on their order (checkout)
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_cashback_for_order(p_order_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_saldo numeric;
  v_use numeric;
BEGIN
  SELECT user_id INTO v_user FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RAISE EXCEPTION 'Pedido inválido para este usuário.';
  END IF;
  SELECT saldo_cashback INTO v_saldo FROM public.profiles WHERE id = v_user;
  v_use := LEAST(GREATEST(p_amount, 0), v_saldo);
  IF v_use <= 0 THEN RETURN 0; END IF;
  UPDATE public.profiles SET saldo_cashback = saldo_cashback - v_use WHERE id = v_user;
  UPDATE public.orders SET cashback_usado = cashback_usado + v_use WHERE id = p_order_id;
  INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao)
  VALUES (v_user, p_order_id, 'Debito', v_use, 'Resgate de cashback no pedido');
  RETURN v_use;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_cashback_for_order(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_cashback_for_order(uuid, numeric) TO authenticated;

-- =========================================================
-- 9. RPC: operator finalizes & settles an order (admin only)
--    - splits pagamentos_pedido by payment method
--    - Fiado lines -> validate limit, debit fiado wallet, statement
--    - Cashback lines -> debit cashback wallet, history
--    - Cash/card/pix lines -> revenue movements in the open caixa
--    - credits 5% cashback of the order total
--    Returns the customer's resulting fiado balance (for the push msg).
-- =========================================================
CREATE OR REPLACE FUNCTION public.finalize_order_paid(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_total numeric;
  v_status text;
  v_caixa uuid;
  v_pag RECORD;
  v_meio RECORD;
  v_disp numeric;
  v_cashback numeric;
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
    IF v_pag.nome = 'Fiado' THEN
      SELECT (limite_fiado - saldo_devedor_fiado) INTO v_disp
        FROM public.profiles WHERE id = v_user;
      IF NOT (SELECT fiado_autorizado FROM public.profiles WHERE id = v_user) THEN
        RAISE EXCEPTION 'Cliente não está autorizado a comprar no fiado.';
      END IF;
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
    ELSE
      IF v_caixa IS NOT NULL THEN
        INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
        VALUES (v_caixa, 'Recebimento Pedido', v_pag.valor_pago,
          'Pedido ' || substr(p_order_id::text,1,6) || ' (' || v_pag.nome || ')', v_pag.id_meio_pagamento);
      END IF;
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
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_order_paid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_order_paid(uuid) TO authenticated;

-- =========================================================
-- 10. RPC: admin sets a customer's fiado configuration
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_fiado_config(p_user_id uuid, p_autorizado boolean, p_limite numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.profiles
    SET fiado_autorizado = p_autorizado, limite_fiado = GREATEST(0, p_limite)
    WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_fiado_config(uuid, boolean, numeric) TO authenticated;

-- =========================================================
-- 11. RPC: admin registers a fiado debt payment (quitação)
-- =========================================================
CREATE OR REPLACE FUNCTION public.pay_fiado(p_user_id uuid, p_valor numeric, p_id_meio uuid, p_descricao text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caixa uuid;
  v_pay numeric;
  v_meio_nome text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_pay := GREATEST(0, p_valor);
  UPDATE public.profiles SET saldo_devedor_fiado = GREATEST(0, saldo_devedor_fiado - v_pay)
    WHERE id = p_user_id;
  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento)
  VALUES (p_user_id, NULL, 'Credito_Pagamento', v_pay,
    (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id));

  -- record the received money into the open caixa (tagged by method)
  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;
  SELECT nome INTO v_meio_nome FROM public.meios_pagamento WHERE id = p_id_meio;
  IF v_caixa IS NOT NULL AND p_id_meio IS NOT NULL THEN
    INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
    VALUES (v_caixa, 'Recebimento Pedido', v_pay,
      COALESCE(NULLIF(p_descricao,''), 'Quitação de fiado') || ' (' || COALESCE(v_meio_nome,'') || ')', p_id_meio);
  END IF;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_fiado(uuid, numeric, uuid, text) TO authenticated;