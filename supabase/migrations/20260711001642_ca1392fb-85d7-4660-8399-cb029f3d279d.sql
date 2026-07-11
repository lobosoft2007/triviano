CREATE OR REPLACE FUNCTION public.enforce_pix_payment_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo text;
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

  v_tipo := lower(COALESCE(NEW.tipo_pagamento, ''));

  -- INSERT: pagamento ONLINE (PIX ou cartão online) jamais nasce visível
  -- para a cozinha, mesmo que outra camada envie aguardando_pagamento = false.
  IF TG_OP = 'INSERT'
     AND v_tipo IN ('pix', 'cartao_credito_online', 'cartao_debito_online', 'online')
     AND COALESCE(NEW.aguardando_pagamento, true) = false
     AND COALESCE(NEW.pago_online, false) = false THEN
    RAISE EXCEPTION 'PEDIDO_ONLINE_BLOQUEADO: pedido com pagamento online não pode nascer liberado para a cozinha sem confirmação de pagamento.'
      USING ERRCODE = 'P0001';
  END IF;

  -- UPDATE: só pode ser liberado quando o pagamento online for confirmado na
  -- mesma atualização (caminho do webhook / retorno bancário).
  IF TG_OP = 'UPDATE'
     AND v_tipo IN ('pix', 'cartao_credito_online', 'cartao_debito_online', 'online')
     AND COALESCE(NEW.aguardando_pagamento, true) = false
     AND COALESCE(NEW.pago_online, false) = false THEN
    RAISE EXCEPTION 'PEDIDO_ONLINE_BLOQUEADO: pedido com pagamento online não pago não pode ser liberado para a cozinha.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_pix_payment_lock ON public.orders;
CREATE TRIGGER trg_enforce_pix_payment_lock
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pix_payment_lock();