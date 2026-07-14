-- ============================================================================
-- Módulo de Experiência de Mesa (v1.5.0) — Fase 1 + Fase 2
-- Adições isoladas; NÃO altera o motor financeiro (create_order, finalize_order_paid, etc.)
-- ============================================================================

-- 1. ENUMS ------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.solicitacao_mesa_status AS ENUM
    ('aguardando','liberada','recusada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comanda_status AS ENUM
    ('aberta','aguardando_fechamento','fechada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. COLUNAS DORMENTES EM empresas (geofence + segredo do QR) ---------------
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS mesa_exige_geofence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS geofence_raio_m integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS mesa_qr_secret text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

-- 3. TABELA solicitacoes_mesa ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacoes_mesa (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_mesa  integer NOT NULL,
  nome_cliente text NOT NULL DEFAULT '',
  telefone     text NOT NULL DEFAULT '',
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       public.solicitacao_mesa_status NOT NULL DEFAULT 'aguardando',
  host_origem  text,
  liberada_por uuid,
  liberada_em  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_mesa TO authenticated;
GRANT ALL ON public.solicitacoes_mesa TO service_role;

ALTER TABLE public.solicitacoes_mesa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ou operador leem solicitacoes"
  ON public.solicitacoes_mesa FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_empresa(empresa_id));

CREATE POLICY "Cliente cria a propria solicitacao"
  ON public.solicitacoes_mesa FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Cliente ou operador atualizam solicitacoes"
  ON public.solicitacoes_mesa FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_empresa(empresa_id))
  WITH CHECK (user_id = auth.uid() OR public.can_manage_empresa(empresa_id));

CREATE TRIGGER trg_solicitacoes_mesa_updated
  BEFORE UPDATE ON public.solicitacoes_mesa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_solicitacoes_mesa_empresa_status
  ON public.solicitacoes_mesa (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_mesa_user
  ON public.solicitacoes_mesa (user_id);

-- 4. TABELA comanda_ativa ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comanda_ativa (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_mesa    integer NOT NULL,
  solicitacao_id uuid REFERENCES public.solicitacoes_mesa(id) ON DELETE SET NULL,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_cliente   text NOT NULL DEFAULT '',
  status         public.comanda_status NOT NULL DEFAULT 'aberta',
  total_parcial  numeric NOT NULL DEFAULT 0,
  fechada_em     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comanda_ativa TO authenticated;
GRANT ALL ON public.comanda_ativa TO service_role;

ALTER TABLE public.comanda_ativa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ou operador leem comandas"
  ON public.comanda_ativa FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_empresa(empresa_id));

CREATE POLICY "Cliente ou operador atualizam comandas"
  ON public.comanda_ativa FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_empresa(empresa_id))
  WITH CHECK (user_id = auth.uid() OR public.can_manage_empresa(empresa_id));

CREATE TRIGGER trg_comanda_ativa_updated
  BEFORE UPDATE ON public.comanda_ativa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_comanda_ativa_empresa_status
  ON public.comanda_ativa (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_comanda_ativa_user
  ON public.comanda_ativa (user_id);

-- 5. COLUNA comanda_id EM orders -------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS comanda_id uuid REFERENCES public.comanda_ativa(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_comanda ON public.orders (comanda_id);

-- 6. TRIGGER de total parcial da comanda -----------------------------------
CREATE OR REPLACE FUNCTION public.comanda_recalc_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comanda uuid := COALESCE(NEW.comanda_id, OLD.comanda_id);
BEGIN
  IF v_comanda IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.comanda_ativa c
    SET total_parcial = COALESCE((
          SELECT SUM(o.total) FROM public.orders o
          WHERE o.comanda_id = v_comanda
            AND o.status_pedido <> 'Cancelado'
        ), 0),
        updated_at = now()
    WHERE c.id = v_comanda;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_comanda_total ON public.orders;
CREATE TRIGGER trg_orders_comanda_total
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.comanda_recalc_total();

-- 7. REALTIME ---------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_mesa;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comanda_ativa;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. RPCs -------------------------------------------------------------------

-- Token keyed-hash por mesa (Fase 2)
CREATE OR REPLACE FUNCTION public.mesa_token(p_empresa uuid, p_numero integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_secret text;
BEGIN
  SELECT mesa_qr_secret INTO v_secret FROM public.empresas WHERE id = p_empresa;
  IF v_secret IS NULL THEN RETURN NULL; END IF;
  RETURN substr(md5(p_empresa::text || ':' || p_numero::text || ':' || v_secret), 1, 10);
END;
$function$;

-- Abrir solicitação de mesa (valida host + token do QR)
CREATE OR REPLACE FUNCTION public.abrir_solicitacao_mesa(
  p_host text,
  p_numero_mesa integer,
  p_token text,
  p_nome text,
  p_telefone text
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;

  v_empresa := public.resolve_empresa_id_by_host(p_host);
  IF v_empresa IS NULL OR NOT public.is_empresa_ativa(v_empresa) THEN
    RAISE EXCEPTION 'Estabelecimento não reconhecido para este endereço.';
  END IF;

  IF p_numero_mesa IS NULL OR p_numero_mesa <= 0 THEN
    RAISE EXCEPTION 'Mesa inválida.';
  END IF;

  -- Segurança do QR: o token precisa casar com o segredo do tenant.
  IF p_token IS DISTINCT FROM public.mesa_token(v_empresa, p_numero_mesa) THEN
    RAISE EXCEPTION 'QR-Code inválido para esta mesa.';
  END IF;

  -- Reaproveita uma solicitação aguardando da mesma mesa/cliente, se existir.
  SELECT id INTO v_id FROM public.solicitacoes_mesa
    WHERE user_id = v_user AND empresa_id = v_empresa
      AND numero_mesa = p_numero_mesa AND status = 'aguardando'
    ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.solicitacoes_mesa
      SET nome_cliente = COALESCE(NULLIF(p_nome,''), nome_cliente),
          telefone = COALESCE(NULLIF(p_telefone,''), telefone),
          host_origem = p_host
      WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.solicitacoes_mesa
    (empresa_id, numero_mesa, nome_cliente, telefone, user_id, host_origem)
  VALUES
    (v_empresa, p_numero_mesa, COALESCE(p_nome,''), COALESCE(p_telefone,''), v_user, p_host)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Liberar mesa (Visto do operador) -> cria a comanda
CREATE OR REPLACE FUNCTION public.liberar_mesa(p_solicitacao_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol RECORD;
  v_comanda uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_mesa WHERE id = p_solicitacao_id;
  IF v_sol.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT public.can_manage_empresa(v_sol.empresa_id) THEN
    RAISE EXCEPTION 'Solicitação de outra empresa.';
  END IF;
  IF v_sol.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Solicitação não está mais aguardando.';
  END IF;

  UPDATE public.solicitacoes_mesa
    SET status = 'liberada', liberada_por = auth.uid(), liberada_em = now()
    WHERE id = p_solicitacao_id;

  -- Reaproveita comanda aberta existente da mesma mesa/cliente, se houver.
  SELECT id INTO v_comanda FROM public.comanda_ativa
    WHERE empresa_id = v_sol.empresa_id AND user_id = v_sol.user_id
      AND numero_mesa = v_sol.numero_mesa AND status = 'aberta'
    LIMIT 1;

  IF v_comanda IS NULL THEN
    INSERT INTO public.comanda_ativa
      (empresa_id, numero_mesa, solicitacao_id, user_id, nome_cliente)
    VALUES
      (v_sol.empresa_id, v_sol.numero_mesa, v_sol.id, v_sol.user_id, v_sol.nome_cliente)
    RETURNING id INTO v_comanda;
  END IF;

  RETURN v_comanda;
END;
$function$;

-- Recusar solicitação (operador)
CREATE OR REPLACE FUNCTION public.recusar_solicitacao_mesa(p_solicitacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_emp uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  SELECT empresa_id INTO v_emp FROM public.solicitacoes_mesa WHERE id = p_solicitacao_id;
  IF v_emp IS NULL OR NOT public.can_manage_empresa(v_emp) THEN
    RAISE EXCEPTION 'Solicitação inválida.';
  END IF;
  UPDATE public.solicitacoes_mesa SET status = 'recusada'
    WHERE id = p_solicitacao_id AND status = 'aguardando';
END;
$function$;

-- Desistir (cliente dono)
CREATE OR REPLACE FUNCTION public.desistir_solicitacao_mesa(p_solicitacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.solicitacoes_mesa SET status = 'expirada'
    WHERE id = p_solicitacao_id AND user_id = auth.uid() AND status = 'aguardando';
END;
$function$;

-- Enviar pedido da mesa para a cozinha (reaproveita create_order)
CREATE OR REPLACE FUNCTION public.enviar_pedido_mesa(
  p_items jsonb,
  p_host text,
  p_comanda_id uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_com RECORD;
  v_order uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;

  SELECT * INTO v_com FROM public.comanda_ativa WHERE id = p_comanda_id;
  IF v_com.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_com.user_id <> v_user THEN RAISE EXCEPTION 'Comanda de outro cliente.'; END IF;
  IF v_com.status <> 'aberta' THEN RAISE EXCEPTION 'Comanda não está aberta.'; END IF;

  v_order := public.create_order(
    p_items,
    '',                       -- delivery_address
    v_com.nome_cliente,       -- phone (reuso do campo p/ nome do cliente na mesa)
    COALESCE(p_notes, ''),
    'Presencial',
    v_com.numero_mesa,
    0,                        -- cashback usado
    p_host,
    false                     -- pagamento_online
  );

  UPDATE public.orders SET comanda_id = p_comanda_id WHERE id = v_order;

  RETURN v_order;
END;
$function$;

-- Fechar a conta (cliente ou operador)
CREATE OR REPLACE FUNCTION public.fechar_comanda(p_comanda_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_com RECORD;
BEGIN
  SELECT * INTO v_com FROM public.comanda_ativa WHERE id = p_comanda_id;
  IF v_com.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_com.user_id <> auth.uid() AND NOT public.can_manage_empresa(v_com.empresa_id) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.comanda_ativa
    SET status = 'aguardando_fechamento'
    WHERE id = p_comanda_id AND status = 'aberta';
END;
$function$;