-- Payment gateway / PIX configuration
CREATE TABLE public.config_pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_banco text NOT NULL DEFAULT '',
  client_id text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  chave_pix_padrao text NOT NULL DEFAULT '',
  nome_recebedor text NOT NULL DEFAULT '',
  cidade_recebedor text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_pagamentos TO authenticated;
GRANT ALL ON public.config_pagamentos TO service_role;

ALTER TABLE public.config_pagamentos ENABLE ROW LEVEL SECURITY;

-- Only admins can read/manage the full config (contains client_secret)
CREATE POLICY "Admins manage payment config"
  ON public.config_pagamentos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_config_pagamentos_updated_at
  BEFORE UPDATE ON public.config_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Safe accessor: exposes ONLY the public PIX fields of the active config
-- (never the client_secret) to any authenticated checkout client.
CREATE OR REPLACE FUNCTION public.get_active_pix_config()
RETURNS TABLE (
  chave_pix_padrao text,
  nome_recebedor text,
  cidade_recebedor text,
  gateway_banco text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT chave_pix_padrao, nome_recebedor, cidade_recebedor, gateway_banco
  FROM public.config_pagamentos
  WHERE ativo = true
  ORDER BY updated_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_active_pix_config() TO authenticated, anon;