DROP POLICY IF EXISTS "Cliente cria a propria solicitacao" ON public.solicitacoes_mesa;

CREATE POLICY "Cliente cria a propria solicitacao"
ON public.solicitacoes_mesa
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND empresa_id = current_empresa_id()
);