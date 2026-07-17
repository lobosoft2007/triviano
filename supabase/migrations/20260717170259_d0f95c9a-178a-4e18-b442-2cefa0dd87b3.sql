-- Adiciona coluna de modelo de IA para relatórios na empresa (default: GPT-5.5)
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS ai_report_model text DEFAULT 'openai/gpt-5.5';

-- Atualiza função admin_get_empresa_config para retornar o novo campo
DROP FUNCTION IF EXISTS public.admin_get_empresa_config();

CREATE OR REPLACE FUNCTION public.admin_get_empresa_config()
RETURNS TABLE(
  id uuid,
  nome_fantasia text,
  logotipo_url text,
  taxa_servico_mesa numeric,
  taxa_entrega_valor numeric,
  dominio_customizado text,
  cnpj text,
  inscricao_estadual text,
  regime_tributario text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  ativo boolean,
  cor_primaria text,
  cor_secundaria text,
  modo_fundo text,
  percentual_cashback numeric,
  cashback_ativo boolean,
  monitor_cozinha boolean,
  monitor_bar boolean,
  monitor_pizzaria boolean,
  ai_report_model text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
           e.ai_report_model
    FROM public.empresas e
    WHERE e.id = public.current_empresa_id()
    LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_empresa_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_empresa_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_empresa_config() TO service_role;