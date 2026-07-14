-- Invalida a Order MP da comanda sempre que o total_parcial mudar
-- enquanto ela ainda estiver aberta. Assim uma cobrança criada para
-- um valor antigo (ex.: R$25) NUNCA é usada para liquidar um total
-- novo (ex.: R$29). O front regenera a Order para o valor novo.
CREATE OR REPLACE FUNCTION public._invalidate_mp_on_total_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pago_online IS DISTINCT FROM true
     AND NEW.total_parcial IS DISTINCT FROM OLD.total_parcial
     AND (OLD.mp_order_id IS NOT NULL OR OLD.mp_payment_id IS NOT NULL)
  THEN
    NEW.mp_order_id := NULL;
    NEW.mp_payment_id := NULL;
    NEW.mp_status := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_mp_on_total_change ON public.comanda_ativa;
CREATE TRIGGER trg_invalidate_mp_on_total_change
BEFORE UPDATE ON public.comanda_ativa
FOR EACH ROW
EXECUTE FUNCTION public._invalidate_mp_on_total_change();