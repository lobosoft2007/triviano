CREATE OR REPLACE FUNCTION public.trg_orders_enqueue_print()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Guarda anti-recursão: ignora reentradas causadas pelo próprio UPDATE interno.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.aguardando_pagamento, false) = false
       AND COALESCE(NEW.impresso_cozinha, false) = false THEN
      PERFORM public.enqueue_print_jobs(NEW.id);
      UPDATE public.orders SET impresso_cozinha = true WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- (a) Comanda de mesa/Caixa: operador clicou "Enviar p/ cozinha"
  IF NEW.impresso_cozinha = true AND COALESCE(OLD.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    RETURN NEW;
  END IF;

  -- (b) PIX/Cartão online confirmado pelo webhook
  IF COALESCE(OLD.aguardando_pagamento, false) = true
     AND COALESCE(NEW.aguardando_pagamento, false) = false
     AND COALESCE(NEW.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    UPDATE public.orders SET impresso_cozinha = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- (c) Rede de segurança: chegou em paid/delivered sem ter impresso
  IF NEW.status IN ('paid','delivered')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(NEW.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    UPDATE public.orders SET impresso_cozinha = true WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enqueue_print ON public.orders;
CREATE TRIGGER trg_orders_enqueue_print
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_enqueue_print();