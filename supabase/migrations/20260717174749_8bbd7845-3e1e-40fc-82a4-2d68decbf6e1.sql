
-- 1) Fix apply_ifood_markup — drop + recreate to preserve default signature
DROP FUNCTION IF EXISTS public.apply_ifood_markup(uuid, boolean);
CREATE OR REPLACE FUNCTION public.apply_ifood_markup(p_empresa_id uuid, p_overwrite boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_markup numeric;
  v_count integer := 0;
BEGIN
  IF NOT public.can_manage_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar esta empresa';
  END IF;

  SELECT markup_ifood_percentual INTO v_markup FROM public.empresas WHERE id = p_empresa_id;
  IF v_markup IS NULL OR v_markup <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.products
     SET preco_ifood = ROUND(price * (1 + v_markup/100.0), 2)
   WHERE empresa_id = p_empresa_id
     AND price IS NOT NULL
     AND (p_overwrite OR preco_ifood IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.produtos_price_options po
     SET preco_ifood = ROUND(po.preco * (1 + v_markup/100.0), 2)
    FROM public.products p
   WHERE po.produto_id = p.id
     AND p.empresa_id = p_empresa_id
     AND (p_overwrite OR po.preco_ifood IS NULL);

  UPDATE public.produtos_addons a
     SET preco_ifood = ROUND(a.preco * (1 + v_markup/100.0), 2)
    FROM public.products p
   WHERE a.produto_id = p.id
     AND p.empresa_id = p_empresa_id
     AND (p_overwrite OR a.preco_ifood IS NULL);

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_ifood_markup(uuid, boolean) TO authenticated, service_role;

-- 2) BYOK AI columns
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS ai_report_provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS ai_report_api_key text;

ALTER TABLE public.empresas
  DROP CONSTRAINT IF EXISTS empresas_ai_report_provider_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_ai_report_provider_check
  CHECK (ai_report_provider IN ('lovable','openai','google'));

REVOKE SELECT (ai_report_api_key) ON public.empresas FROM anon, authenticated;

-- 3) admin_get_empresa_config (drop + recreate to change return signature)
DROP FUNCTION IF EXISTS public.admin_get_empresa_config();
CREATE OR REPLACE FUNCTION public.admin_get_empresa_config()
RETURNS TABLE(
  id uuid, nome_fantasia text, logotipo_url text, taxa_servico_mesa numeric, taxa_entrega_valor numeric,
  dominio_customizado text, cnpj text, inscricao_estadual text, regime_tributario text,
  cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, estado text, ativo boolean,
  cor_primaria text, cor_secundaria text, modo_fundo text,
  percentual_cashback numeric, cashback_ativo boolean,
  monitor_cozinha boolean, monitor_bar boolean, monitor_pizzaria boolean,
  ai_report_model text, markup_ifood_percentual numeric,
  ai_report_provider text, ai_report_has_key boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.nome_fantasia, e.logotipo_url, e.taxa_servico_mesa, e.taxa_entrega_valor,
           e.dominio_customizado, e.cnpj, e.inscricao_estadual, e.regime_tributario,
           e.cep, e.logradouro, e.numero, e.complemento,
           e.bairro, e.cidade, e.estado, e.ativo,
           e.cor_primaria, e.cor_secundaria, e.modo_fundo,
           e.percentual_cashback, e.cashback_ativo,
           e.monitor_cozinha, e.monitor_bar, e.monitor_pizzaria,
           e.ai_report_model, e.markup_ifood_percentual,
           COALESCE(e.ai_report_provider, 'lovable')::text AS ai_report_provider,
           (e.ai_report_api_key IS NOT NULL AND length(btrim(e.ai_report_api_key)) > 0) AS ai_report_has_key
      FROM public.empresas e
     WHERE e.id = public.current_empresa_id();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_get_empresa_config() TO authenticated, service_role;

-- 4) admin_update_ai_report_config
CREATE OR REPLACE FUNCTION public.admin_update_ai_report_config(
  p_provider text,
  p_model text,
  p_api_key text DEFAULT NULL,
  p_clear_key boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa uuid := public.current_empresa_id();
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada para o usuário.';
  END IF;
  IF p_provider NOT IN ('lovable','openai','google') THEN
    RAISE EXCEPTION 'Provedor inválido.';
  END IF;

  UPDATE public.empresas
     SET ai_report_provider = p_provider,
         ai_report_model = COALESCE(NULLIF(btrim(p_model), ''), ai_report_model),
         ai_report_api_key = CASE
           WHEN p_clear_key THEN NULL
           WHEN p_api_key IS NULL THEN ai_report_api_key
           WHEN length(btrim(p_api_key)) = 0 THEN ai_report_api_key
           ELSE btrim(p_api_key)
         END
   WHERE id = v_empresa;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_ai_report_config(text, text, text, boolean) TO authenticated, service_role;

-- 5) Server-side credential reader
CREATE OR REPLACE FUNCTION public.get_ai_report_credentials()
RETURNS TABLE(provider text, model text, api_key text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa uuid := public.current_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT COALESCE(e.ai_report_provider, 'lovable')::text,
           COALESCE(e.ai_report_model, 'openai/gpt-5.5')::text,
           e.ai_report_api_key
      FROM public.empresas e
     WHERE e.id = v_empresa;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ai_report_credentials() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_report_credentials() TO authenticated, service_role;
