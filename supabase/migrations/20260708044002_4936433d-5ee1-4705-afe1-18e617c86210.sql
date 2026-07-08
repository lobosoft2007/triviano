
-- ============================================================
-- FASE 2e/2f/2g — Isolamento final multi-tenant
-- Clientes/Cashback/Fiado + Perfis + Impressoras + funções DEFINER
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES: admin só enxerga clientes da própria empresa
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.can_manage_empresa(empresa_id));

-- ------------------------------------------------------------
-- CONFIG_IMPRESSORAS: adicionar empresa_id + escopo
-- ------------------------------------------------------------
ALTER TABLE public.config_impressoras ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
UPDATE public.config_impressoras SET empresa_id = '00000000-0000-0000-0000-000000000023' WHERE empresa_id IS NULL;
ALTER TABLE public.config_impressoras ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.config_impressoras ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
DROP TRIGGER IF EXISTS trg_config_impressoras_empresa ON public.config_impressoras;
CREATE TRIGGER trg_config_impressoras_empresa BEFORE INSERT ON public.config_impressoras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();

DROP POLICY IF EXISTS "Admins can view printers" ON public.config_impressoras;
DROP POLICY IF EXISTS "Admins can insert printers" ON public.config_impressoras;
DROP POLICY IF EXISTS "Admins can update printers" ON public.config_impressoras;
DROP POLICY IF EXISTS "Admins can delete printers" ON public.config_impressoras;
CREATE POLICY "Admins can view printers" ON public.config_impressoras
  FOR SELECT USING (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can insert printers" ON public.config_impressoras
  FOR INSERT WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can update printers" ON public.config_impressoras
  FOR UPDATE USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY "Admins can delete printers" ON public.config_impressoras
  FOR DELETE USING (public.can_manage_empresa(empresa_id));

-- ------------------------------------------------------------
-- Defaults + triggers: tabelas de clientes/cashback/fiado
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes_fiado','clientes_cashback','extrato_conta_corrente','extrato_fiado','historico_cashback','extrato_cashback']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_empresa ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_empresa BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_from_current();', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- POLICIES — Clientes/Cashback/Fiado
-- ------------------------------------------------------------

-- clientes_fiado
DROP POLICY IF EXISTS "Admins manage fiado credit" ON public.clientes_fiado;
CREATE POLICY "Admins manage fiado credit" ON public.clientes_fiado
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
-- "Users read own fiado credit" (auth.uid()=user_id) permanece inalterada.

-- clientes_cashback
DROP POLICY IF EXISTS "Cliente lê o próprio cashback" ON public.clientes_cashback;
CREATE POLICY "Cliente lê o próprio cashback" ON public.clientes_cashback
  FOR SELECT USING (cliente_id = auth.uid() OR public.can_manage_empresa(empresa_id));

-- extrato_conta_corrente
DROP POLICY IF EXISTS "Admins manage current account" ON public.extrato_conta_corrente;
CREATE POLICY "Admins manage current account" ON public.extrato_conta_corrente
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
DROP POLICY IF EXISTS "Users view own current account" ON public.extrato_conta_corrente;
CREATE POLICY "Users view own current account" ON public.extrato_conta_corrente
  FOR SELECT USING (auth.uid() = user_id OR public.can_manage_empresa(empresa_id));

-- extrato_fiado
DROP POLICY IF EXISTS "Admins manage fiado statement" ON public.extrato_fiado;
CREATE POLICY "Admins manage fiado statement" ON public.extrato_fiado
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
DROP POLICY IF EXISTS "Users view own fiado statement" ON public.extrato_fiado;
CREATE POLICY "Users view own fiado statement" ON public.extrato_fiado
  FOR SELECT USING (auth.uid() = id_usuario OR public.can_manage_empresa(empresa_id));

-- historico_cashback
DROP POLICY IF EXISTS "Admins manage cashback history" ON public.historico_cashback;
CREATE POLICY "Admins manage cashback history" ON public.historico_cashback
  FOR ALL USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
DROP POLICY IF EXISTS "Users view own cashback history" ON public.historico_cashback;
CREATE POLICY "Users view own cashback history" ON public.historico_cashback
  FOR SELECT USING (auth.uid() = id_usuario OR public.can_manage_empresa(empresa_id));

-- extrato_cashback
DROP POLICY IF EXISTS "Cliente lê o próprio extrato de cashback" ON public.extrato_cashback;
CREATE POLICY "Cliente lê o próprio extrato de cashback" ON public.extrato_cashback
  FOR SELECT USING (cliente_id = auth.uid() OR public.can_manage_empresa(empresa_id));

-- ============================================================
-- FUNÇÕES SECURITY DEFINER — reforço de escopo por empresa
-- ============================================================

-- admin_update_cliente: só edita cliente da própria empresa
CREATE OR REPLACE FUNCTION public.admin_update_cliente(p_user_id uuid, p_full_name text, p_tipo_logradouro text, p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_municipio text, p_estado text, p_cep text, p_ddd text, p_telefone text, p_latitude numeric, p_longitude numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF NOT public.can_manage_empresa((SELECT empresa_id FROM public.profiles WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'Cliente de outra empresa.';
  END IF;
  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
    tipo_logradouro = p_tipo_logradouro,
    logradouro = p_logradouro,
    numero = p_numero,
    complemento = p_complemento,
    bairro = p_bairro,
    municipio = p_municipio,
    estado = p_estado,
    cep = p_cep,
    ddd = p_ddd,
    telefone = p_telefone,
    latitude = p_latitude,
    longitude = p_longitude,
    address = NULLIF(trim(both ', ' FROM concat_ws(', ',
      NULLIF(trim(concat_ws(' ', NULLIF(p_tipo_logradouro, ''), NULLIF(p_logradouro, ''))), ''),
      NULLIF(p_numero, ''),
      NULLIF(p_bairro, ''),
      NULLIF(p_municipio, ''),
      NULLIF(p_estado, ''))), ''),
    phone = NULLIF(trim(concat_ws(' ', NULLIF(p_ddd, ''), NULLIF(p_telefone, ''))), ''),
    updated_at = now()
  WHERE id = p_user_id;
END;
$function$;

-- set_cliente_bloqueado: só bloqueia cliente da própria empresa
CREATE OR REPLACE FUNCTION public.set_cliente_bloqueado(p_user_id uuid, p_bloqueado boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF NOT public.can_manage_empresa((SELECT empresa_id FROM public.profiles WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'Cliente de outra empresa.';
  END IF;
  UPDATE public.profiles
    SET bloqueado = COALESCE(p_bloqueado, false)
    WHERE id = p_user_id;
END;
$function$;

-- get_active_pix_config: escopar pela empresa do operador/cliente
CREATE OR REPLACE FUNCTION public.get_active_pix_config()
 RETURNS TABLE(chave_pix_padrao text, nome_recebedor text, cidade_recebedor text, gateway_banco text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT chave_pix_padrao, nome_recebedor, cidade_recebedor, gateway_banco
  FROM public.config_pagamentos
  WHERE ativo = true
    AND empresa_id = public.current_empresa_id()
  ORDER BY updated_at DESC
  LIMIT 1
$function$;

-- admin_get_empresa_config: retornar a empresa do administrador logado
CREATE OR REPLACE FUNCTION public.admin_get_empresa_config()
 RETURNS TABLE(id uuid, nome_fantasia text, logotipo_url text, taxa_servico_mesa numeric, dominio_customizado text, cep text, logradouro text, numero text, complemento text, bairro text, cidade text, estado text, ativo boolean, cor_primaria text, cor_secundaria text, modo_fundo text, percentual_cashback numeric, cashback_ativo boolean, monitor_cozinha boolean, monitor_bar boolean, monitor_pizzaria boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.nome_fantasia, e.logotipo_url, e.taxa_servico_mesa,
           e.dominio_customizado, e.cep, e.logradouro, e.numero, e.complemento,
           e.bairro, e.cidade, e.estado, e.ativo,
           e.cor_primaria, e.cor_secundaria, e.modo_fundo,
           e.percentual_cashback, e.cashback_ativo,
           e.monitor_cozinha, e.monitor_bar, e.monitor_pizzaria
    FROM public.empresas e
    WHERE e.id = public.current_empresa_id()
    LIMIT 1;
END;
$function$;

-- finalize_order_paid: caixa aberto restrito à empresa do operador
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
  v_conta RECORD;
  v_liquido numeric;
  v_empresa uuid;
  v_novo_cash numeric;
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
    WHERE status = 'Aberto'
      AND public.user_empresa_id(id_usuario) = public.current_empresa_id()
    ORDER BY data_hora_abertura DESC LIMIT 1;

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

      UPDATE public.clientes_fiado
        SET saldo_devedor_atual = (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user),
            updated_at = now()
        WHERE user_id = v_user;
      PERFORM public.notify_fiado(v_user, v_pag.valor_pago, 'debito_compra');
    ELSIF v_pag.nome = 'Cashback' THEN
      UPDATE public.profiles SET saldo_cashback = GREATEST(0, saldo_cashback - v_pag.valor_pago)
        WHERE id = v_user
        RETURNING saldo_cashback INTO v_novo_cash;
      INSERT INTO public.historico_cashback (id_usuario, id_pedido, tipo, valor, descricao, empresa_id)
      VALUES (v_user, p_order_id, 'Debito', v_pag.valor_pago, 'Pagamento com cashback no caixa', v_empresa);
      INSERT INTO public.extrato_cashback
        (empresa_id, cliente_id, pedido_id, tipo_movimentacao, valor, saldo_residual)
      VALUES (COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023'),
        v_user, p_order_id, 'debito_uso', v_pag.valor_pago, COALESCE(v_novo_cash, 0));
    END IF;
  END LOOP;

  PERFORM public.explode_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Encerrado e pago', status = 'delivered'
    WHERE id = p_order_id;

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = v_user);
END;
$function$;

-- pay_fiado: caixa aberto restrito à empresa do operador
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
  IF NOT public.can_manage_empresa((SELECT empresa_id FROM public.profiles WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'Cliente de outra empresa.';
  END IF;
  v_pay := GREATEST(0, p_valor);
  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET saldo_devedor_fiado = GREATEST(0, saldo_devedor_fiado - v_pay)
    WHERE id = p_user_id;
  INSERT INTO public.extrato_fiado (id_usuario, id_pedido, tipo, valor, saldo_devedor_momento, empresa_id)
  VALUES (p_user_id, NULL, 'Credito_Pagamento', v_pay,
    (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id), v_empresa);

  SELECT id INTO v_caixa FROM public.fluxo_caixa
    WHERE status = 'Aberto'
      AND public.user_empresa_id(id_usuario) = public.current_empresa_id()
    ORDER BY data_hora_abertura DESC LIMIT 1;
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

  UPDATE public.clientes_fiado
    SET saldo_devedor_atual = (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id),
        updated_at = now()
    WHERE user_id = p_user_id;
  PERFORM public.notify_fiado(p_user_id, v_pay, 'credito_pagamento');

  RETURN (SELECT saldo_devedor_fiado FROM public.profiles WHERE id = p_user_id);
END;
$function$;
