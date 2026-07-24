
-- =========================================================================
-- 1. LINHAS DE PRODUCAO (recursos paralelos: Pizza, Burger, Açaí, etc.)
-- =========================================================================
CREATE TABLE public.linhas_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_linhas_producao_empresa ON public.linhas_producao(empresa_id);

GRANT SELECT ON public.linhas_producao TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linhas_producao TO authenticated;
GRANT ALL ON public.linhas_producao TO service_role;

ALTER TABLE public.linhas_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view linhas de producao" ON public.linhas_producao
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage linhas de producao" ON public.linhas_producao
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));

CREATE TRIGGER trg_linhas_producao_updated
  BEFORE UPDATE ON public.linhas_producao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2. CATEGORIA_ETAPAS_PREPARO (etapas sequenciais por categoria)
-- =========================================================================
CREATE TABLE public.categoria_etapas_preparo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  nome text NOT NULL,
  duracao_min integer NOT NULL DEFAULT 0 CHECK (duracao_min >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cat_etapas_categoria ON public.categoria_etapas_preparo(categoria_id);

GRANT SELECT ON public.categoria_etapas_preparo TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categoria_etapas_preparo TO authenticated;
GRANT ALL ON public.categoria_etapas_preparo TO service_role;

ALTER TABLE public.categoria_etapas_preparo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view etapas de preparo" ON public.categoria_etapas_preparo
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage etapas de preparo" ON public.categoria_etapas_preparo
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.categories c
                 WHERE c.id = categoria_id AND can_manage_empresa(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.categories c
                      WHERE c.id = categoria_id AND can_manage_empresa(c.empresa_id)));

CREATE TRIGGER trg_cat_etapas_updated
  BEFORE UPDATE ON public.categoria_etapas_preparo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. Vinculo categoria -> linha de producao
-- =========================================================================
ALTER TABLE public.categories
  ADD COLUMN linha_producao_id uuid NULL REFERENCES public.linhas_producao(id) ON DELETE SET NULL;

-- =========================================================================
-- 4. ZONAS DE ENTREGA
-- =========================================================================
CREATE TABLE public.zonas_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tempo_entrega_min integer NOT NULL DEFAULT 0 CHECK (tempo_entrega_min >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zonas_entrega_empresa ON public.zonas_entrega(empresa_id);

GRANT SELECT ON public.zonas_entrega TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zonas_entrega TO authenticated;
GRANT ALL ON public.zonas_entrega TO service_role;

ALTER TABLE public.zonas_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view zonas de entrega" ON public.zonas_entrega
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage zonas de entrega" ON public.zonas_entrega
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));

CREATE TRIGGER trg_zonas_entrega_updated
  BEFORE UPDATE ON public.zonas_entrega
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 5. Empresas: tempo de entrega padrao (fallback)
-- =========================================================================
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tempo_entrega_padrao_min integer NOT NULL DEFAULT 20
    CHECK (tempo_entrega_padrao_min >= 0);

-- =========================================================================
-- 6. Orders: colunas de estimativa (nullable p/ pedidos antigos)
-- =========================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tempo_preparo_min integer NULL,
  ADD COLUMN IF NOT EXISTS tempo_entrega_min integer NULL,
  ADD COLUMN IF NOT EXISTS tempo_estimado_min integer NULL,
  ADD COLUMN IF NOT EXISTS hora_prevista_pronto timestamptz NULL,
  ADD COLUMN IF NOT EXISTS zona_entrega_id uuid NULL REFERENCES public.zonas_entrega(id) ON DELETE SET NULL;

-- =========================================================================
-- 7. RPC: calcular_estimativa_pedido
--    Pipeline por linha + MAX entre linhas + margem proporcional + entrega.
--    p_items: jsonb array de {product_id, quantity}
-- =========================================================================
CREATE OR REPLACE FUNCTION public.calcular_estimativa_pedido(
  p_items jsonb,
  p_empresa_id uuid DEFAULT NULL,
  p_zona_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preparo int := 0;
  v_margem int := 0;
  v_entrega int := 0;
  v_hora_agora timestamptz := now();
  v_empresa_id uuid := p_empresa_id;
BEGIN
  -- Descobre a empresa a partir do primeiro produto se nao veio como parametro
  IF v_empresa_id IS NULL THEN
    SELECT p.empresa_id INTO v_empresa_id
      FROM public.products p
      WHERE p.id = (p_items->0->>'product_id')::uuid
      LIMIT 1;
  END IF;

  -- Calcula T_linha para cada linha e pega o MAX.
  -- item1 (maior total) usa total; itens 2..N usam apenas o gargalo.
  WITH itens AS (
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      GREATEST(COALESCE((elem->>'quantity')::int, 1), 1) AS quantidade
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) elem
  ),
  itens_expandidos AS (
    -- Expande quantidade: 2 pizzas viram 2 linhas (competem pelo mesmo forno)
    SELECT i.product_id
      FROM itens i, LATERAL generate_series(1, i.quantidade)
  ),
  itens_categoria AS (
    SELECT
      ie.product_id,
      p.category_id,
      COALESCE(c.linha_producao_id, '00000000-0000-0000-0000-000000000000'::uuid) AS linha_id
    FROM itens_expandidos ie
    JOIN public.products p ON p.id = ie.product_id
    JOIN public.categories c ON c.id = p.category_id
  ),
  categoria_tempos AS (
    SELECT
      c.id AS category_id,
      COALESCE(SUM(e.duracao_min), 0)::int AS total_min,
      COALESCE(MAX(e.duracao_min), 0)::int AS gargalo_min
    FROM public.categories c
    LEFT JOIN public.categoria_etapas_preparo e ON e.categoria_id = c.id
    GROUP BY c.id
  ),
  itens_com_tempo AS (
    SELECT
      ic.linha_id,
      ct.total_min,
      ct.gargalo_min,
      ROW_NUMBER() OVER (PARTITION BY ic.linha_id ORDER BY ct.total_min DESC) AS rn
    FROM itens_categoria ic
    JOIN categoria_tempos ct ON ct.category_id = ic.category_id
  ),
  tempo_por_linha AS (
    SELECT
      linha_id,
      SUM(CASE WHEN rn = 1 THEN total_min ELSE gargalo_min END)::int AS t_linha
    FROM itens_com_tempo
    GROUP BY linha_id
  )
  SELECT COALESCE(MAX(t_linha), 0) INTO v_preparo FROM tempo_por_linha;

  -- Margem proporcional
  v_margem := CASE
    WHEN v_preparo <= 0 THEN 0
    WHEN v_preparo <= 20 THEN 3
    WHEN v_preparo <= 40 THEN 5
    ELSE 8
  END;

  -- Tempo de entrega: zona informada > padrao da empresa
  IF p_zona_id IS NOT NULL THEN
    SELECT tempo_entrega_min INTO v_entrega
      FROM public.zonas_entrega
      WHERE id = p_zona_id AND ativo = true;
  END IF;
  IF v_entrega IS NULL OR v_entrega = 0 THEN
    SELECT tempo_entrega_padrao_min INTO v_entrega
      FROM public.empresas WHERE id = v_empresa_id;
  END IF;
  v_entrega := COALESCE(v_entrega, 0);

  RETURN jsonb_build_object(
    'preparo_min', v_preparo,
    'margem_min', v_margem,
    'entrega_min', v_entrega,
    'total_cliente_min', v_preparo + v_margem + v_entrega,
    'faixa_min', v_preparo + v_entrega,
    'faixa_max', v_preparo + v_margem + v_entrega,
    'hora_prevista_pronto', v_hora_agora + make_interval(mins => (v_preparo + v_margem))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_estimativa_pedido(jsonb, uuid, uuid) TO anon, authenticated, service_role;

-- =========================================================================
-- 8. Persistencia automatica no create_order
--    Ao final do pedido, calcula a estimativa usando os order_items ja
--    inseridos e grava nas 4 colunas de tempo.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.persistir_estimativa_pedido(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_empresa_id uuid;
  v_zona_id uuid;
  v_tipo attendance_type;
  v_est jsonb;
  v_entrega int;
BEGIN
  SELECT o.empresa_id, o.zona_entrega_id, o.tipo_atendimento
    INTO v_empresa_id, v_zona_id, v_tipo
    FROM public.orders o WHERE o.id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', oi.product_id,
           'quantity', oi.quantity
         )), '[]'::jsonb)
    INTO v_items
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id;

  v_est := public.calcular_estimativa_pedido(v_items, v_empresa_id, v_zona_id);

  -- Pedidos que nao sao delivery zeram o tempo de entrega
  v_entrega := CASE
    WHEN v_tipo IN ('Presencial', 'Balcão') THEN 0
    ELSE COALESCE((v_est->>'entrega_min')::int, 0)
  END;

  UPDATE public.orders SET
    tempo_preparo_min = (v_est->>'preparo_min')::int,
    tempo_entrega_min = v_entrega,
    tempo_estimado_min = COALESCE((v_est->>'preparo_min')::int, 0)
                       + COALESCE((v_est->>'margem_min')::int, 0)
                       + v_entrega,
    hora_prevista_pronto = (v_est->>'hora_prevista_pronto')::timestamptz
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.persistir_estimativa_pedido(uuid) TO authenticated, service_role;
