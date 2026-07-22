CREATE OR REPLACE FUNCTION public.enforce_order_finalized_requires_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_pedido = 'Finalizado'
     AND (OLD.status_pedido IS DISTINCT FROM 'Finalizado')
     AND COALESCE(NEW.status, '') NOT IN ('paid', 'delivered') THEN
    RAISE EXCEPTION 'Pedido nao pode ser finalizado sem lancamento de pagamento. Use Finalizar e Receber.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;