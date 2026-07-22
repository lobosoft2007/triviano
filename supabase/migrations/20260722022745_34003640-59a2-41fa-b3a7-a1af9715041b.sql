DROP POLICY IF EXISTS "Clients read own notifications" ON public.notificacoes_cliente;
CREATE POLICY "Clients read own notifications"
  ON public.notificacoes_cliente
  FOR SELECT
  TO authenticated
  USING (id_usuario = auth.uid());