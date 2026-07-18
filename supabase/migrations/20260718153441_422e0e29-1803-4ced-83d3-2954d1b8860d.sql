
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

ALTER TABLE public.pos_devices
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS battery_pct smallint,
  ADD COLUMN IF NOT EXISTS network_type text,
  ADD COLUMN IF NOT EXISTS printer_ok boolean,
  ADD COLUMN IF NOT EXISTS nfc_ok boolean,
  ADD COLUMN IF NOT EXISTS sdk_provider_ativo text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_operator_id uuid;

CREATE TABLE IF NOT EXISTS public.pos_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.pos_devices(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'heartbeat','login','logout','erro_sdk','erro_pix','erro_impressao',
    'ota_aplicada','config_alterada','ping_ack','bloqueado','desbloqueado'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_events_device_time ON public.pos_device_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_events_empresa_time ON public.pos_device_events(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_events_tipo_time ON public.pos_device_events(tipo, created_at DESC);
GRANT SELECT ON public.pos_device_events TO authenticated;
GRANT ALL ON public.pos_device_events TO service_role;
ALTER TABLE public.pos_device_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pos_device_events tenant admin read" ON public.pos_device_events;
CREATE POLICY "pos_device_events tenant admin read" ON public.pos_device_events
  FOR SELECT TO authenticated USING (public.can_manage_empresa(empresa_id));

CREATE TABLE IF NOT EXISTS public.pos_device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.pos_devices(id) ON DELETE CASCADE,
  comando text NOT NULL CHECK (comando IN (
    'ping','bloquear','desbloquear','forcar_logout',
    'reimprimir_ultimo','limpar_fila_offline','atualizar_config'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','entregue','executado','falhou','expirado')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  ack_at timestamptz,
  result jsonb
);
CREATE INDEX IF NOT EXISTS idx_pos_cmds_device_status ON public.pos_device_commands(device_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_cmds_empresa_time ON public.pos_device_commands(empresa_id, created_at DESC);
GRANT SELECT ON public.pos_device_commands TO authenticated;
GRANT ALL ON public.pos_device_commands TO service_role;
ALTER TABLE public.pos_device_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pos_device_commands tenant admin read" ON public.pos_device_commands;
CREATE POLICY "pos_device_commands tenant admin read" ON public.pos_device_commands
  FOR SELECT TO authenticated USING (public.can_manage_empresa(empresa_id));

CREATE TABLE IF NOT EXISTS public.pos_app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao text NOT NULL UNIQUE,
  versao_minima_obrigatoria text NOT NULL,
  apk_url text,
  notas text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.pos_app_releases TO authenticated, anon;
GRANT ALL ON public.pos_app_releases TO service_role;
ALTER TABLE public.pos_app_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pos_app_releases read all" ON public.pos_app_releases;
DROP POLICY IF EXISTS "pos_app_releases read anon" ON public.pos_app_releases;
DROP POLICY IF EXISTS "pos_app_releases superadmin write" ON public.pos_app_releases;
CREATE POLICY "pos_app_releases read all" ON public.pos_app_releases FOR SELECT TO authenticated USING (true);
CREATE POLICY "pos_app_releases read anon" ON public.pos_app_releases FOR SELECT TO anon USING (true);
CREATE POLICY "pos_app_releases superadmin write" ON public.pos_app_releases FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP VIEW IF EXISTS public.v_tap_transactions_daily;
CREATE VIEW public.v_tap_transactions_daily WITH (security_invoker = true) AS
SELECT
  date_trunc('day', p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
  p.empresa_id, p.pos_device_id AS device_id, 'pix'::text AS modalidade, p.provider,
  COUNT(*) AS qtd, SUM(p.valor) AS bruto, 0::numeric AS estornado, SUM(p.valor) AS liquido
FROM public.tap_pix_charges p
WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
GROUP BY 1,2,3,4,5
UNION ALL
SELECT
  date_trunc('day', c.paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
  c.empresa_id, c.pos_device_id AS device_id,
  ('cartao_' || COALESCE(c.modalidade,'na'))::text AS modalidade, c.provider,
  COUNT(*) AS qtd, SUM(c.valor) AS bruto,
  COALESCE(SUM(c.valor_reembolsado),0) AS estornado,
  SUM(c.valor) - COALESCE(SUM(c.valor_reembolsado),0) AS liquido
FROM public.tap_card_charges c
WHERE c.status IN ('approved','refunded','partially_refunded') AND c.paid_at IS NOT NULL
GROUP BY 1,2,3,4,5;
GRANT SELECT ON public.v_tap_transactions_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_send_command(
  p_device uuid, p_comando text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid; v_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.pos_devices WHERE id = p_device;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'device not found'; END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.pos_device_commands(empresa_id, device_id, comando, payload, created_by)
  VALUES (v_empresa, p_device, p_comando, COALESCE(p_payload,'{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  IF p_comando = 'bloquear' THEN
    UPDATE public.pos_devices SET ativo = false WHERE id = p_device;
    INSERT INTO public.pos_device_events(empresa_id, device_id, tipo, payload)
    VALUES (v_empresa, p_device, 'bloqueado', jsonb_build_object('by', auth.uid()));
  ELSIF p_comando = 'desbloquear' THEN
    UPDATE public.pos_devices SET ativo = true WHERE id = p_device;
    INSERT INTO public.pos_device_events(empresa_id, device_id, tipo, payload)
    VALUES (v_empresa, p_device, 'desbloqueado', jsonb_build_object('by', auth.uid()));
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.pos_send_command(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_fleet_kpis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid := public.current_empresa_id();
  v_online int; v_total int; v_low_batt int; v_errors int; v_tx_today numeric;
BEGIN
  IF v_empresa IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT COUNT(*) INTO v_total FROM pos_devices WHERE empresa_id = v_empresa AND revogado_em IS NULL;
  SELECT COUNT(*) INTO v_online FROM pos_devices WHERE empresa_id = v_empresa AND revogado_em IS NULL AND last_seen_at > now() - interval '5 minutes';
  SELECT COUNT(*) INTO v_low_batt FROM pos_devices WHERE empresa_id = v_empresa AND revogado_em IS NULL AND battery_pct IS NOT NULL AND battery_pct < 20;
  SELECT COUNT(*) INTO v_errors FROM pos_device_events WHERE empresa_id = v_empresa AND tipo IN ('erro_sdk','erro_pix','erro_impressao') AND created_at > now() - interval '24 hours';
  SELECT COALESCE(SUM(liquido),0) INTO v_tx_today FROM v_tap_transactions_daily WHERE empresa_id = v_empresa AND dia = current_date;
  RETURN jsonb_build_object('total', v_total, 'online', v_online, 'bateria_baixa', v_low_batt, 'erros_24h', v_errors, 'transacionado_hoje', v_tx_today);
END; $$;
GRANT EXECUTE ON FUNCTION public.pos_fleet_kpis() TO authenticated;

INSERT INTO public.pos_app_releases (versao, versao_minima_obrigatoria, notas, ativo)
VALUES ('1.0.0', '1.0.0', 'Release inicial Triviano Tap', true)
ON CONFLICT (versao) DO NOTHING;
