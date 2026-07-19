CREATE OR REPLACE FUNCTION public.pos_pair_device(p_code text, p_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $function$
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

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.pos_devices (empresa_id, nome, flavor, token_hash, device_fingerprint, last_seen_at)
  VALUES (v_row.empresa_id, v_row.nome, v_row.flavor,
          extensions.crypt(v_token, extensions.gen_salt('bf')), p_fingerprint, now())
  RETURNING id INTO v_device_id;

  UPDATE public.pos_pair_codes SET usado_em = now() WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'device_id', v_device_id,
    'empresa_id', v_row.empresa_id,
    'flavor', v_row.flavor,
    'token', v_token
  );
END;
$function$;

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
  SELECT * INTO v_dev FROM public.pos_devices WHERE id = p_device;
  IF NOT FOUND OR v_dev.revogado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Device inválido';
  END IF;
  IF v_dev.token_hash <> extensions.crypt(p_token, v_dev.token_hash) THEN
    RAISE EXCEPTION 'Token inválido';
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

  UPDATE public.pos_devices SET last_seen_at = now() WHERE id = p_device;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'full_name', v_full,
    'empresa_id', v_dev.empresa_id,
    'flavor', v_dev.flavor
  );
END;
$function$;