
-- Defense-in-depth: trigger-based enforcement against TOCTOU in RLS subquery checks.
-- Blocks non-staff (customer) updates to financial/status fields on comanda_ativa and reservas.

CREATE OR REPLACE FUNCTION public.enforce_comanda_ativa_customer_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff (operators of the empresa) bypass; only enforce for customer path.
  IF public.can_manage_empresa(OLD.empresa_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.pago_online IS DISTINCT FROM OLD.pago_online
     OR NEW.mp_status IS DISTINCT FROM OLD.mp_status
     OR NEW.mp_payment_id IS DISTINCT FROM OLD.mp_payment_id
     OR NEW.mp_order_id IS DISTINCT FROM OLD.mp_order_id
     OR NEW.total_parcial IS DISTINCT FROM OLD.total_parcial
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Campos financeiros/status de comanda_ativa não podem ser alterados pelo cliente'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comanda_ativa_customer_immutable ON public.comanda_ativa;
CREATE TRIGGER trg_comanda_ativa_customer_immutable
  BEFORE UPDATE ON public.comanda_ativa
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comanda_ativa_customer_immutable_fields();

CREATE OR REPLACE FUNCTION public.enforce_reservas_customer_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.can_manage_empresa(OLD.empresa_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.numero_mesa IS DISTINCT FROM OLD.numero_mesa
     OR NEW.sinal_valor IS DISTINCT FROM OLD.sinal_valor
     OR NEW.mp_order_id IS DISTINCT FROM OLD.mp_order_id
     OR NEW.mp_payment_id IS DISTINCT FROM OLD.mp_payment_id
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Campos financeiros/status de reservas não podem ser alterados pelo cliente'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservas_customer_immutable ON public.reservas;
CREATE TRIGGER trg_reservas_customer_immutable
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reservas_customer_immutable_fields();
