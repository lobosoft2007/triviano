## Diagnóstico

O erro **"Não foi possível carregar o tempo atual"** vem de um `SELECT` em `public.empresas` que está falhando com *permission denied*.

Ao inspecionar o catálogo:

```
relacl: authenticated=awdDxtm/postgres
```

O role `authenticated` tem INSERT / UPDATE / DELETE / TRUNCATE / REFERENCES / TRIGGER / MAINTAIN — **mas não tem `SELECT` (`r`)**. Ou seja, mesmo com as políticas de RLS corretas (`can_manage_empresa(id)` para admin/super_admin), o PostgREST bloqueia a leitura antes da RLS porque falta o GRANT de tabela.

Por que só afeta esta tela: outras leituras de `empresas` no admin passam por RPCs `SECURITY DEFINER` (`admin_get_empresa_config`, `admin_list_empresas`, etc.), que rodam como owner e ignoram o GRANT. O `getTempoEntregaPadrao` é uma das poucas leituras diretas via Data API, então caiu sozinha.

## Correção

Migration única restaurando o SELECT de tabela para `authenticated` (e mantendo `service_role`):

```sql
GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL    ON public.empresas TO service_role;
```

Sem grant para `anon` — o acesso público de branding continua funcionando pelo GRANT de coluna já existente (`created_at`) + RPCs `get_public_branding*`.

RLS não muda: as políticas atuais (`Super admin ve todas as empresas` e `Admins gerenciam empresas (select) — can_manage_empresa(id)`) continuam sendo o gate de linhas.

## Verificação

1. Recarregar a aba **Linhas de Produção**: o card "Tempo de entrega padrão" deve carregar o valor salvo.
2. Editar e salvar: mensagem "Tempo padrão atualizado." e valor persistindo ao trocar de aba.
