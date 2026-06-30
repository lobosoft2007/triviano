-- 1A) push_token on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;

-- 1C) notifications table
CREATE TABLE public.notificacoes_cliente (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_pedido uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_cliente TO authenticated;
GRANT ALL ON public.notificacoes_cliente TO service_role;

ALTER TABLE public.notificacoes_cliente ENABLE ROW LEVEL SECURITY;

-- Clients read only their own notifications
CREATE POLICY "Clients read own notifications"
ON public.notificacoes_cliente FOR SELECT TO authenticated
USING (id_usuario = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Clients can mark their own notifications as read
CREATE POLICY "Clients update own notifications"
ON public.notificacoes_cliente FOR UPDATE TO authenticated
USING (id_usuario = auth.uid())
WITH CHECK (id_usuario = auth.uid());

-- Only admins (operators) create notifications
CREATE POLICY "Admins create notifications"
ON public.notificacoes_cliente FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete notifications
CREATE POLICY "Admins delete notifications"
ON public.notificacoes_cliente FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- helpful index
CREATE INDEX idx_notificacoes_cliente_usuario ON public.notificacoes_cliente (id_usuario, created_at DESC);

-- Realtime
ALTER TABLE public.notificacoes_cliente REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_cliente;