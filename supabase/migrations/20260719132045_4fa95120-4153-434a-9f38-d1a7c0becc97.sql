CREATE OR REPLACE FUNCTION public.pos_login_pin(p_device uuid, p_token text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_dev public.pos_devices%ROWTYPE;
  v_user_id UUID;
  v_full TEXT;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token obrigatório';
  END IF;

  IF p_device IS NOT NULL THEN
    SELECT * INTO v_dev
      FROM public.pos_devices
     WHERE id = p_device;

    IF NOT FOUND OR v_dev.revogado_em IS NOT NULL THEN
      RAISE EXCEPTION 'Device inválido';
    END IF;

    IF v_dev.token_hash <> extensions.crypt(p_token, v_dev.token_hash) THEN
      RAISE EXCEPTION 'Token inválido';
    END IF;
  ELSE
    SELECT * INTO v_dev
      FROM public.pos_devices
     WHERE revogado_em IS NULL
       AND token_hash = extensions.crypt(p_token, token_hash)
     ORDER BY created_at DESC
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Token inválido';
    END IF;
  END IF;

  SELECT p.id, p.full_name INTO v_user_id, v_full
    FROM public.profiles p
   WHERE p.empresa_id = v_dev.empresa_id
     AND p.pin_pos_hash IS NOT NULL
     AND p.pin_pos_hash = extensions.crypt(p_pin, p.pin_pos_hash)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'PIN incorreto';
  END IF;

  UPDATE public.pos_devices SET last_seen_at = now() WHERE id = v_dev.id;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'full_name', v_full,
    'empresa_id', v_dev.empresa_id,
    'flavor', v_dev.flavor,
    'device_id', v_dev.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.pos_login_pin(UUID,TEXT,TEXT) TO anon, authenticated, service_role;