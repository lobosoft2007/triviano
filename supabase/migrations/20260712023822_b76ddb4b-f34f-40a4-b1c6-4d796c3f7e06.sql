CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only guard direct Data API updates from end users (role 'authenticated').
  -- SECURITY DEFINER functions (cashback, fiado, admin RPCs) run as their
  -- owner role and are intentionally allowed to touch these columns.
  IF current_user = 'authenticated' AND NOT public.can_manage_empresa(OLD.empresa_id) THEN
    NEW.nivel_id            := OLD.nivel_id;
    NEW.fiado_autorizado    := OLD.fiado_autorizado;
    NEW.limite_fiado        := OLD.limite_fiado;
    NEW.saldo_devedor_fiado := OLD.saldo_devedor_fiado;
    NEW.saldo_cashback      := OLD.saldo_cashback;
    NEW.bloqueado           := OLD.bloqueado;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_columns ON public.profiles;

CREATE TRIGGER trg_protect_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_columns();