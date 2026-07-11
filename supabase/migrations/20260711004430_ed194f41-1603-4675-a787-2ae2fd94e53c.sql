-- Semeia uma config de pagamento ativa para o tenant de STAGING (Pizzaria Teste,
-- empresa ...099), copiando as credenciais do Mercado Pago e os panoramas de
-- flexibilidade da config ativa de produção (Clube 23, empresa ...023).
-- Isso permite testar PIX/Cartão online no Preview, que isola a vitrine no
-- tenant sandbox. Não toca em nada da produção.
INSERT INTO public.config_pagamentos (
  empresa_id, gateway_banco, client_id, client_secret,
  chave_pix_padrao, nome_recebedor, cidade_recebedor, ativo,
  mp_access_token, mp_public_key, mp_webhook_secret, mp_ativo, mp_ambiente,
  aceita_pix_online, aceita_cartao_online, aceita_na_entrega
)
SELECT
  '00000000-0000-0000-0000-000000000099'::uuid,
  src.gateway_banco, src.client_id, src.client_secret,
  src.chave_pix_padrao, src.nome_recebedor, src.cidade_recebedor, true,
  src.mp_access_token, src.mp_public_key, src.mp_webhook_secret, src.mp_ativo, src.mp_ambiente,
  src.aceita_pix_online, src.aceita_cartao_online, src.aceita_na_entrega
FROM public.config_pagamentos src
WHERE src.empresa_id = '00000000-0000-0000-0000-000000000023'::uuid
  AND src.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.config_pagamentos x
    WHERE x.empresa_id = '00000000-0000-0000-0000-000000000099'::uuid
  )
LIMIT 1;

-- Garante uma única config ativa por empresa de testes.
UPDATE public.config_pagamentos
SET ativo = false
WHERE empresa_id = '00000000-0000-0000-0000-000000000099'::uuid
  AND ativo = true
  AND id <> (
    SELECT id FROM public.config_pagamentos
    WHERE empresa_id = '00000000-0000-0000-0000-000000000099'::uuid
    ORDER BY created_at DESC
    LIMIT 1
  );