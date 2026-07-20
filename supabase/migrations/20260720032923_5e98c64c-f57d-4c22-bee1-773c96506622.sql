
-- ==========================================================================
-- Reservas + Fila de espera + toggle "pedido na mesa pelo cliente"
-- ==========================================================================

-- 1) Empresas: novos campos de config
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS pedido_na_mesa_pelo_cliente boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reserva_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserva_duracao_min integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS reserva_antecedencia_min_horas integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reserva_antecedencia_max_dias integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reserva_tolerancia_min integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS reserva_grupo_min integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reserva_grupo_max integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS reserva_sinal_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserva_sinal_por_pessoa numeric NOT NULL DEFAULT 0;

-- 2) Permissões: recepção
ALTER TABLE public.permissoes_matriz
  ADD COLUMN IF NOT EXISTS acesso_recepcao boolean NOT NULL DEFAULT false;

-- 3) Mesas físicas do salão (para o mapa de sala)
CREATE TABLE IF NOT EXISTS public.mesas_fisicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT current_empresa_id(),
  numero integer NOT NULL,
  capacidade integer NOT NULL DEFAULT 4,
  zona text NOT NULL DEFAULT '',
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas_fisicas TO authenticated;
GRANT ALL ON public.mesas_fisicas TO service_role;
ALTER TABLE public.mesas_fisicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mesas_fisicas_select" ON public.mesas_fisicas
  FOR SELECT TO authenticated USING (can_manage_empresa(empresa_id));
CREATE POLICY "mesas_fisicas_write" ON public.mesas_fisicas
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));
CREATE TRIGGER trg_mesas_fisicas_updated BEFORE UPDATE ON public.mesas_fisicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Configuração de capacidade por dia da semana + slot de 30 min
--    dia_semana: 0=domingo … 6=sábado (compatível com EXTRACT(DOW))
CREATE TABLE IF NOT EXISTS public.config_reservas_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT current_empresa_id(),
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora time NOT NULL,
  assentos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, dia_semana, hora)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_reservas_slot TO authenticated;
-- Cliente logado precisa ler a capacidade para calcular disponibilidade
GRANT SELECT ON public.config_reservas_slot TO authenticated;
GRANT ALL ON public.config_reservas_slot TO service_role;
ALTER TABLE public.config_reservas_slot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_reservas_slot_select_all" ON public.config_reservas_slot
  FOR SELECT TO authenticated USING (empresa_id = current_empresa_id());
CREATE POLICY "config_reservas_slot_write_gerente" ON public.config_reservas_slot
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));
CREATE TRIGGER trg_config_reservas_slot_updated BEFORE UPDATE ON public.config_reservas_slot
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Reservas
DO $$ BEGIN
  CREATE TYPE public.reserva_status AS ENUM (
    'pendente_pagamento','confirmada','cancelada','no_show','em_atendimento','concluida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT current_empresa_id(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  data date NOT NULL,
  hora time NOT NULL,
  pessoas integer NOT NULL CHECK (pessoas > 0),
  observacoes text NOT NULL DEFAULT '',
  status public.reserva_status NOT NULL DEFAULT 'confirmada',
  numero_mesa integer,
  comanda_id uuid REFERENCES public.comanda_ativa(id) ON DELETE SET NULL,
  sinal_valor numeric NOT NULL DEFAULT 0,
  mp_order_id text,
  mp_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservas_emp_data ON public.reservas(empresa_id, data, hora);
CREATE INDEX IF NOT EXISTS idx_reservas_user ON public.reservas(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservas TO authenticated;
GRANT ALL ON public.reservas TO service_role;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservas_select_own_or_staff" ON public.reservas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR can_manage_empresa(empresa_id));
CREATE POLICY "reservas_update_staff" ON public.reservas
  FOR UPDATE TO authenticated
  USING (can_manage_empresa(empresa_id) OR user_id = auth.uid())
  WITH CHECK (can_manage_empresa(empresa_id) OR user_id = auth.uid());
CREATE POLICY "reservas_delete_staff" ON public.reservas
  FOR DELETE TO authenticated USING (can_manage_empresa(empresa_id));
-- Inserts feitos exclusivamente via RPC (SECURITY DEFINER), sem policy de INSERT.
CREATE TRIGGER trg_reservas_updated BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Fila de espera (walk-in)
DO $$ BEGIN
  CREATE TYPE public.fila_espera_status AS ENUM (
    'aguardando','avisado','sentado','desistiu'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.fila_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT current_empresa_id(),
  nome text NOT NULL,
  telefone text NOT NULL DEFAULT '',
  pessoas integer NOT NULL CHECK (pessoas > 0),
  status public.fila_espera_status NOT NULL DEFAULT 'aguardando',
  posicao integer NOT NULL DEFAULT 0,
  avisado_em timestamptz,
  sentado_em timestamptz,
  numero_mesa integer,
  comanda_id uuid REFERENCES public.comanda_ativa(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fila_espera_emp_status ON public.fila_espera(empresa_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_espera TO authenticated;
GRANT ALL ON public.fila_espera TO service_role;
ALTER TABLE public.fila_espera ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fila_espera_staff" ON public.fila_espera
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));
CREATE TRIGGER trg_fila_espera_updated BEFORE UPDATE ON public.fila_espera
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Comanda ativa: vínculo com reserva / fila
ALTER TABLE public.comanda_ativa
  ADD COLUMN IF NOT EXISTS reserva_id uuid REFERENCES public.reservas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fila_id uuid REFERENCES public.fila_espera(id) ON DELETE SET NULL;

-- ==========================================================================
-- RPCs
-- ==========================================================================

-- Disponibilidade de horários para uma data e tamanho de grupo.
CREATE OR REPLACE FUNCTION public.reserva_disponibilidade(
  p_host text,
  p_data date,
  p_pessoas integer
) RETURNS TABLE(hora time, vagas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp uuid := public.resolve_empresa_id_by_host(p_host);
  v_dow smallint := EXTRACT(DOW FROM p_data)::smallint;
  v_min_ant int;
  v_max_dias int;
  v_ativa boolean;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  SELECT reserva_ativa, reserva_antecedencia_min_horas, reserva_antecedencia_max_dias
    INTO v_ativa, v_min_ant, v_max_dias
    FROM public.empresas WHERE id = v_emp;
  IF NOT COALESCE(v_ativa,false) THEN RETURN; END IF;
  IF p_data > (CURRENT_DATE + (v_max_dias || ' days')::interval)::date THEN RETURN; END IF;

  RETURN QUERY
    SELECT s.hora,
           GREATEST(
             s.assentos - COALESCE(SUM(r.pessoas) FILTER (
               WHERE r.status IN ('confirmada','pendente_pagamento','em_atendimento')
             ), 0)::int,
             0
           ) AS vagas
    FROM public.config_reservas_slot s
    LEFT JOIN public.reservas r
      ON r.empresa_id = s.empresa_id
     AND r.data = p_data
     AND r.hora = s.hora
    WHERE s.empresa_id = v_emp
      AND s.dia_semana = v_dow
      AND s.assentos > 0
      AND (p_data > CURRENT_DATE
           OR (p_data = CURRENT_DATE
               AND s.hora >= (CURRENT_TIME + (v_min_ant || ' hours')::interval)))
    GROUP BY s.hora, s.assentos
    HAVING (s.assentos - COALESCE(SUM(r.pessoas) FILTER (
              WHERE r.status IN ('confirmada','pendente_pagamento','em_atendimento')
            ), 0)::int) >= p_pessoas
    ORDER BY s.hora;
END $$;
GRANT EXECUTE ON FUNCTION public.reserva_disponibilidade(text, date, integer) TO authenticated;

-- Criar reserva (cliente logado)
CREATE OR REPLACE FUNCTION public.criar_reserva(
  p_host text,
  p_data date,
  p_hora time,
  p_pessoas integer,
  p_nome text,
  p_telefone text,
  p_observacoes text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_emp uuid := public.resolve_empresa_id_by_host(p_host);
  v_ativa boolean;
  v_sinal_ativo boolean;
  v_sinal_pp numeric;
  v_grupo_min int; v_grupo_max int;
  v_capacidade int;
  v_reservado int;
  v_dow smallint := EXTRACT(DOW FROM p_data)::smallint;
  v_status public.reserva_status;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;

  SELECT reserva_ativa, reserva_sinal_ativo, reserva_sinal_por_pessoa,
         reserva_grupo_min, reserva_grupo_max
    INTO v_ativa, v_sinal_ativo, v_sinal_pp, v_grupo_min, v_grupo_max
    FROM public.empresas WHERE id = v_emp;
  IF NOT COALESCE(v_ativa,false) THEN RAISE EXCEPTION 'Reservas desativadas.'; END IF;
  IF p_pessoas < v_grupo_min OR p_pessoas > v_grupo_max THEN
    RAISE EXCEPTION 'Grupo fora do tamanho permitido (% a % pessoas).', v_grupo_min, v_grupo_max;
  END IF;

  SELECT assentos INTO v_capacidade FROM public.config_reservas_slot
   WHERE empresa_id = v_emp AND dia_semana = v_dow AND hora = p_hora;
  IF v_capacidade IS NULL OR v_capacidade = 0 THEN
    RAISE EXCEPTION 'Horário indisponível.';
  END IF;

  SELECT COALESCE(SUM(pessoas), 0) INTO v_reservado
    FROM public.reservas
   WHERE empresa_id = v_emp AND data = p_data AND hora = p_hora
     AND status IN ('confirmada','pendente_pagamento','em_atendimento');
  IF v_reservado + p_pessoas > v_capacidade THEN
    RAISE EXCEPTION 'Sem vagas suficientes neste horário.';
  END IF;

  v_status := CASE WHEN v_sinal_ativo AND v_sinal_pp > 0
                THEN 'pendente_pagamento'::public.reserva_status
                ELSE 'confirmada'::public.reserva_status END;

  INSERT INTO public.reservas (
    empresa_id, user_id, nome, telefone, data, hora, pessoas,
    observacoes, status, sinal_valor
  ) VALUES (
    v_emp, v_user, p_nome, p_telefone, p_data, p_hora, p_pessoas,
    COALESCE(p_observacoes,''), v_status,
    CASE WHEN v_sinal_ativo THEN v_sinal_pp * p_pessoas ELSE 0 END
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.criar_reserva(text, date, time, integer, text, text, text) TO authenticated;

-- Cancelar reserva (cliente ou staff)
CREATE OR REPLACE FUNCTION public.cancelar_reserva(p_reserva_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r RECORD; v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_r FROM public.reservas WHERE id = p_reserva_id;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada.'; END IF;
  IF v_r.user_id <> v_user AND NOT can_manage_empresa(v_r.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  IF v_r.status IN ('cancelada','concluida','no_show') THEN RETURN; END IF;
  UPDATE public.reservas SET status = 'cancelada' WHERE id = p_reserva_id;
END $$;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva(uuid) TO authenticated;

-- Recepcionista dá entrada em uma reserva (abre comanda na mesa escolhida)
CREATE OR REPLACE FUNCTION public.dar_entrada_reserva(
  p_reserva_id uuid,
  p_numero_mesa integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r RECORD; v_com uuid; v_ocupada boolean;
BEGIN
  SELECT * INTO v_r FROM public.reservas WHERE id = p_reserva_id;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada.'; END IF;
  IF NOT can_manage_empresa(v_r.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF v_r.status NOT IN ('confirmada','pendente_pagamento') THEN
    RAISE EXCEPTION 'Reserva não pode receber entrada (status atual: %).', v_r.status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.comanda_ativa
    WHERE empresa_id = v_r.empresa_id AND numero_mesa = p_numero_mesa
      AND status IN ('aberta','aguardando_fechamento')
  ) INTO v_ocupada;
  IF v_ocupada THEN RAISE EXCEPTION 'MESA_OCUPADA: mesa % já tem comanda viva.', p_numero_mesa; END IF;

  INSERT INTO public.comanda_ativa (
    empresa_id, numero_mesa, user_id, nome_cliente, status, reserva_id
  ) VALUES (
    v_r.empresa_id, p_numero_mesa, COALESCE(v_r.user_id, auth.uid()),
    v_r.nome, 'aberta', v_r.id
  ) RETURNING id INTO v_com;

  UPDATE public.reservas
     SET status = 'em_atendimento', numero_mesa = p_numero_mesa, comanda_id = v_com
   WHERE id = p_reserva_id;

  RETURN v_com;
END $$;
GRANT EXECUTE ON FUNCTION public.dar_entrada_reserva(uuid, integer) TO authenticated;

-- Adicionar walk-in à fila
CREATE OR REPLACE FUNCTION public.fila_adicionar(
  p_nome text,
  p_telefone text,
  p_pessoas integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp uuid := current_empresa_id(); v_pos int; v_id uuid;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Empresa não definida.'; END IF;
  IF NOT can_manage_empresa(v_emp) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;

  SELECT COALESCE(MAX(posicao), 0) + 1 INTO v_pos
    FROM public.fila_espera
   WHERE empresa_id = v_emp AND status = 'aguardando';

  INSERT INTO public.fila_espera (empresa_id, nome, telefone, pessoas, posicao)
  VALUES (v_emp, p_nome, p_telefone, p_pessoas, v_pos)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.fila_adicionar(text, text, integer) TO authenticated;

-- Avisar (mesa liberou) — só marca; envio WhatsApp/push é responsabilidade do front
CREATE OR REPLACE FUNCTION public.fila_avisar(p_fila_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r RECORD;
BEGIN
  SELECT * INTO v_r FROM public.fila_espera WHERE id = p_fila_id;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT can_manage_empresa(v_r.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  UPDATE public.fila_espera SET status = 'avisado', avisado_em = now() WHERE id = p_fila_id;
END $$;
GRANT EXECUTE ON FUNCTION public.fila_avisar(uuid) TO authenticated;

-- Sentar (abrir comanda para um walk-in)
CREATE OR REPLACE FUNCTION public.fila_sentar(
  p_fila_id uuid,
  p_numero_mesa integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r RECORD; v_com uuid; v_ocupada boolean;
BEGIN
  SELECT * INTO v_r FROM public.fila_espera WHERE id = p_fila_id;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT can_manage_empresa(v_r.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.comanda_ativa
    WHERE empresa_id = v_r.empresa_id AND numero_mesa = p_numero_mesa
      AND status IN ('aberta','aguardando_fechamento')
  ) INTO v_ocupada;
  IF v_ocupada THEN RAISE EXCEPTION 'MESA_OCUPADA: mesa % já tem comanda viva.', p_numero_mesa; END IF;

  INSERT INTO public.comanda_ativa (
    empresa_id, numero_mesa, user_id, nome_cliente, status, fila_id
  ) VALUES (
    v_r.empresa_id, p_numero_mesa, auth.uid(), v_r.nome, 'aberta', v_r.id
  ) RETURNING id INTO v_com;

  UPDATE public.fila_espera
     SET status = 'sentado', sentado_em = now(), numero_mesa = p_numero_mesa, comanda_id = v_com
   WHERE id = p_fila_id;
  RETURN v_com;
END $$;
GRANT EXECUTE ON FUNCTION public.fila_sentar(uuid, integer) TO authenticated;

-- Desistir da fila
CREATE OR REPLACE FUNCTION public.fila_desistir(p_fila_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r RECORD;
BEGIN
  SELECT * INTO v_r FROM public.fila_espera WHERE id = p_fila_id;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT can_manage_empresa(v_r.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  UPDATE public.fila_espera SET status = 'desistiu' WHERE id = p_fila_id;
END $$;
GRANT EXECUTE ON FUNCTION public.fila_desistir(uuid) TO authenticated;

-- Atualizar enviar_pedido_mesa para respeitar o interruptor
CREATE OR REPLACE FUNCTION public.enviar_pedido_mesa(
  p_items jsonb, p_host text, p_comanda_id uuid, p_notes text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_com RECORD;
  v_permitido boolean;
  v_order uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;

  SELECT * INTO v_com FROM public.comanda_ativa WHERE id = p_comanda_id;
  IF v_com.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_com.user_id <> v_user THEN RAISE EXCEPTION 'Comanda de outro cliente.'; END IF;
  IF v_com.status <> 'aberta' THEN RAISE EXCEPTION 'Comanda não está aberta.'; END IF;

  SELECT pedido_na_mesa_pelo_cliente INTO v_permitido
    FROM public.empresas WHERE id = v_com.empresa_id;
  IF NOT COALESCE(v_permitido, true) THEN
    RAISE EXCEPTION 'PEDIDO_MESA_DESABILITADO: chame o garçom para fazer o pedido.';
  END IF;

  v_order := public.create_order(
    p_items, '', v_com.nome_cliente, COALESCE(p_notes, ''),
    'Presencial', v_com.numero_mesa, 0, p_host, false
  );
  UPDATE public.orders SET comanda_id = p_comanda_id WHERE id = v_order;
  RETURN v_order;
END $$;
GRANT EXECUTE ON FUNCTION public.enviar_pedido_mesa(jsonb, text, uuid, text) TO authenticated;

-- Realtime nas novas tabelas (mesas/reservas/fila mudam ao vivo no Caixa)
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fila_espera;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas_fisicas;
