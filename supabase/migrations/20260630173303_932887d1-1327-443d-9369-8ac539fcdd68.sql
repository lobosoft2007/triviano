ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_pedido_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_pedido_check
  CHECK (status_pedido = ANY (ARRAY[
    'Recebido'::text,
    'Em preparação'::text,
    'Aguardando entregador'::text,
    'Em entrega'::text,
    'Entregue'::text,
    'Encerrado e pago'::text,
    'Cancelado'::text
  ]));