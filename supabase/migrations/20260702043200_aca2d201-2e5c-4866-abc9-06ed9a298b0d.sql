-- 1) Track whether an order already had its stock exploded (Kardex flag)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS estoque_baixado boolean NOT NULL DEFAULT false;

-- Existing paid/closed orders are considered already deducted
UPDATE public.orders SET estoque_baixado = true WHERE status_pedido = 'Encerrado e pago';

-- 2) Make stock explosion idempotent and set the flag
CREATE OR REPLACE FUNCTION public.explode_order_stock(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_ing RECORD;
  v_comp RECORD;
  v_rend numeric;
  v_done boolean;
BEGIN
  SELECT estoque_baixado INTO v_done FROM public.orders WHERE id = p_order_id;
  IF COALESCE(v_done, false) THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.manipulado
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    IF v_item.manipulado = false THEN
      UPDATE public.products
        SET saldo_estoque = saldo_estoque - v_item.quantity
        WHERE id = v_item.product_id;
    ELSE
      FOR v_ing IN
        SELECT insumo_id, subproduto_id, quantidade
        FROM public.ingredientes_produto
        WHERE product_id = v_item.product_id
      LOOP
        IF v_ing.insumo_id IS NOT NULL THEN
          UPDATE public.insumos
            SET saldo_estoque = saldo_estoque - (v_ing.quantidade * v_item.quantity),
                updated_at = now()
            WHERE id = v_ing.insumo_id AND estocavel = true;
        ELSIF v_ing.subproduto_id IS NOT NULL THEN
          SELECT COALESCE(NULLIF(rendimento_porcoes, 0), 1) INTO v_rend
            FROM public.subprodutos WHERE id = v_ing.subproduto_id;
          IF v_rend IS NULL THEN v_rend := 1; END IF;
          FOR v_comp IN
            SELECT cs.insumo_id, cs.quantidade
            FROM public.composicao_subproduto cs
            WHERE cs.subproduto_id = v_ing.subproduto_id
          LOOP
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque
                    - (v_comp.quantidade / v_rend * v_ing.quantidade * v_item.quantity),
                  updated_at = now()
              WHERE id = v_comp.insumo_id AND estocavel = true;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.orders SET estoque_baixado = true WHERE id = p_order_id;
END;
$function$;

-- 3) Reverse stock (Kardex return) — only if the order was deducted
CREATE OR REPLACE FUNCTION public.reverse_order_stock(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_ing RECORD;
  v_comp RECORD;
  v_rend numeric;
  v_done boolean;
BEGIN
  SELECT estoque_baixado INTO v_done FROM public.orders WHERE id = p_order_id;
  IF NOT COALESCE(v_done, false) THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.manipulado
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    IF v_item.manipulado = false THEN
      UPDATE public.products
        SET saldo_estoque = saldo_estoque + v_item.quantity
        WHERE id = v_item.product_id;
    ELSE
      FOR v_ing IN
        SELECT insumo_id, subproduto_id, quantidade
        FROM public.ingredientes_produto
        WHERE product_id = v_item.product_id
      LOOP
        IF v_ing.insumo_id IS NOT NULL THEN
          UPDATE public.insumos
            SET saldo_estoque = saldo_estoque + (v_ing.quantidade * v_item.quantity),
                updated_at = now()
            WHERE id = v_ing.insumo_id AND estocavel = true;
        ELSIF v_ing.subproduto_id IS NOT NULL THEN
          SELECT COALESCE(NULLIF(rendimento_porcoes, 0), 1) INTO v_rend
            FROM public.subprodutos WHERE id = v_ing.subproduto_id;
          IF v_rend IS NULL THEN v_rend := 1; END IF;
          FOR v_comp IN
            SELECT cs.insumo_id, cs.quantidade
            FROM public.composicao_subproduto cs
            WHERE cs.subproduto_id = v_ing.subproduto_id
          LOOP
            UPDATE public.insumos
              SET saldo_estoque = saldo_estoque
                    + (v_comp.quantidade / v_rend * v_ing.quantidade * v_item.quantity),
                  updated_at = now()
              WHERE id = v_comp.insumo_id AND estocavel = true;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.orders SET estoque_baixado = false WHERE id = p_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reverse_order_stock(uuid) FROM PUBLIC, anon;

-- 4) Cancel order (admin only): reverse stock + set Cancelado
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  SELECT status_pedido INTO v_status FROM public.orders WHERE id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'Cancelado' THEN RETURN; END IF;

  PERFORM public.reverse_order_stock(p_order_id);

  UPDATE public.orders
    SET status_pedido = 'Cancelado', status = 'canceled'
    WHERE id = p_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;

-- 5) Admin edit of a customer profile (address/contact) — bypasses RLS safely
CREATE OR REPLACE FUNCTION public.admin_update_cliente(
  p_user_id uuid,
  p_full_name text,
  p_tipo_logradouro text,
  p_logradouro text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_municipio text,
  p_estado text,
  p_cep text,
  p_ddd text,
  p_telefone text,
  p_latitude numeric,
  p_longitude numeric
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
    tipo_logradouro = p_tipo_logradouro,
    logradouro = p_logradouro,
    numero = p_numero,
    complemento = p_complemento,
    bairro = p_bairro,
    municipio = p_municipio,
    estado = p_estado,
    cep = p_cep,
    ddd = p_ddd,
    telefone = p_telefone,
    latitude = p_latitude,
    longitude = p_longitude,
    address = NULLIF(trim(both ', ' FROM concat_ws(', ',
      NULLIF(trim(concat_ws(' ', NULLIF(p_tipo_logradouro, ''), NULLIF(p_logradouro, ''))), ''),
      NULLIF(p_numero, ''),
      NULLIF(p_bairro, ''),
      NULLIF(p_municipio, ''),
      NULLIF(p_estado, ''))), ''),
    phone = NULLIF(trim(concat_ws(' ', NULLIF(p_ddd, ''), NULLIF(p_telefone, ''))), ''),
    updated_at = now()
  WHERE id = p_user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_cliente(uuid,text,text,text,text,text,text,text,text,text,text,text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_cliente(uuid,text,text,text,text,text,text,text,text,text,text,text,numeric,numeric) TO authenticated;

-- 6) Multi-tenant fiado isolation table
CREATE TABLE IF NOT EXISTS public.clientes_fiado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  limite_credito numeric NOT NULL DEFAULT 0,
  autorizado_fiado boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_fiado TO authenticated;
GRANT ALL ON public.clientes_fiado TO service_role;

ALTER TABLE public.clientes_fiado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fiado credit"
  ON public.clientes_fiado FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own fiado credit"
  ON public.clientes_fiado FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_clientes_fiado_updated_at
  BEFORE UPDATE ON public.clientes_fiado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from existing profiles
INSERT INTO public.clientes_fiado (user_id, empresa_id, limite_credito, autorizado_fiado, ativo)
SELECT p.id,
       COALESCE(p.empresa_id, '00000000-0000-0000-0000-000000000023'),
       COALESCE(p.limite_fiado, 0),
       COALESCE(p.fiado_autorizado, false),
       true
FROM public.profiles p
WHERE p.fiado_autorizado = true
ON CONFLICT (user_id, empresa_id) DO NOTHING;

-- 7) set_fiado_config now also syncs the isolated clientes_fiado table
CREATE OR REPLACE FUNCTION public.set_fiado_config(p_user_id uuid, p_autorizado boolean, p_limite numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;
  UPDATE public.profiles
    SET fiado_autorizado = p_autorizado, limite_fiado = GREATEST(0, p_limite)
    WHERE id = p_user_id;

  SELECT empresa_id INTO v_empresa FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.clientes_fiado (user_id, empresa_id, limite_credito, autorizado_fiado, ativo)
  VALUES (p_user_id, COALESCE(v_empresa, '00000000-0000-0000-0000-000000000023'),
          GREATEST(0, p_limite), p_autorizado, true)
  ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET limite_credito = EXCLUDED.limite_credito,
        autorizado_fiado = EXCLUDED.autorizado_fiado,
        updated_at = now();
END;
$function$;