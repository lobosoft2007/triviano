
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  -- Service role / admin / super_admin / master admin can change anything
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin')
             OR public.has_role(auth.uid(), 'super_admin')
             OR public.is_master_admin();

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin user editing their own profile: block sensitive columns
  IF NEW.nivel_id IS DISTINCT FROM OLD.nivel_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o nível de acesso do próprio perfil.';
  END IF;
  IF NEW.saldo_cashback IS DISTINCT FROM OLD.saldo_cashback THEN
    RAISE EXCEPTION 'Não é permitido alterar o saldo de cashback do próprio perfil.';
  END IF;
  IF NEW.saldo_devedor_fiado IS DISTINCT FROM OLD.saldo_devedor_fiado THEN
    RAISE EXCEPTION 'Não é permitido alterar o saldo devedor de fiado do próprio perfil.';
  END IF;
  IF NEW.limite_fiado IS DISTINCT FROM OLD.limite_fiado THEN
    RAISE EXCEPTION 'Não é permitido alterar o limite de fiado do próprio perfil.';
  END IF;
  IF NEW.fiado_autorizado IS DISTINCT FROM OLD.fiado_autorizado THEN
    RAISE EXCEPTION 'Não é permitido autorizar fiado no próprio perfil.';
  END IF;
  IF NEW.bloqueado IS DISTINCT FROM OLD.bloqueado THEN
    RAISE EXCEPTION 'Não é permitido alterar o status de bloqueio do próprio perfil.';
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'Não é permitido alterar a empresa do próprio perfil.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
