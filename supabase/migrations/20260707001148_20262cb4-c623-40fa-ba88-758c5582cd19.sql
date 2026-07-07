-- ============================================================
-- 1) SENHA SEQUENCIAL DIÁRIA (pedidos de Balcão / retirada)
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS senha text,
  ADD COLUMN IF NOT EXISTS senha_diaria integer;

CREATE TABLE IF NOT EXISTS public.contadores_senha (
  empresa_id uuid NOT NULL,
  dia date NOT NULL,
  contador integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, dia)
);

GRANT SELECT ON public.contadores_senha TO authenticated;
GRANT ALL ON public.contadores_senha TO service_role;

ALTER TABLE public.contadores_senha ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem contadores de senha" ON public.contadores_senha;
CREATE POLICY "Admins veem contadores de senha"
  ON public.contadores_senha FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.assign_order_senha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia date;
  v_n integer;
BEGIN
  IF NEW.tipo_atendimento = 'Presencial'
     AND NEW.numero_mesa IS NULL
     AND NEW.senha IS NULL THEN
    v_dia := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    INSERT INTO public.contadores_senha (empresa_id, dia, contador)
    VALUES (NEW.empresa_id, v_dia, 1)
    ON CONFLICT (empresa_id, dia)
    DO UPDATE SET contador = public.contadores_senha.contador + 1,
                  updated_at = now()
    RETURNING contador INTO v_n;
    NEW.senha_diaria := v_n;
    NEW.senha := to_char(v_dia, 'DD') || '-' || v_n::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_order_senha ON public.orders;
CREATE TRIGGER trg_assign_order_senha
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_senha();

-- ============================================================
-- 2) SWITCHES HÍBRIDOS: MONITOR (KDS) x IMPRESSÃO por setor
-- ============================================================
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS monitor_cozinha boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monitor_bar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monitor_pizzaria boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.admin_get_empresa_config();
CREATE OR REPLACE FUNCTION public.admin_get_empresa_config()
 RETURNS TABLE(id uuid, nome_fantasia text, logotipo_url text, taxa_servico_mesa numeric, dominio_customizado text, cep text, logradouro text, numero text, complemento text, bairro text, cidade text, estado text, ativo boolean, cor_primaria text, cor_secundaria text, modo_fundo text, percentual_cashback numeric, cashback_ativo boolean, monitor_cozinha boolean, monitor_bar boolean, monitor_pizzaria boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.nome_fantasia, e.logotipo_url, e.taxa_servico_mesa,
           e.dominio_customizado, e.cep, e.logradouro, e.numero, e.complemento,
           e.bairro, e.cidade, e.estado, e.ativo,
           e.cor_primaria, e.cor_secundaria, e.modo_fundo,
           e.percentual_cashback, e.cashback_ativo,
           e.monitor_cozinha, e.monitor_bar, e.monitor_pizzaria
    FROM public.empresas e
    WHERE e.ativo = true
    ORDER BY e.created_at ASC
    LIMIT 1;
END;
$function$;

-- ============================================================
-- 3) INFRAESTRUTURA: PAINEL DE CHAMADA (estilo aeroporto)
-- ============================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_pedido_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_pedido_check
  CHECK (status_pedido = ANY (ARRAY[
    'Recebido'::text, 'Em preparação'::text, 'Pronto'::text,
    'Aguardando entregador'::text, 'Em entrega'::text, 'Entregue'::text,
    'Encerrado e pago'::text, 'Cancelado'::text]));

CREATE OR REPLACE FUNCTION public.get_painel_retirada(_empresa_id uuid DEFAULT '00000000-0000-0000-0000-000000000023')
 RETURNS TABLE(senha text, senha_diaria integer, status_pedido text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.senha, o.senha_diaria, o.status_pedido, o.created_at
  FROM public.orders o
  WHERE o.empresa_id = _empresa_id
    AND o.senha IS NOT NULL
    AND o.status_pedido IN ('Em preparação', 'Pronto')
    AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY o.status_pedido DESC, o.senha_diaria ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_painel_retirada(uuid) TO anon, authenticated;