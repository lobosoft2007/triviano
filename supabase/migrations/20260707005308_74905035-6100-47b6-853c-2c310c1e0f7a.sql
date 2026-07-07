-- =========================================================
-- Matriz de Permissões Dinâmicas (multi-tenant)
-- =========================================================

-- Helper: empresa da pessoa logada
CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 1) Níveis de acesso (até 10 por empresa)
CREATE TABLE public.niveis_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id(),
  nome_nivel text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.niveis_acesso TO authenticated;
GRANT ALL ON public.niveis_acesso TO service_role;
ALTER TABLE public.niveis_acesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage access levels of their company"
  ON public.niveis_acesso FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND empresa_id = public.current_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND empresa_id = public.current_empresa_id());

-- 2) Matriz de permissões (1 linha por nível)
CREATE TABLE public.permissoes_matriz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel_id uuid NOT NULL UNIQUE REFERENCES public.niveis_acesso(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  acesso_kds_cozinha boolean NOT NULL DEFAULT false,
  acesso_atendimento_balcao boolean NOT NULL DEFAULT false,
  acesso_mesas boolean NOT NULL DEFAULT false,
  acesso_delivery boolean NOT NULL DEFAULT false,
  acesso_entrada_estoque boolean NOT NULL DEFAULT false,
  acesso_sangria_suprimento boolean NOT NULL DEFAULT false,
  acesso_cadastro_produtos boolean NOT NULL DEFAULT false,
  acesso_financeiro boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_matriz TO authenticated;
GRANT ALL ON public.permissoes_matriz TO service_role;
ALTER TABLE public.permissoes_matriz ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage permission matrix of their company"
  ON public.permissoes_matriz FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND empresa_id = public.current_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND empresa_id = public.current_empresa_id());

-- 3) Vincula funcionário (profile) a um nível
ALTER TABLE public.profiles
  ADD COLUMN nivel_id uuid REFERENCES public.niveis_acesso(id) ON DELETE SET NULL;

-- Trigger: limite de 10 níveis por empresa
CREATE OR REPLACE FUNCTION public.enforce_niveis_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.niveis_acesso WHERE empresa_id = NEW.empresa_id) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 níveis de acesso por empresa atingido.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_niveis_limit
  BEFORE INSERT ON public.niveis_acesso
  FOR EACH ROW EXECUTE FUNCTION public.enforce_niveis_limit();

-- Trigger: cria automaticamente a linha da matriz ao criar um nível
CREATE OR REPLACE FUNCTION public.seed_permissoes_matriz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.permissoes_matriz (nivel_id, empresa_id)
  VALUES (NEW.id, NEW.empresa_id)
  ON CONFLICT (nivel_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_matriz
  AFTER INSERT ON public.niveis_acesso
  FOR EACH ROW EXECUTE FUNCTION public.seed_permissoes_matriz();

-- updated_at triggers
CREATE TRIGGER trg_niveis_updated BEFORE UPDATE ON public.niveis_acesso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_matriz_updated BEFORE UPDATE ON public.permissoes_matriz
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Permissões efetivas do usuário logado (admin bypassa tudo)
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (
  is_admin boolean,
  is_funcionario boolean,
  acesso_kds_cozinha boolean,
  acesso_atendimento_balcao boolean,
  acesso_mesas boolean,
  acesso_delivery boolean,
  acesso_entrada_estoque boolean,
  acesso_sangria_suprimento boolean,
  acesso_cadastro_produtos boolean,
  acesso_financeiro boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_nivel uuid;
BEGIN
  v_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  IF v_admin THEN
    RETURN QUERY SELECT true, false, true, true, true, true, true, true, true, true;
    RETURN;
  END IF;

  SELECT p.nivel_id INTO v_nivel FROM public.profiles p WHERE p.id = auth.uid();
  IF v_nivel IS NULL THEN
    RETURN QUERY SELECT false, false, false, false, false, false, false, false, false, false;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT false, true,
      m.acesso_kds_cozinha, m.acesso_atendimento_balcao, m.acesso_mesas, m.acesso_delivery,
      m.acesso_entrada_estoque, m.acesso_sangria_suprimento, m.acesso_cadastro_produtos, m.acesso_financeiro
    FROM public.permissoes_matriz m
    WHERE m.nivel_id = v_nivel;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, true, false, false, false, false, false, false, false, false;
  END IF;
END;
$$;

-- 5) Admin lista funcionários da sua empresa
CREATE OR REPLACE FUNCTION public.admin_list_funcionarios()
RETURNS TABLE (id uuid, full_name text, nivel_id uuid, nome_nivel text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.nivel_id, n.nome_nivel, p.created_at
    FROM public.profiles p
    JOIN public.niveis_acesso n ON n.id = p.nivel_id
    WHERE p.empresa_id = public.current_empresa_id()
    ORDER BY p.created_at DESC;
END;
$$;

-- 6) Admin atribui/atualiza o nível de um funcionário
CREATE OR REPLACE FUNCTION public.admin_set_funcionario_nivel(p_user_id uuid, p_nivel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_emp uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  v_emp := public.current_empresa_id();
  IF p_nivel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.niveis_acesso WHERE id = p_nivel_id AND empresa_id = v_emp
  ) THEN
    RAISE EXCEPTION 'Nível inválido para esta empresa.';
  END IF;
  UPDATE public.profiles
    SET nivel_id = p_nivel_id
    WHERE id = p_user_id AND empresa_id = v_emp;
END;
$$;