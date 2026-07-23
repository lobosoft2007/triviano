
-- =========================================================================
-- Motor de impressão Fase A
-- =========================================================================

-- 1) Nova coluna em config_impressoras
ALTER TABLE public.config_impressoras
  ADD COLUMN IF NOT EXISTS imprime_pedido_completo boolean NOT NULL DEFAULT false;

-- =========================================================================
-- 2) Tabela print_jobs
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES public.config_impressoras(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'setor',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  CONSTRAINT print_jobs_status_check
    CHECK (status IN ('pending','printing','done','failed','expired')),
  CONSTRAINT print_jobs_tipo_check
    CHECK (tipo IN ('setor','pedido_completo','teste','reimpressao'))
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_empresa_status_created
  ON public.print_jobs(empresa_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_status
  ON public.print_jobs(printer_id, status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order
  ON public.print_jobs(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff da empresa lê print_jobs" ON public.print_jobs;
CREATE POLICY "Staff da empresa lê print_jobs"
  ON public.print_jobs FOR SELECT
  TO authenticated
  USING (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Staff da empresa insere print_jobs" ON public.print_jobs;
CREATE POLICY "Staff da empresa insere print_jobs"
  ON public.print_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Staff da empresa atualiza print_jobs" ON public.print_jobs;
CREATE POLICY "Staff da empresa atualiza print_jobs"
  ON public.print_jobs FOR UPDATE
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS "Staff da empresa deleta print_jobs" ON public.print_jobs;
CREATE POLICY "Staff da empresa deleta print_jobs"
  ON public.print_jobs FOR DELETE
  TO authenticated
  USING (public.can_manage_empresa(empresa_id));

-- =========================================================================
-- 3) Tabela printer_agent_tokens (só hash)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.printer_agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_printer_agent_tokens_empresa
  ON public.printer_agent_tokens(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_agent_tokens TO authenticated;
GRANT ALL ON public.printer_agent_tokens TO service_role;

ALTER TABLE public.printer_agent_tokens ENABLE ROW LEVEL SECURITY;

-- Master admin (nivel_id IS NULL) da empresa gerencia
DROP POLICY IF EXISTS "Master admin lê agent tokens" ON public.printer_agent_tokens;
CREATE POLICY "Master admin lê agent tokens"
  ON public.printer_agent_tokens FOR SELECT
  TO authenticated
  USING (
    public.is_master_admin() AND
    empresa_id = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "Master admin insere agent tokens" ON public.printer_agent_tokens;
CREATE POLICY "Master admin insere agent tokens"
  ON public.printer_agent_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_master_admin() AND
    empresa_id = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "Master admin atualiza agent tokens" ON public.printer_agent_tokens;
CREATE POLICY "Master admin atualiza agent tokens"
  ON public.printer_agent_tokens FOR UPDATE
  TO authenticated
  USING (
    public.is_master_admin() AND
    empresa_id = public.current_empresa_id()
  )
  WITH CHECK (
    public.is_master_admin() AND
    empresa_id = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "Master admin deleta agent tokens" ON public.printer_agent_tokens;
CREATE POLICY "Master admin deleta agent tokens"
  ON public.printer_agent_tokens FOR DELETE
  TO authenticated
  USING (
    public.is_master_admin() AND
    empresa_id = public.current_empresa_id()
  );

-- =========================================================================
-- 4) RPC: create_printer_agent_token
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_printer_agent_token(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_token text;
  v_hash text;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador master.';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;
  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Informe um nome para o agente.';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.printer_agent_tokens(empresa_id, nome, token_hash)
  VALUES (v_empresa, btrim(p_nome), v_hash);

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_printer_agent_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_printer_agent_token(text) TO authenticated;

-- =========================================================================
-- 5) RPC: revoke_printer_agent_token
-- =========================================================================
CREATE OR REPLACE FUNCTION public.revoke_printer_agent_token(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador master.';
  END IF;
  DELETE FROM public.printer_agent_tokens
  WHERE id = p_id AND empresa_id = public.current_empresa_id();
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_printer_agent_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.revoke_printer_agent_token(uuid) TO authenticated;

-- =========================================================================
-- 6) RPC: enqueue_print_jobs
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enqueue_print_jobs(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_created integer := 0;
  v_printer record;
  v_items jsonb;
  v_items_sector jsonb;
  v_client_phone text;
  v_client_name text;
BEGIN
  SELECT o.*, p.nome_completo AS cliente_nome
    INTO v_order
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido % não encontrado.', p_order_id;
  END IF;

  v_client_name := COALESCE(v_order.cliente_nome, '');
  v_client_phone := COALESCE(v_order.phone, '');

  -- Payload completo com todos os itens (para impressora de balcão / pedido_completo)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'size', oi.size,
      'addons', oi.addons,
      'second_flavor', oi.second_flavor,
      'remocoes', oi.remocoes,
      'category_id', p.category_id,
      'printer_id', c.id_impressora_destino
    ) ORDER BY oi.created_at
  ), '[]'::jsonb)
    INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE oi.order_id = p_order_id;

  -- 1) Um job por impressora que possui itens roteados
  FOR v_printer IN
    SELECT DISTINCT ci.*
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    JOIN public.config_impressoras ci
      ON ci.id = c.id_impressora_destino
     AND ci.empresa_id = v_order.empresa_id
     AND ci.ativo = true
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT jsonb_agg(item ORDER BY (item->>'product_name'))
      INTO v_items_sector
    FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'printer_id')::uuid = v_printer.id;

    IF v_items_sector IS NULL OR jsonb_array_length(v_items_sector) = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.print_jobs(
      empresa_id, printer_id, order_id, tipo, payload
    ) VALUES (
      v_order.empresa_id, v_printer.id, p_order_id, 'setor',
      jsonb_build_object(
        'sector_name', v_printer.nome,
        'order', jsonb_build_object(
          'id', v_order.id,
          'senha', v_order.senha,
          'senha_diaria', v_order.senha_diaria,
          'tipo_atendimento', v_order.tipo_atendimento,
          'numero_mesa', v_order.numero_mesa,
          'observacoes_operador', v_order.observacoes_operador,
          'notes', v_order.notes,
          'created_at', v_order.created_at,
          'cliente_nome', v_client_name,
          'phone', v_client_phone
        ),
        'items', v_items_sector
      )
    );
    v_created := v_created + 1;
  END LOOP;

  -- 2) Cupom completo do balcão (imprime_pedido_completo)
  FOR v_printer IN
    SELECT * FROM public.config_impressoras
    WHERE empresa_id = v_order.empresa_id
      AND ativo = true
      AND imprime_pedido_completo = true
  LOOP
    INSERT INTO public.print_jobs(
      empresa_id, printer_id, order_id, tipo, payload
    ) VALUES (
      v_order.empresa_id, v_printer.id, p_order_id, 'pedido_completo',
      jsonb_build_object(
        'sector_name', v_printer.nome,
        'order', jsonb_build_object(
          'id', v_order.id,
          'senha', v_order.senha,
          'senha_diaria', v_order.senha_diaria,
          'tipo_atendimento', v_order.tipo_atendimento,
          'numero_mesa', v_order.numero_mesa,
          'delivery_address', v_order.delivery_address,
          'observacoes_operador', v_order.observacoes_operador,
          'notes', v_order.notes,
          'total', v_order.total,
          'discount', v_order.discount,
          'desconto_manual', v_order.desconto_manual,
          'cashback_usado', v_order.cashback_usado,
          'tipo_pagamento', v_order.tipo_pagamento,
          'created_at', v_order.created_at,
          'cliente_nome', v_client_name,
          'phone', v_client_phone
        ),
        'items', v_items
      )
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_print_jobs(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_print_jobs(uuid) TO authenticated, service_role;

-- =========================================================================
-- 7) RPC: enqueue_test_print
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enqueue_test_print(p_printer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_printer public.config_impressoras;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_printer FROM public.config_impressoras WHERE id = p_printer_id;
  IF v_printer IS NULL THEN
    RAISE EXCEPTION 'Impressora não encontrada.';
  END IF;
  IF NOT public.can_manage_empresa(v_printer.empresa_id) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  INSERT INTO public.print_jobs(empresa_id, printer_id, tipo, payload)
  VALUES (
    v_printer.empresa_id, v_printer.id, 'teste',
    jsonb_build_object(
      'sector_name', v_printer.nome,
      'message', 'Cupom de teste — impressora conectada com sucesso.',
      'created_at', now()
    )
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_test_print(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_test_print(uuid) TO authenticated;

-- =========================================================================
-- 8) RPC: claim_print_jobs (atômico com SKIP LOCKED)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.claim_print_jobs(
  p_empresa_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS SETOF public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.print_jobs
    WHERE empresa_id = p_empresa_id
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  UPDATE public.print_jobs pj
  SET status = 'printing',
      claimed_at = now(),
      attempts = pj.attempts + 1
  FROM picked
  WHERE pj.id = picked.id
  RETURNING pj.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_print_jobs(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_print_jobs(uuid, integer) TO service_role;

-- =========================================================================
-- 9) RPC: ack_print_job
-- =========================================================================
CREATE OR REPLACE FUNCTION public.ack_print_job(
  p_job_id uuid,
  p_ok boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.print_jobs;
BEGIN
  SELECT * INTO v_job FROM public.print_jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN RETURN; END IF;

  IF p_ok THEN
    UPDATE public.print_jobs
    SET status = 'done', printed_at = now(), last_error = NULL
    WHERE id = p_job_id;
  ELSE
    IF v_job.attempts >= 3 THEN
      UPDATE public.print_jobs
      SET status = 'failed', last_error = COALESCE(p_error, 'unknown')
      WHERE id = p_job_id;
    ELSE
      -- devolve para fila para nova tentativa
      UPDATE public.print_jobs
      SET status = 'pending', claimed_at = NULL,
          last_error = COALESCE(p_error, 'unknown')
      WHERE id = p_job_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ack_print_job(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ack_print_job(uuid, boolean, text) TO service_role;

-- =========================================================================
-- 10) RPC: manutenção da fila (chamado pelo pg_cron)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.maintain_print_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- expira pendentes vencidos
  UPDATE public.print_jobs
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at <= now();

  -- devolve à fila jobs presos como 'printing' há mais de 2 min
  UPDATE public.print_jobs
  SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
      claimed_at = NULL,
      last_error = COALESCE(last_error, 'stuck_printing_timeout')
  WHERE status = 'printing'
    AND claimed_at IS NOT NULL
    AND claimed_at < now() - interval '2 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_print_jobs() FROM public;

-- Agenda no pg_cron (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('maintain_print_jobs_every_minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'maintain_print_jobs_every_minute',
  '* * * * *',
  $$ SELECT public.maintain_print_jobs(); $$
);

-- =========================================================================
-- 11) Trigger em orders: enfileira ao "enviar para cozinha" e ao pagar/entregar
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_orders_enqueue_print()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enviou para cozinha (impresso_cozinha false -> true)
  IF NEW.impresso_cozinha = true AND COALESCE(OLD.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    RETURN NEW;
  END IF;

  -- Passou a 'paid' ou 'delivered' (finalização) e ainda não havíamos impresso
  IF NEW.status IN ('paid','delivered')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(NEW.impresso_cozinha, false) = false THEN
    PERFORM public.enqueue_print_jobs(NEW.id);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enqueue_print ON public.orders;
CREATE TRIGGER trg_orders_enqueue_print
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_enqueue_print();
