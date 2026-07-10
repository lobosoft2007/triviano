ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tipo_pagamento text NOT NULL DEFAULT 'nao_informado';

COMMENT ON COLUMN public.orders.tipo_pagamento IS 'Forma de pagamento normalizada para travas financeiras: pix, dinheiro_entrega, cartao_credito_entrega, cartao_debito_entrega, cartao_credito_online, cartao_debito_online, conta_corrente.';

UPDATE public.orders
SET tipo_pagamento = CASE
  WHEN notes ILIKE 'Forma de pagamento: PIX%' THEN 'pix'
  WHEN notes ILIKE 'Forma de pagamento: Dinheiro%' THEN 'dinheiro_entrega'
  WHEN notes ILIKE 'Forma de pagamento: Cartão de Crédito%' THEN 'cartao_credito_entrega'
  WHEN notes ILIKE 'Forma de pagamento: Cartão de Débito%' THEN 'cartao_debito_entrega'
  WHEN notes ILIKE 'Forma de pagamento: Conta Corrente%' THEN 'conta_corrente'
  ELSE tipo_pagamento
END
WHERE tipo_pagamento = 'nao_informado';

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

  -- Trava de aço: PIX só pode ser liberado para caixa/cozinha quando a própria
  -- linha já estiver marcada como paga no mesmo UPDATE (caminho do webhook).
  -- Qualquer INSERT/UPDATE que tente PIX + aguardando_pagamento=false +
  -- pago_online=false é rejeitado no banco, independentemente do frontend.
  IF lower(COALESCE(NEW.tipo_pagamento, '')) = 'pix'
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