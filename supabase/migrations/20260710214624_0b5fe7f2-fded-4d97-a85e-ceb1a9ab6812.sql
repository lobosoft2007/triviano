DO $migration$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.create_order(jsonb,text,text,text,text,integer,numeric,text,boolean)'::regprocedure)
    INTO v_def;

  IF position('v_tipo_pagamento text' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      $needle$  max_rounds integer;
BEGIN$needle$,
      $replace$  max_rounds integer;
  v_tipo_pagamento text;
  v_aguardando_pagamento boolean;
BEGIN$replace$
    );
  END IF;

  IF position('v_tipo_pagamento := CASE' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      $needle$  v_tipo := COALESCE(NULLIF(p_tipo_atendimento, ''), 'Delivery')::attendance_type;$needle$,
      $replace$  v_tipo := COALESCE(NULLIF(p_tipo_atendimento, ''), 'Delivery')::attendance_type;

  -- Segurança financeira: a forma de pagamento é inferida no banco a partir
  -- das observações normalizadas pelo checkout. PIX nunca depende da flag do
  -- frontend para nascer bloqueado.
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
  END;$replace$
    );
  END IF;

  IF position('tipo_pagamento_STAHL_MARKER' in v_def) > 0 THEN
    RAISE EXCEPTION 'unexpected marker';
  END IF;

  IF position('tipo_atendimento, numero_mesa, empresa_id, tipo_pagamento, aguardando_pagamento' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      $needle$    tipo_atendimento, numero_mesa, empresa_id, aguardando_pagamento
  ) VALUES ($needle$,
      $replace$    tipo_atendimento, numero_mesa, empresa_id, tipo_pagamento, aguardando_pagamento
  ) VALUES ($replace$
    );
  END IF;

  v_def := replace(
    v_def,
    $needle$    v_empresa, COALESCE(p_pagamento_online, false)
  ) RETURNING id INTO v_order_id;$needle$,
    $replace$    v_empresa, v_tipo_pagamento, v_aguardando_pagamento
  ) RETURNING id INTO v_order_id;$replace$
  );

  IF position('v_tipo_pagamento' in v_def) = 0
     OR position('tipo_pagamento, aguardando_pagamento' in v_def) = 0
     OR position('v_aguardando_pagamento' in v_def) = 0 THEN
    RAISE EXCEPTION 'Não foi possível atualizar create_order para a trava financeira.';
  END IF;

  EXECUTE v_def;
END
$migration$;

CREATE OR REPLACE FUNCTION public.enforce_pix_payment_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Normaliza pedidos criados por versões antigas do app, onde a forma de
  -- pagamento ainda vinha apenas no texto de observações.
  IF COALESCE(NEW.tipo_pagamento, 'nao_informado') = 'nao_informado' THEN
    IF COALESCE(NEW.notes, '') ILIKE 'Forma de pagamento: PIX%' THEN
      NEW.tipo_pagamento := 'pix';
    ELSIF COALESCE(NEW.notes, '') ILIKE 'Forma de pagamento: Dinheiro%' THEN
      NEW.tipo_pagamento := 'dinheiro_entrega';
    ELSIF COALESCE(NEW.notes, '') ILIKE 'Forma de pagamento: Cartão de Crédito%' THEN
      NEW.tipo_pagamento := 'cartao_credito_entrega';
    ELSIF COALESCE(NEW.notes, '') ILIKE 'Forma de pagamento: Cartão de Débito%' THEN
      NEW.tipo_pagamento := 'cartao_debito_entrega';
    ELSIF COALESCE(NEW.notes, '') ILIKE 'Forma de pagamento: Conta Corrente%' THEN
      NEW.tipo_pagamento := 'conta_corrente';
    END IF;
  END IF;

  -- INSERT: PIX jamais nasce visível, mesmo que outra camada envie false.
  IF TG_OP = 'INSERT'
     AND lower(COALESCE(NEW.tipo_pagamento, '')) = 'pix'
     AND COALESCE(NEW.aguardando_pagamento, true) = false THEN
    RAISE EXCEPTION 'PEDIDO_PIX_BLOQUEADO: pedido PIX não pode nascer liberado para cozinha.'
      USING ERRCODE = 'P0001';
  END IF;

  -- UPDATE: PIX só pode ser liberado quando o pagamento online for confirmado
  -- na mesma atualização (caminho do webhook/retorno bancário).
  IF TG_OP = 'UPDATE'
     AND lower(COALESCE(NEW.tipo_pagamento, '')) = 'pix'
     AND COALESCE(NEW.aguardando_pagamento, true) = false
     AND COALESCE(NEW.pago_online, false) = false THEN
    RAISE EXCEPTION 'PEDIDO_PIX_BLOQUEADO: pedido PIX não pago não pode ser liberado para cozinha.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pix_payment_lock ON public.orders;
CREATE TRIGGER trg_enforce_pix_payment_lock
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pix_payment_lock();