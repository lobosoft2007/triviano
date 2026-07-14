
CREATE OR REPLACE FUNCTION public.liberar_mesa(
  p_solicitacao_id uuid,
  p_forcar boolean DEFAULT false
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol RECORD;
  v_comanda uuid;
  v_zumbi RECORD;
  v_ocupada RECORD;
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

  -- 1) Check-in duplo do MESMO cliente: reaproveita a comanda dele intacta.
  SELECT id INTO v_comanda FROM public.comanda_ativa
    WHERE empresa_id = v_sol.empresa_id
      AND numero_mesa = v_sol.numero_mesa
      AND user_id = v_sol.user_id
      AND status IN ('aberta', 'aguardando_fechamento')
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_comanda IS NOT NULL THEN
    UPDATE public.solicitacoes_mesa
      SET status = 'liberada', liberada_por = auth.uid(), liberada_em = now()
      WHERE id = p_solicitacao_id;
    RETURN v_comanda;
  END IF;

  -- 2) Existe comanda viva de OUTRO cliente? Exige confirmação.
  IF NOT p_forcar THEN
    SELECT id, nome_cliente, total_parcial
      INTO v_ocupada
      FROM public.comanda_ativa
      WHERE empresa_id = v_sol.empresa_id
        AND numero_mesa = v_sol.numero_mesa
        AND status IN ('aberta', 'aguardando_fechamento')
      LIMIT 1;

    IF v_ocupada.id IS NOT NULL THEN
      RAISE EXCEPTION 'MESA_OCUPADA: mesa % em uso por % (R$ %). Confirme para zerar.',
        v_sol.numero_mesa,
        COALESCE(NULLIF(v_ocupada.nome_cliente, ''), 'cliente'),
        to_char(COALESCE(v_ocupada.total_parcial, 0), 'FM999999990.00');
    END IF;
  END IF;

  -- 3) Segue com o fluxo padrão (mesa vazia OU forçado): incinera e cria nova.
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
