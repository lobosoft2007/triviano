CREATE OR REPLACE FUNCTION public.pos_generate_pair_code(p_empresa uuid, p_nome text, p_flavor text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_code TEXT;
BEGIN
  IF NOT public.can_manage_empresa(p_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa';
  END IF;
  IF p_flavor NOT IN ('rede','pagseguro','infinitepay') THEN
    RAISE EXCEPTION 'Flavor inválido';
  END IF;

  v_code := lpad(((floor(random() * 900000) + 100000))::int::text, 6, '0');

  INSERT INTO public.pos_pair_codes (empresa_id, code, flavor, nome, criado_por)
  VALUES (p_empresa, v_code, p_flavor, p_nome, auth.uid());

  RETURN v_code;
END;
$function$;