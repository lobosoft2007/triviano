CREATE OR REPLACE FUNCTION public.retry_print_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_status text;
  v_locked_until timestamptz;
BEGIN
  SELECT empresa_id, status, locked_until
    INTO v_empresa, v_status, v_locked_until
  FROM public.print_jobs
  WHERE id = p_job_id;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Job não encontrado.';
  END IF;

  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para reimprimir este job.';
  END IF;

  IF v_status = 'printing' AND v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RAISE EXCEPTION 'Job em impressão. Aguarde alguns segundos e tente novamente.';
  END IF;

  UPDATE public.print_jobs
     SET status = 'pending',
         attempts = 0,
         last_error = NULL,
         claimed_at = NULL,
         locked_until = NULL,
         printed_at = NULL,
         next_attempt_at = now()
   WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_print_job(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.retry_print_job(uuid) TO authenticated, service_role;