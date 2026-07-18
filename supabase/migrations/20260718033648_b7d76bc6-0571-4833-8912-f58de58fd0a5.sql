
-- ============================================================
-- Fase 0 — Triviano Garçom POS
-- Fundação para app Android em maquininhas Smart POS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) PIN de operador para login rápido no POS ---------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_pos_hash TEXT;

-- 2) Códigos de pareamento (efêmeros, expiram em 15 min) ----
CREATE TABLE IF NOT EXISTS public.pos_pair_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  flavor TEXT NOT NULL CHECK (flavor IN ('rede','pagseguro','infinitepay')),
  nome TEXT NOT NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  usado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_pair_codes TO authenticated;
GRANT ALL ON public.pos_pair_codes TO service_role;
ALTER TABLE public.pos_pair_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_pair_codes tenant admin"
  ON public.pos_pair_codes FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 3) Devices pareados ---------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  flavor TEXT NOT NULL CHECK (flavor IN ('rede','pagseguro','infinitepay')),
  token_hash TEXT NOT NULL,
  device_fingerprint TEXT,
  last_seen_at TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_devices_empresa ON public.pos_devices(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_devices TO authenticated;
GRANT ALL ON public.pos_devices TO service_role;
ALTER TABLE public.pos_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_devices tenant admin"
  ON public.pos_devices FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

CREATE TRIGGER trg_pos_devices_updated_at
  BEFORE UPDATE ON public.pos_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPCs ---------------------------------------------------

-- 4.1) Master gera código de pareamento (aparelho + flavor)
CREATE OR REPLACE FUNCTION public.pos_generate_pair_code(
  p_empresa UUID,
  p_nome TEXT,
  p_flavor TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF NOT public.can_manage_empresa(p_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa';
  END IF;
  IF p_flavor NOT IN ('rede','pagseguro','infinitepay') THEN
    RAISE EXCEPTION 'Flavor inválido';
  END IF;

  -- Código de 8 dígitos alfanuméricos, fácil de digitar na maquininha
  v_code := upper(substr(encode(gen_random_bytes(6),'base64'),1,8));
  v_code := regexp_replace(v_code, '[^A-Z0-9]', 'X', 'g');

  INSERT INTO public.pos_pair_codes (empresa_id, code, flavor, nome, criado_por)
  VALUES (p_empresa, v_code, p_flavor, p_nome, auth.uid());

  RETURN v_code;
END;
$$;

-- 4.2) App troca código por token (chamado sem sessão de usuário)
CREATE OR REPLACE FUNCTION public.pos_pair_device(
  p_code TEXT,
  p_fingerprint TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.pos_pair_codes%ROWTYPE;
  v_token TEXT;
  v_device_id UUID;
BEGIN
  SELECT * INTO v_row FROM public.pos_pair_codes
    WHERE code = upper(p_code)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF v_row.usado_em IS NOT NULL THEN RAISE EXCEPTION 'Código já utilizado'; END IF;
  IF v_row.expira_em < now() THEN RAISE EXCEPTION 'Código expirado'; END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.pos_devices (empresa_id, nome, flavor, token_hash, device_fingerprint, last_seen_at)
  VALUES (v_row.empresa_id, v_row.nome, v_row.flavor,
          crypt(v_token, gen_salt('bf')), p_fingerprint, now())
  RETURNING id INTO v_device_id;

  UPDATE public.pos_pair_codes SET usado_em = now() WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'device_id', v_device_id,
    'empresa_id', v_row.empresa_id,
    'flavor', v_row.flavor,
    'token', v_token
  );
END;
$$;

-- 4.3) Revogar device
CREATE OR REPLACE FUNCTION public.pos_revoke_device(p_device UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_empresa UUID;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.pos_devices WHERE id = p_device;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Device não encontrado'; END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.pos_devices SET revogado_em = now() WHERE id = p_device;
END;
$$;

-- 4.4) Master define/reseta PIN de um funcionário
CREATE OR REPLACE FUNCTION public.pos_set_pin(p_user UUID, p_pin TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
  v_nivel UUID;
BEGIN
  SELECT empresa_id, nivel_id INTO v_empresa, v_nivel
    FROM public.profiles WHERE id = p_user;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_nivel IS NULL THEN
    RAISE EXCEPTION 'PIN só pode ser definido para funcionários (com nível de acesso)';
  END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 4 e 8 dígitos numéricos';
  END IF;
  UPDATE public.profiles SET pin_pos_hash = crypt(p_pin, gen_salt('bf')) WHERE id = p_user;
END;
$$;

-- 4.5) App valida PIN no contexto do device pareado
CREATE OR REPLACE FUNCTION public.pos_login_pin(
  p_device UUID,
  p_token TEXT,
  p_pin TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dev public.pos_devices%ROWTYPE;
  v_user_id UUID;
  v_full TEXT;
BEGIN
  SELECT * INTO v_dev FROM public.pos_devices WHERE id = p_device;
  IF NOT FOUND OR v_dev.revogado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Device inválido';
  END IF;
  IF v_dev.token_hash <> crypt(p_token, v_dev.token_hash) THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  SELECT p.id, p.full_name INTO v_user_id, v_full
    FROM public.profiles p
   WHERE p.empresa_id = v_dev.empresa_id
     AND p.pin_pos_hash IS NOT NULL
     AND p.pin_pos_hash = crypt(p_pin, p.pin_pos_hash)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'PIN incorreto';
  END IF;

  UPDATE public.pos_devices SET last_seen_at = now() WHERE id = p_device;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'full_name', v_full,
    'empresa_id', v_dev.empresa_id,
    'flavor', v_dev.flavor
  );
END;
$$;

-- Permissões de execução
REVOKE ALL ON FUNCTION public.pos_generate_pair_code(UUID,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pos_revoke_device(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pos_set_pin(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_generate_pair_code(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_revoke_device(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_set_pin(UUID,TEXT) TO authenticated;

-- pos_pair_device e pos_login_pin são chamadas pelo APP (sem sessão Supabase),
-- então precisam ficar acessíveis para anon também. A segurança vive na própria
-- função (código de uso único, token com bcrypt, PIN com bcrypt).
GRANT EXECUTE ON FUNCTION public.pos_pair_device(TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_login_pin(UUID,TEXT,TEXT) TO anon, authenticated;
