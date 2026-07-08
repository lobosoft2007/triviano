-- =====================================================================
-- FASE 1: Resolução de tenant por domínio/subdomínio (multi-tenant)
-- Aditivo e retrocompatível: quando nenhum domínio casa, cai na primeira
-- empresa ativa (comportamento single-tenant atual preservado).
-- =====================================================================

-- Normaliza host: minúsculas, sem porta, sem "www."
CREATE OR REPLACE FUNCTION public.normalize_host(p_host text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_host IS NULL OR btrim(p_host) = '' THEN NULL
    ELSE regexp_replace(lower(split_part(btrim(p_host), ':', 1)), '^www\.', '')
  END;
$$;

-- Resolve o empresa_id a partir do hostname acessado.
-- Ordem: (1) domínio próprio (dominio_customizado, com prefixos operacionais
-- adm./pdv./app. removidos)  (2) slug de subdomínio (empresas.subdominio),
-- suportando o padrão Triviano "<slug>-app/-adm/-pdv.triviano.com.br" e
-- "<slug>.qualquercoisa".  Retorna NULL se nada casar.
CREATE OR REPLACE FUNCTION public.resolve_empresa_id_by_host(p_host text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host text;
  v_apex text;
  v_first text;
  v_slug text;
  v_id uuid;
BEGIN
  v_host := public.normalize_host(p_host);
  IF v_host IS NULL THEN RETURN NULL; END IF;

  v_first := split_part(v_host, '.', 1);

  -- (1) DOMÍNIO PRÓPRIO ------------------------------------------------------
  -- Casa quando o dominio_customizado registrado é igual ao host OU é o "apex"
  -- do host depois de remover um prefixo operacional (adm./pdv./app.).
  v_apex := CASE
    WHEN v_first IN ('adm','pdv','app') AND position('.' in v_host) > 0
      THEN substring(v_host from position('.' in v_host) + 1)
    ELSE v_host
  END;

  SELECT e.id INTO v_id
  FROM public.empresas e
  WHERE e.ativo = true
    AND e.dominio_customizado IS NOT NULL
    AND lower(public.normalize_host(e.dominio_customizado)) IN (v_host, v_apex)
  ORDER BY e.created_at ASC
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- (2) SLUG DE SUBDOMÍNIO ---------------------------------------------------
  -- Extrai o slug do primeiro rótulo: "clube23-app" -> "clube23";
  -- "clube23" (subdomínio simples) -> "clube23".
  v_slug := regexp_replace(v_first, '-(app|adm|pdv)$', '');
  IF v_slug IS NOT NULL AND v_slug <> '' THEN
    SELECT e.id INTO v_id
    FROM public.empresas e
    WHERE e.ativo = true
      AND e.subdominio IS NOT NULL
      AND lower(e.subdominio) = v_slug
    ORDER BY e.created_at ASC
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_empresa_id_by_host(text) TO anon, authenticated, service_role;

-- Branding público resolvido por host (com fallback para a 1ª empresa ativa).
CREATE OR REPLACE FUNCTION public.get_public_branding_by_host(p_host text)
RETURNS TABLE(
  id uuid, nome_fantasia text, logotipo_url text, dominio_customizado text,
  subdominio text, ativo boolean, cor_primaria text, cor_secundaria text,
  modo_fundo text, created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := public.resolve_empresa_id_by_host(p_host);

  RETURN QUERY
  SELECT e.id, e.nome_fantasia, e.logotipo_url, e.dominio_customizado, e.subdominio,
         e.ativo, e.cor_primaria, e.cor_secundaria, e.modo_fundo, e.created_at
  FROM public.empresas e
  WHERE e.ativo = true
    AND (v_id IS NULL OR e.id = v_id)
  ORDER BY (e.id = v_id) DESC, e.created_at ASC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding_by_host(text) TO anon, authenticated, service_role;

-- Cardápio público escopado por host (com fallback para a 1ª empresa ativa).
CREATE OR REPLACE FUNCTION public.get_public_menu_by_host(p_host text)
RETURNS TABLE(
  id uuid, category_id uuid, name text, description text, price numeric,
  image_url text, available boolean, sort_order integer, free_addon_limit integer,
  eixo_variacao text, empresa_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := public.resolve_empresa_id_by_host(p_host);
  IF v_id IS NULL THEN
    SELECT e.id INTO v_id FROM public.empresas e
    WHERE e.ativo = true ORDER BY e.created_at ASC LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
         p.available, p.sort_order, p.free_addon_limit, p.eixo_variacao, p.empresa_id
  FROM public.products p
  WHERE p.available = true
    AND p.empresa_id = v_id
  ORDER BY p.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_menu_by_host(text) TO anon, authenticated, service_role;