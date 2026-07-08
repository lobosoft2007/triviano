-- Mirror the column-level protection from the UPDATE path onto the INSERT path
-- for public.profiles, so new users cannot set sensitive financial/access
-- attributes at signup. Sensitive columns fall back to their safe server-side
-- defaults regardless of client-submitted values.

REVOKE INSERT ON public.profiles FROM authenticated;

GRANT INSERT (
  id,
  full_name,
  phone,
  telefone,
  ddd,
  address,
  cep,
  logradouro,
  tipo_logradouro,
  numero,
  complemento,
  bairro,
  municipio,
  estado,
  latitude,
  longitude,
  push_token
) ON public.profiles TO authenticated;