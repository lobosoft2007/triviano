-- 1. Ajusta o trigger de INSERT: não notificar pedidos que estão aguardando
-- pagamento online (PIX/cartão via Mercado Pago). Esses pedidos são criados
-- antes do pagamento; a notificação só deve ir quando forem realmente
-- enviados à cozinha.
CREATE OR REPLACE FUNCTION public.notify_customer_order_sent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_brand text;
  v_order_no text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pedido online aguardando pagamento: NÃO notifica no INSERT.
  -- A notificação é disparada pelo trigger de UPDATE quando o pagamento
  -- é confirmado (aguardando_pagamento: true -> false).
  IF NEW.aguardando_pagamento IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT nome_fantasia INTO v_brand FROM public.empresas WHERE id = NEW.empresa_id;
  v_brand := COALESCE(NULLIF(btrim(v_brand), ''), 'Estabelecimento');

  v_order_no := '#' || upper(substr(NEW.id::text, 1, 6));

  INSERT INTO public.notificacoes_cliente (id_pedido, id_usuario, titulo, mensagem)
  VALUES (
    NEW.id,
    NEW.user_id,
    'Pedido enviado',
    v_brand || ': recebemos o seu pedido ' || v_order_no ||
    '! Ja esta na nossa fila e em breve comecamos o preparo.'
  );

  RETURN NEW;
END;
$function$;

-- 2. Novo trigger de UPDATE: dispara a notificação "Pedido enviado" apenas
-- quando o pedido sai do estado "aguardando pagamento" (pagamento confirmado
-- pelo webhook do Mercado Pago), momento em que ele realmente entra na fila.
CREATE OR REPLACE FUNCTION public.notify_customer_order_paid_sent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_brand text;
  v_order_no text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome_fantasia INTO v_brand FROM public.empresas WHERE id = NEW.empresa_id;
  v_brand := COALESCE(NULLIF(btrim(v_brand), ''), 'Estabelecimento');

  v_order_no := '#' || upper(substr(NEW.id::text, 1, 6));

  INSERT INTO public.notificacoes_cliente (id_pedido, id_usuario, titulo, mensagem)
  VALUES (
    NEW.id,
    NEW.user_id,
    'Pedido enviado',
    v_brand || ': recebemos o seu pedido ' || v_order_no ||
    '! Ja esta na nossa fila e em breve comecamos o preparo.'
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_customer_order_paid_sent ON public.orders;
CREATE TRIGGER trg_notify_customer_order_paid_sent
  AFTER UPDATE OF aguardando_pagamento ON public.orders
  FOR EACH ROW
  WHEN (OLD.aguardando_pagamento IS TRUE AND NEW.aguardando_pagamento IS FALSE)
  EXECUTE FUNCTION public.notify_customer_order_paid_sent();