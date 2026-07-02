ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_cliente_bloqueado(p_user_id uuid, p_bloqueado boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.profiles
    SET bloqueado = COALESCE(p_bloqueado, false)
    WHERE id = p_user_id;
END;
$function$;