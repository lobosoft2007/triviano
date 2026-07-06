
-- 1) empresas: scope authenticated SELECT to the user's own company.
DROP POLICY IF EXISTS "Empresas ativas visiveis a autenticados" ON public.empresas;
CREATE POLICY "Empresas ativas visiveis a autenticados"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
);

-- 2) meios_pagamento: drop the open authenticated-read policy.
-- Admins keep read/write via the existing "Admins manage payment methods" (FOR ALL) policy.
DROP POLICY IF EXISTS "Anyone authenticated can read payment methods" ON public.meios_pagamento;
