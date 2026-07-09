-- 1) RPC pública de combos resolvida por host (espelha get_public_menu_by_host)
CREATE OR REPLACE FUNCTION public.get_public_combos_by_host(p_host text)
RETURNS TABLE(
  id uuid,
  nome_combo text,
  valor_desconto numeric,
  tipo_promocao text,
  quantidade_requerida integer,
  frase_promocional text,
  slug1 text,
  slug2 text,
  slug3 text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  v_id := public.resolve_empresa_id_by_host(p_host);
  IF v_id IS NULL THEN
    SELECT e.id INTO v_id FROM public.empresas e
    WHERE e.ativo = true ORDER BY e.created_at ASC LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT r.id, r.nome_combo, r.valor_desconto,
         r.tipo_promocao::text, r.quantidade_requerida, r.frase_promocional,
         c1.slug, c2.slug, c3.slug
  FROM public.regras_combos r
  LEFT JOIN public.categories c1 ON c1.id = r.id_categoria_1
  LEFT JOIN public.categories c2 ON c2.id = r.id_categoria_2
  LEFT JOIN public.categories c3 ON c3.id = r.id_categoria_3
  WHERE r.ativo = true
    AND r.empresa_id = v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_combos_by_host(text) TO anon, authenticated;

-- 2) Fecha o SELECT global de regras_combos (era "true" para todos os tenants)
DROP POLICY IF EXISTS "Combo rules are viewable by everyone" ON public.regras_combos;

CREATE POLICY "Admins view combo rules of their company"
  ON public.regras_combos
  FOR SELECT
  TO authenticated
  USING (public.can_manage_empresa(empresa_id));