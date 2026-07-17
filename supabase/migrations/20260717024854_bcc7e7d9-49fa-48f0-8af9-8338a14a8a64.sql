
-- =====================================================================
-- Fase 1 — Precificação por canal + iFood + Entrega Própria
-- =====================================================================

-- 1) Precificação por canal
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS markup_ifood_percentual numeric NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preco_ifood numeric;

ALTER TABLE public.produtos_price_options
  ADD COLUMN IF NOT EXISTS preco_ifood numeric;

ALTER TABLE public.produtos_addons
  ADD COLUMN IF NOT EXISTS preco_ifood numeric;

-- 2) Enum canal_venda
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_venda_enum') THEN
    CREATE TYPE public.canal_venda_enum AS ENUM ('PWA','CAIXA','MESA','IFOOD','TELEFONE');
  END IF;
END $$;

-- 3) Ajustes em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS canal_venda public.canal_venda_enum NOT NULL DEFAULT 'PWA',
  ADD COLUMN IF NOT EXISTS pedido_externo_id text,
  ADD COLUMN IF NOT EXISTS entregador_id uuid,
  ADD COLUMN IF NOT EXISTS entrega_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS orders_pedido_externo_uk
  ON public.orders(canal_venda, pedido_externo_id)
  WHERE pedido_externo_id IS NOT NULL;

-- 4) ifood_merchants
CREATE TABLE IF NOT EXISTS public.ifood_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  merchant_id text NOT NULL,
  nome text NOT NULL,
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  polling_enabled boolean NOT NULL DEFAULT false,
  status_loja text NOT NULL DEFAULT 'CLOSED',
  ultima_sincronizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, merchant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifood_merchants TO authenticated;
GRANT ALL ON public.ifood_merchants TO service_role;
ALTER TABLE public.ifood_merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY ifood_merchants_manage ON public.ifood_merchants FOR ALL
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 5) ifood_event_log
CREATE TABLE IF NOT EXISTS public.ifood_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  merchant_id text NOT NULL,
  event_id text,
  event_type text,
  order_id_ifood text,
  payload jsonb,
  processado_em timestamptz,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ifood_event_log_empresa_idx ON public.ifood_event_log(empresa_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifood_event_log TO authenticated;
GRANT ALL ON public.ifood_event_log TO service_role;
ALTER TABLE public.ifood_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ifood_event_log_manage ON public.ifood_event_log FOR ALL
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 6) ifood_produto_map
CREATE TABLE IF NOT EXISTS public.ifood_produto_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ifood_item_id text NOT NULL,
  ifood_category_id text,
  disponivel boolean NOT NULL DEFAULT true,
  ultimo_sync timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, product_id),
  UNIQUE (empresa_id, ifood_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifood_produto_map TO authenticated;
GRANT ALL ON public.ifood_produto_map TO service_role;
ALTER TABLE public.ifood_produto_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY ifood_produto_map_manage ON public.ifood_produto_map FOR ALL
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 7) entregadores
CREATE TABLE IF NOT EXISTS public.entregadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  telefone text,
  cpf text,
  placa_veiculo text,
  tipo_veiculo text,
  ativo boolean NOT NULL DEFAULT true,
  comissao_percentual numeric NOT NULL DEFAULT 0,
  comissao_fixa_por_entrega numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entregadores_empresa_ativo_idx ON public.entregadores(empresa_id, ativo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregadores TO authenticated;
GRANT ALL ON public.entregadores TO service_role;
ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregadores_manage ON public.entregadores FOR ALL
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
-- Próprio entregador poderá se ler pelo user_id (usado em fase 2 no PWA):
CREATE POLICY entregadores_self_select ON public.entregadores FOR SELECT
  USING (user_id = auth.uid());

-- 8) entregas
CREATE TABLE IF NOT EXISTS public.entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  entregador_id uuid REFERENCES public.entregadores(id) ON DELETE SET NULL,
  canal text NOT NULL DEFAULT 'PROPRIA', -- 'PROPRIA' | 'IFOOD'
  status text NOT NULL DEFAULT 'PENDENTE',
    -- PENDENTE | ATRIBUIDA | EM_ROTA | ENTREGUE | DEVOLVIDA
  saiu_para_entrega_em timestamptz,
  entregue_em timestamptz,
  taxa_entrega numeric NOT NULL DEFAULT 0,
  valor_comissao numeric NOT NULL DEFAULT 0,
  distancia_km numeric,
  coord_origem jsonb,
  coord_destino jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
CREATE INDEX IF NOT EXISTS entregas_empresa_status_idx ON public.entregas(empresa_id, status);
CREATE INDEX IF NOT EXISTS entregas_entregador_idx ON public.entregas(entregador_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas TO authenticated;
GRANT ALL ON public.entregas TO service_role;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregas_manage ON public.entregas FOR ALL
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));
-- Entregador vê apenas as próprias entregas (fase 2 PWA):
CREATE POLICY entregas_entregador_self ON public.entregas FOR SELECT
  USING (
    entregador_id IN (SELECT id FROM public.entregadores WHERE user_id = auth.uid())
  );

-- 9) entregador_sessoes (turnos)
CREATE TABLE IF NOT EXISTS public.entregador_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  total_entregas integer NOT NULL DEFAULT 0,
  total_comissao numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entregador_sessoes_entregador_idx ON public.entregador_sessoes(entregador_id, inicio DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregador_sessoes TO authenticated;
GRANT ALL ON public.entregador_sessoes TO service_role;
ALTER TABLE public.entregador_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregador_sessoes_manage ON public.entregador_sessoes FOR ALL
  USING (public.can_manage_empresa(empresa_id))
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- 10) FK de orders.entregador_id agora que a tabela existe
ALTER TABLE public.orders
  ADD CONSTRAINT orders_entregador_fk FOREIGN KEY (entregador_id)
    REFERENCES public.entregadores(id) ON DELETE SET NULL;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_entrega_fk FOREIGN KEY (entrega_id)
    REFERENCES public.entregas(id) ON DELETE SET NULL;

-- 11) Trigger de updated_at para as novas tabelas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace) THEN
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ifood_merchants','ifood_produto_map','entregadores','entregas','entregador_sessoes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- 12) Helper: markup em massa (aplica empresas.markup_ifood_percentual nos produtos sem preco_ifood)
CREATE OR REPLACE FUNCTION public.apply_ifood_markup(p_empresa_id uuid, p_overwrite boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     SET preco_ifood = ROUND(po.price * (1 + v_markup/100.0), 2)
    FROM public.products p
   WHERE po.product_id = p.id
     AND p.empresa_id = p_empresa_id
     AND (p_overwrite OR po.preco_ifood IS NULL);

  UPDATE public.produtos_addons a
     SET preco_ifood = ROUND(a.preco * (1 + v_markup/100.0), 2)
    FROM public.products p
   WHERE a.product_id = p.id
     AND p.empresa_id = p_empresa_id
     AND (p_overwrite OR a.preco_ifood IS NULL);

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_ifood_markup(uuid, boolean) TO authenticated;

COMMENT ON COLUMN public.products.preco_ifood IS 'Preço praticado no iFood. NULL = usa price interno.';
COMMENT ON COLUMN public.produtos_price_options.preco_ifood IS 'Preço iFood por variação. NULL = usa price interno.';
COMMENT ON COLUMN public.produtos_addons.preco_ifood IS 'Preço iFood do adicional. NULL = usa preco interno.';
COMMENT ON COLUMN public.orders.canal_venda IS 'Canal de origem do pedido (PWA/CAIXA/MESA/IFOOD/TELEFONE).';
COMMENT ON COLUMN public.orders.pedido_externo_id IS 'ID do pedido no sistema externo (ex.: iFood orderId).';
