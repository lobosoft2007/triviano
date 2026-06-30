-- ============================================================
-- ALERTA 1: Tabela orders — DELETE explícito + blindagem Realtime
-- ============================================================
-- Política de DELETE: apenas admins autenticados podem remover pedidos.
-- (Adaptado ao modelo seguro deste projeto: papéis ficam em user_roles,
--  verificados pela função has_role — NUNCA em colunas da própria tabela.)
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Garante RLS ativo e segurança de transmissão por linha no canal Realtime.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- ============================================================
-- ALERTA 3: ingredientes_produto — leitura pública filtrada por RLS
-- ============================================================
-- Remove a leitura aberta antiga.
DROP POLICY IF EXISTS "Anyone can view ingredientes_produto" ON public.ingredientes_produto;

-- Público (anon + autenticados comuns): só enxergam ingredientes removíveis.
DROP POLICY IF EXISTS "Public can view removable ingredientes" ON public.ingredientes_produto;
CREATE POLICY "Public can view removable ingredientes"
  ON public.ingredientes_produto
  FOR SELECT
  TO anon, authenticated
  USING (permitir_exclusao = true);

-- Admin: acesso irrestrito a 100% das fichas técnicas (painel /admin).
DROP POLICY IF EXISTS "Admins can view all ingredientes" ON public.ingredientes_produto;
CREATE POLICY "Admins can view all ingredientes"
  ON public.ingredientes_produto
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- ALERTA 4: Funções SECURITY DEFINER — revogar execução de anon/public
-- ============================================================
-- has_role precisa permanecer SECURITY DEFINER (é o núcleo das políticas RLS),
-- mas só deve ser disparável internamente / por usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- get_active_pix_config: leitura do recebedor PIX só no checkout autenticado.
REVOKE EXECUTE ON FUNCTION public.get_active_pix_config() FROM PUBLIC, anon;

-- Funções de gatilho (signup / updated_at): executam apenas via triggers do
-- sistema; nenhum perfil de API pode dispará-las diretamente.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;