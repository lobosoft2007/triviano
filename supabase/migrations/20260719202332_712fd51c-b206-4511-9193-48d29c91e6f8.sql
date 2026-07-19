
-- pos_app_branding: per-tenant Android app icon + label for Triviano Tap whitelabel builds.
CREATE TABLE public.pos_app_branding (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  app_label TEXT NOT NULL,
  icon_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pos_app_branding_label_len CHECK (char_length(app_label) BETWEEN 1 AND 30)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_app_branding TO authenticated;
GRANT ALL ON public.pos_app_branding TO service_role;

ALTER TABLE public.pos_app_branding ENABLE ROW LEVEL SECURITY;

-- Admin da empresa lê e escreve APENAS o registro da sua empresa ativa.
CREATE POLICY "pos_app_branding_admin_all"
  ON public.pos_app_branding
  FOR ALL
  TO authenticated
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- updated_at automático (reaproveita função existente).
CREATE TRIGGER trg_pos_app_branding_updated_at
  BEFORE UPDATE ON public.pos_app_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: devolve/serve o branding da empresa ATIVA para a UI do admin.
CREATE OR REPLACE FUNCTION public.admin_get_pos_branding()
RETURNS TABLE (
  empresa_id UUID,
  app_label TEXT,
  icon_path TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID := public.current_empresa_id();
BEGIN
  IF NOT public.can_manage_empresa(v_empresa) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT b.empresa_id, b.app_label, b.icon_path, b.updated_at
      FROM public.pos_app_branding b
     WHERE b.empresa_id = v_empresa;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_pos_branding() TO authenticated;

-- ===================== STORAGE POLICIES =====================
-- Bucket pos-app-icons: layout <empresa_id>/<arquivo>. Admin da empresa
-- lê/escreve apenas dentro da própria pasta. Service role (pipeline de build)
-- bypassa RLS naturalmente.
CREATE POLICY "pos_app_icons_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pos-app-icons'
    AND public.can_manage_empresa((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "pos_app_icons_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pos-app-icons'
    AND public.can_manage_empresa((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "pos_app_icons_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pos-app-icons'
    AND public.can_manage_empresa((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'pos-app-icons'
    AND public.can_manage_empresa((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "pos_app_icons_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pos-app-icons'
    AND public.can_manage_empresa((storage.foldername(name))[1]::uuid)
  );
