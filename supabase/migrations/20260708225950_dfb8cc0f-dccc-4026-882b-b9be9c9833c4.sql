CREATE OR REPLACE FUNCTION public.notify_customer_order_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_notify_customer_order_sent ON public.orders;
CREATE TRIGGER trg_notify_customer_order_sent
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_order_sent();