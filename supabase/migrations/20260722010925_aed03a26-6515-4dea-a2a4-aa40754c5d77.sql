CREATE OR REPLACE FUNCTION public.enforce_order_finalized_requires_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_pedido = 'Finalizado'
     AND (OLD.status_pedido IS DISTINCT FROM 'Finalizado')
     AND COALESCE(NEW.status, '') <> 'paid' THEN
    RAISE EXCEPTION 'Pedido nao pode ser finalizado sem lancamento de pagamento. Use Finalizar e Receber.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_finalized_requires_paid ON public.orders;
CREATE TRIGGER trg_enforce_order_finalized_requires_paid
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_finalized_requires_paid();