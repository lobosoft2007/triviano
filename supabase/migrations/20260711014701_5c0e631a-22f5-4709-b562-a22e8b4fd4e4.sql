ALTER TABLE public.config_pagamentos
  ADD COLUMN IF NOT EXISTS mp_public_key_prod text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_access_token_prod text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_public_key_test text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_access_token_test text NOT NULL DEFAULT '';

-- Backfill: envia as chaves existentes para o conjunto do ambiente atual.
UPDATE public.config_pagamentos
  SET mp_public_key_prod = mp_public_key,
      mp_access_token_prod = mp_access_token
  WHERE mp_ambiente = 'prod'
    AND (mp_public_key <> '' OR mp_access_token <> '');

UPDATE public.config_pagamentos
  SET mp_public_key_test = mp_public_key,
      mp_access_token_test = mp_access_token
  WHERE mp_ambiente <> 'prod'
    AND (mp_public_key <> '' OR mp_access_token <> '');