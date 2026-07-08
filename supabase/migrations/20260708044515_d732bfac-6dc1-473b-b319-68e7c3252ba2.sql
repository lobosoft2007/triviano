
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  -- Resolve a empresa vinda do host (metadata do signup); só aceita se existir
  -- e estiver ativa. Caso contrário, recai na empresa padrão.
  v_empresa := NULLIF(NEW.raw_user_meta_data ->> 'empresa_id', '')::uuid;
  IF v_empresa IS NULL OR NOT public.is_empresa_ativa(v_empresa) THEN
    v_empresa := '00000000-0000-0000-0000-000000000023';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, phone, address, empresa_id,
    tipo_logradouro, logradouro, numero, complemento, bairro, municipio, estado, cep, ddd, telefone,
    latitude, longitude
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'address', ''),
    v_empresa,
    COALESCE(NEW.raw_user_meta_data ->> 'tipo_logradouro', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'logradouro', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'numero', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'complemento', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'bairro', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'municipio', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'estado', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'cep', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'ddd', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'telefone', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'latitude','')::numeric,
    NULLIF(NEW.raw_user_meta_data ->> 'longitude','')::numeric
  );
  RETURN NEW;
END;
$function$;
