
ALTER TABLE public.meios_pagamento
  ADD COLUMN IF NOT EXISTS is_sistema boolean NOT NULL DEFAULT false;

-- Marca os 6 meios padrão existentes como "de sistema"
UPDATE public.meios_pagamento
   SET is_sistema = true
 WHERE lower(nome) IN ('pix','dinheiro','cashback','fiado','cartão de crédito','cartão de débito');

-- Nome único por empresa (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS meios_pagamento_empresa_nome_uniq
  ON public.meios_pagamento (empresa_id, lower(nome));

-- Trigger: novos meios criados via UI recebem empresa_id atual e is_sistema=false
CREATE OR REPLACE FUNCTION public.meios_pagamento_bi_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  -- Apenas superadmin (via SQL direto) pode marcar is_sistema=true.
  -- Inserts vindos do PostgREST (role authenticated) sempre viram is_sistema=false.
  IF current_setting('request.jwt.claims', true) IS NOT NULL THEN
    NEW.is_sistema := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meios_pagamento_bi_defaults ON public.meios_pagamento;
CREATE TRIGGER meios_pagamento_bi_defaults
BEFORE INSERT ON public.meios_pagamento
FOR EACH ROW EXECUTE FUNCTION public.meios_pagamento_bi_defaults();

-- RPC de exclusão com travas de integridade
CREATE OR REPLACE FUNCTION public.delete_meio_pagamento(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.meios_pagamento%ROWTYPE;
  v_uso_pagamentos integer;
  v_uso_contas integer;
BEGIN
  SELECT * INTO v_row FROM public.meios_pagamento WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meio de pagamento não encontrado.';
  END IF;

  IF NOT public.can_manage_empresa(v_row.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir meios desta empresa.';
  END IF;

  IF v_row.is_sistema THEN
    RAISE EXCEPTION 'Meios de pagamento padrão não podem ser excluídos. Desative-o em vez disso.';
  END IF;

  SELECT count(*) INTO v_uso_pagamentos
    FROM public.pagamentos_pedido WHERE id_meio = p_id;
  IF v_uso_pagamentos > 0 THEN
    RAISE EXCEPTION 'Este meio já foi usado em % pagamento(s) e não pode ser excluído. Desative-o em vez disso.', v_uso_pagamentos;
  END IF;

  SELECT count(*) INTO v_uso_contas
    FROM public.contas_financeiras WHERE id_meio_pagamento = p_id;
  IF v_uso_contas > 0 THEN
    RAISE EXCEPTION 'Este meio está vinculado a % conta(s) financeira(s). Remova o vínculo antes de excluir.', v_uso_contas;
  END IF;

  DELETE FROM public.meios_pagamento WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_meio_pagamento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_meio_pagamento(uuid) TO authenticated;
