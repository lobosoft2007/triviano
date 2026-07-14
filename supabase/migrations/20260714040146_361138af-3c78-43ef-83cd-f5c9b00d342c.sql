-- Column-level privilege hardening on public.profiles.
-- SECURITY DEFINER functions (owned by the table owner) bypass column privileges,
-- so admin RPCs and financial triggers keep working. Direct updates by the
-- `authenticated` role can only touch non-sensitive personal columns.

REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  address,
  bairro,
  cep,
  complemento,
  ddd,
  estado,
  full_name,
  latitude,
  logradouro,
  longitude,
  municipio,
  numero,
  phone,
  push_token,
  telefone,
  tipo_logradouro,
  updated_at
) ON public.profiles TO authenticated;