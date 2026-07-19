CREATE OR REPLACE FUNCTION public.pos_set_pin(p_user uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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
  UPDATE public.profiles
     SET pin_pos_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   WHERE id = p_user;
END;
$$;