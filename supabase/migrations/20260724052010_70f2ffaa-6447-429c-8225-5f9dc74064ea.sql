
-- Injeta a chamada de persistir_estimativa_pedido logo antes do RETURN de create_order.
-- Best-effort: se der erro por alguma razao, nao bloqueia a criacao do pedido.
DO $mig$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc
    WHERE proname='create_order' AND pronamespace='public'::regnamespace;

  IF position('persistir_estimativa_pedido' in v_def) > 0 THEN
    RETURN; -- ja injetado
  END IF;

  v_new := replace(
    v_def,
    E'  RETURN v_order_id;',
    E'  BEGIN\n    PERFORM public.persistir_estimativa_pedido(v_order_id);\n  EXCEPTION WHEN OTHERS THEN\n    RAISE WARNING ''persistir_estimativa_pedido falhou: %'', SQLERRM;\n  END;\n\n  RETURN v_order_id;'
  );

  EXECUTE v_new;
END
$mig$;
