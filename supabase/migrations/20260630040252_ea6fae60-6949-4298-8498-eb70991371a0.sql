-- Permite que qualquer visitante (anon) e usuários autenticados leiam as
-- imagens do cardápio. Escrita continua admin-only (políticas inalteradas).
DROP POLICY IF EXISTS "Authenticated can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
CREATE POLICY "Anyone can view menu images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'imagens-cardapio');