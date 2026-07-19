
CREATE OR REPLACE FUNCTION public.pos_resolve_device(p_device uuid, p_token text)
RETURNS TABLE(device_id uuid, empresa_id uuid, flavor text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_dev public.pos_devices%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN RETURN; END IF;

  IF p_device IS NOT NULL THEN
    SELECT * INTO v_dev FROM public.pos_devices WHERE id = p_device;
    IF NOT FOUND OR v_dev.revogado_em IS NOT NULL THEN RETURN; END IF;
    IF v_dev.token_hash <> extensions.crypt(p_token, v_dev.token_hash) THEN RETURN; END IF;
  ELSE
    SELECT * INTO v_dev FROM public.pos_devices
     WHERE revogado_em IS NULL
       AND token_hash = extensions.crypt(p_token, token_hash)
     ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;
  END IF;

  UPDATE public.pos_devices SET last_seen_at = now() WHERE id = v_dev.id;
  RETURN QUERY SELECT v_dev.id, v_dev.empresa_id, v_dev.flavor;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pos_resolve_device(uuid, text) TO service_role;
