## Problema

O RPC `pos_generate_pair_code` usa `gen_random_bytes(6)` (extensão `pgcrypto`), mas o `SET search_path TO 'public'` esconde a extensão (que fica em `extensions`), então o Postgres retorna `function gen_random_bytes(integer) does not exist` quando o admin clica em "Gerar código".

## Correção

Migração única que recria o RPC gerando o código sem depender de `pgcrypto` — usando `gen_random_uuid()` (nativo do Postgres 13+, sempre disponível) como fonte de entropia:

```sql
CREATE OR REPLACE FUNCTION public.pos_generate_pair_code(
  p_empresa uuid, p_nome text, p_flavor text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_code TEXT;
BEGIN
  IF NOT public.can_manage_empresa(p_empresa) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa';
  END IF;
  IF p_flavor NOT IN ('rede','pagseguro','infinitepay') THEN
    RAISE EXCEPTION 'Flavor inválido';
  END IF;

  -- 8 chars A-Z/0-9 a partir de UUIDs (não requer pgcrypto)
  v_code := upper(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
  );

  INSERT INTO public.pos_pair_codes (empresa_id, code, flavor, nome, criado_por)
  VALUES (p_empresa, v_code, p_flavor, p_nome, auth.uid());

  RETURN v_code;
END;
$$;
```

## Escopo

- Só a função `pos_generate_pair_code` muda.
- Nenhum código front-end / bridge / esquema de tabela é tocado.
- Flavors continuam `rede | pagseguro | infinitepay` (PagSeguro já é aceito — o erro não era sobre flavor).

## Observação

Se preferirmos manter `gen_random_bytes`, a alternativa seria trocar `SET search_path TO 'public'` por `SET search_path TO 'public, extensions'`. Escolho o `gen_random_uuid()` porque elimina a dependência da extensão e casa com o padrão dos outros RPCs do projeto.
