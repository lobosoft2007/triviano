-- 1) Expand profiles with atomized address + geo + tenant
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_logradouro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logradouro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ddd text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

UPDATE public.profiles SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN empresa_id SET DEFAULT '00000000-0000-0000-0000-000000000023';

-- 2) Tenant isolation on customer wallet ledgers
ALTER TABLE public.extrato_fiado ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.extrato_fiado SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.extrato_fiado ALTER COLUMN empresa_id SET DEFAULT '00000000-0000-0000-0000-000000000023';

ALTER TABLE public.historico_cashback ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.historico_cashback SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.historico_cashback ALTER COLUMN empresa_id SET DEFAULT '00000000-0000-0000-0000-000000000023';

-- 3) Customer current-account statement
CREATE TABLE IF NOT EXISTS public.extrato_conta_corrente (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000023' REFERENCES public.empresas(id),
  tipo text NOT NULL CHECK (tipo IN ('Debito','Credito')),
  valor numeric NOT NULL DEFAULT 0,
  descricao text NOT NULL DEFAULT '',
  id_pedido uuid,
  saldo_devedor_momento numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extrato_conta_corrente TO authenticated;
GRANT ALL ON public.extrato_conta_corrente TO service_role;

ALTER TABLE public.extrato_conta_corrente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own current account"
  ON public.extrato_conta_corrente FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage current account"
  ON public.extrato_conta_corrente FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_extrato_cc_user ON public.extrato_conta_corrente (user_id, created_at DESC);

-- 4) New-user trigger: hydrate atomized address + tenant from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, phone, address, empresa_id,
    tipo_logradouro, logradouro, numero, complemento, bairro, municipio, estado, cep, ddd, telefone,
    latitude, longitude
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'address', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'empresa_id')::uuid, '00000000-0000-0000-0000-000000000023'),
    COALESCE(NEW.raw_user_meta_data ->> 'tipo_logradouro', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'logradouro', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'numero', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'complemento', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'bairro', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'municipio', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'estado', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'cep', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'ddd', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'telefone', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'latitude','')::numeric,
    NULLIF(NEW.raw_user_meta_data ->> 'longitude','')::numeric
  );
  RETURN NEW;
END;
$function$;

-- 5) Mirror fiado movements into the customer current account (purchases)
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
  v_empresa uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT user_id, total, status_pedido INTO v_user, v_total, v_status
  FROM public.orders WHERE id = p_order_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Encerrado e pago' THEN RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user); END IF;

  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = v_user;

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;

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
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa', v_empresa);
    END IF;
  END LOOP;

  v_cashback := round(COALESCE(v_total,0) * 0.05, 2);
  IF v_cashback > 0 THEN
    UPDATE public.profiles SET saldo_cashback = saldo_cashback + v_cashback WHERE id = v_user;
    INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
    VALUES (v_user, p_order_id, 'Credito', v_cashback, 'Cashback de 5% sobre a compra', v_empresa);
  END IF;

  PERFORM public.explode_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- 6) Mirror fiado payments into current account (credits)
CREATE OR REPLACE FUNCTION public.pay_fiado(p_user_id uuid, p_valor numeric, p_id_meio uuid, p_descricao text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caixa uuid;
  v_pay numeric;
  v_meio_nome text;
  v_empresa uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_pay := GREATEST(0, p_valor);
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET saldo_devedor_fiado = GREATEST(0, saldo_devedor_fiado - v_pay)
    WHERE id = p_user_id;
  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
  VALUES (p_user_id, NULL, 'Credito_Pagamento', v_pay,
    (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id), v_empresa);

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto' ORDER BY data_hora_abertura DESC LIMIT 1;
  SELECT nome INTO v_meio_nome FROM public.meios_pagamento WHERE id = p_id_meio;

  INSERT INTO public.extrato_conta_corrente (user_id, empresa_id, tipo, valor, descricao, saldo_devedor_momento)
  VALUES (p_user_id, v_empresa, 'Credito', v_pay,
    COALESCE(NULLIF(p_descricao,''), 'Pagamento') || COALESCE(' (' || v_meio_nome || ')',''),
    (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id));

  IF v_caixa IS NOT NULL AND p_id_meio IS NOT NULL THEN
    INSERT INTO public.movimentacoes_caixa (id_caixa, tipo, valor, motivo, id_meio_pagamento)
    VALUES (v_caixa, 'Recebimento Pedido', v_pay,
      COALESCE(NULLIF(p_descricao,''), 'Quitação de fiado') || ' (' || COALESCE(v_meio_nome,'') || ')', p_id_meio);
  END IF;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id);
END;
$function$;