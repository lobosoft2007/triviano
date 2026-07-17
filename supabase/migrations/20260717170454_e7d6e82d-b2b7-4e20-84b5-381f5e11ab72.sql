-- Atualiza admin_list_empresas para retornar o modelo de IA configurado
DROP FUNCTION IF EXISTS public.admin_list_empresas();

CREATE OR REPLACE FUNCTION public.admin_list_empresas()
RETURNS TABLE(
  id uuid, nome_fantasia text, logotipo_url text, taxa_servico_mesa numeric,
  dominio_customizado text, cnpj text, inscricao_estadual text, regime_tributario text,
  cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, estado text, ativo boolean,
  cor_primaria text, cor_secundaria text, modo_fundo text,
  percentual_cashback numeric, cashback_ativo boolean, ai_report_model text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.nome_fantasia, e.logotipo_url, e.taxa_servico_mesa,
           e.dominio_customizado, e.cnpj, e.inscricao_estadual, e.regime_tributario,
           e.cep, e.logradouro, e.numero, e.complemento,
           e.bairro, e.cidade, e.estado, e.ativo,
           e.cor_primaria, e.cor_secundaria, e.modo_fundo,
           e.percentual_cashback, e.cashback_ativo, e.ai_report_model, e.created_at
    FROM public.empresas e
    ORDER BY e.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_empresas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_empresas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_empresas() TO service_role;