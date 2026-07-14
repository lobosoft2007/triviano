
-- 0.a) Coluna de auditoria (idempotente)
ALTER TABLE public.comanda_ativa
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- 0.b) Limpeza única do legado
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY empresa_id, numero_mesa
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.comanda_ativa
  WHERE status IN ('aberta', 'aguardando_fechamento')
),
zumbis AS (SELECT id FROM ranked WHERE rn > 1)
UPDATE public.orders o
   SET status_pedido = 'Cancelado',
       comanda_id = NULL
 WHERE o.comanda_id IN (SELECT id FROM zumbis)
   AND o.status_pedido NOT IN ('Finalizado', 'Cancelado');

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY empresa_id, numero_mesa
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.comanda_ativa
  WHERE status IN ('aberta', 'aguardando_fechamento')
)
UPDATE public.comanda_ativa c
   SET status = 'cancelada',
       motivo_cancelamento = COALESCE(c.motivo_cancelamento, 'abandonada_turno_anterior'),
       updated_at = now()
  FROM ranked r
 WHERE c.id = r.id AND r.rn > 1;

-- 1) Índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS uq_comanda_ativa_mesa_viva
  ON public.comanda_ativa (empresa_id, numero_mesa)
  WHERE status IN ('aberta', 'aguardando_fechamento');

-- 2) Nova liberar_mesa com Protocolo de Incineração por MESA
CREATE OR REPLACE FUNCTION public.liberar_mesa(p_solicitacao_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol RECORD;
  v_comanda uuid;
  v_zumbi RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_mesa WHERE id = p_solicitacao_id;
  IF v_sol.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT public.can_manage_empresa(v_sol.empresa_id) THEN
    RAISE EXCEPTION 'Solicitação de outra empresa.';
  END IF;
  IF v_sol.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Solicitação não está mais aguardando.';
  END IF;

  UPDATE public.solicitacoes_mesa
    SET status = 'liberada', liberada_por = auth.uid(), liberada_em = now()
    WHERE id = p_solicitacao_id;

  FOR v_zumbi IN
    SELECT id FROM public.comanda_ativa
      WHERE empresa_id = v_sol.empresa_id
        AND numero_mesa = v_sol.numero_mesa
        AND status IN ('aberta', 'aguardando_fechamento')
  LOOP
    UPDATE public.orders
      SET status_pedido = 'Cancelado',
          comanda_id = NULL
      WHERE comanda_id = v_zumbi.id
        AND status_pedido NOT IN ('Finalizado', 'Cancelado');

    UPDATE public.comanda_ativa
      SET status = 'cancelada',
          motivo_cancelamento = COALESCE(motivo_cancelamento, 'abandonada_turno_anterior'),
          updated_at = now()
      WHERE id = v_zumbi.id;
  END LOOP;

  INSERT INTO public.comanda_ativa
    (empresa_id, numero_mesa, solicitacao_id, user_id, nome_cliente)
  VALUES
    (v_sol.empresa_id, v_sol.numero_mesa, v_sol.id, v_sol.user_id, v_sol.nome_cliente)
  RETURNING id INTO v_comanda;

  RETURN v_comanda;
END;
$function$;
