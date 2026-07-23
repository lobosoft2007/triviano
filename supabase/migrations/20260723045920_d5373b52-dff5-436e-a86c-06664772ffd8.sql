
-- 1) Novas colunas em print_jobs
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_print_jobs_ready
  ON public.print_jobs(empresa_id, status, next_attempt_at);

-- 2) Coluna encoding opcional por impressora
ALTER TABLE public.config_impressoras
  ADD COLUMN IF NOT EXISTS encoding text;

-- 3) Redefine claim_print_jobs com re-claim automático via locked_until
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
      AND (
        (status = 'pending' AND next_attempt_at <= now())
        OR (status = 'printing' AND locked_until IS NOT NULL AND locked_until < now())
      )
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  UPDATE public.print_jobs pj
  SET status = 'printing',
      claimed_at = now(),
      locked_until = now() + interval '30 seconds',
      attempts = pj.attempts + 1
  FROM picked
  WHERE pj.id = picked.id
  RETURNING pj.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_print_jobs(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_print_jobs(uuid, integer) TO service_role;

-- 4) Redefine ack_print_job com backoff exponencial e teto de 5 tentativas
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
  v_backoff_seconds integer;
BEGIN
  SELECT * INTO v_job FROM public.print_jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN RETURN; END IF;

  IF p_ok THEN
    UPDATE public.print_jobs
    SET status = 'done',
        printed_at = now(),
        locked_until = NULL,
        last_error = NULL
    WHERE id = p_job_id;
  ELSIF v_job.attempts >= 5 THEN
    UPDATE public.print_jobs
    SET status = 'failed',
        locked_until = NULL,
        last_error = COALESCE(p_error, 'unknown')
    WHERE id = p_job_id;
  ELSE
    -- backoff: attempts^2 * 10 segundos (10, 40, 90, 160)
    v_backoff_seconds := GREATEST(v_job.attempts, 1) * GREATEST(v_job.attempts, 1) * 10;
    UPDATE public.print_jobs
    SET status = 'pending',
        claimed_at = NULL,
        locked_until = NULL,
        next_attempt_at = now() + make_interval(secs => v_backoff_seconds),
        last_error = COALESCE(p_error, 'unknown')
    WHERE id = p_job_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ack_print_job(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ack_print_job(uuid, boolean, text) TO service_role;

-- 5) Manutenção agora é apenas retenção de 7 dias (sem expirar 'pending')
CREATE OR REPLACE FUNCTION public.maintain_print_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.print_jobs
  WHERE status IN ('done','failed','expired')
    AND created_at < now() - interval '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_print_jobs() FROM public;

-- 6) Reagenda o cron para diário
DO $$
BEGIN
  PERFORM cron.unschedule('maintain_print_jobs_every_minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('maintain_print_jobs_daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'maintain_print_jobs_daily',
  '15 3 * * *',
  $$ SELECT public.maintain_print_jobs(); $$
);

-- 7) Backfill: jobs antigos com next_attempt_at nulo
UPDATE public.print_jobs
SET next_attempt_at = created_at
WHERE next_attempt_at IS NULL;

-- 8) RPC utilitário para "Reimprimir" a partir do painel
CREATE OR REPLACE FUNCTION public.retry_print_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.print_jobs WHERE id = p_job_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Job não encontrado.';
  END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para reenfileirar impressão.';
  END IF;

  UPDATE public.print_jobs
  SET status = 'pending',
      attempts = 0,
      claimed_at = NULL,
      locked_until = NULL,
      next_attempt_at = now(),
      last_error = NULL
  WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_print_job(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.retry_print_job(uuid) TO authenticated, service_role;
