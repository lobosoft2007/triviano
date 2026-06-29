
CREATE POLICY "Authenticated can view menu images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'imagens-cardapio');

CREATE POLICY "Admins can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'imagens-cardapio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'imagens-cardapio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.has_role(auth.uid(), 'admin'));
