DROP POLICY IF EXISTS "Horários visíveis publicamente" ON public.category_horarios;
CREATE POLICY "Horários visíveis publicamente"
ON public.category_horarios
FOR SELECT
TO anon, authenticated
USING (public.is_empresa_ativa(empresa_id));