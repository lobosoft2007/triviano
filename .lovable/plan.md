## Problema

A aba **Admin → Empresa → Configurações** fica em spinner infinito porque o componente `EmpresaConfigTab` depende de DUAS queries em paralelo, e só monta o formulário quando ambas resolvem:

1. `empresaAdminConfigQueryOptions` → RPC `admin_get_empresa_config` (OK, já traz tudo com role check)
2. `empresa-markup-ifood` → SELECT direto em `public.empresas` pedindo `markup_ifood_percentual`

O guard é:
```ts
if (empresa && !form && markupData !== undefined) setForm(...)
```
e o render é `if (isLoading || !form) return <Spinner/>`.

Se a query 2 falhar ou ficar pendente (bloqueio de RLS/coluna via PostgREST, retry silencioso), `markupData` nunca sai de `undefined` → o `setForm` nunca roda → **spinner eterno, sem mensagem de erro**. É o mesmo padrão de bug que já corrigimos antes para a query principal, mas essa segunda query ficou de fora.

## Correção

Consolidar tudo em uma única fonte de dados (a RPC), que já é role-guarded e imune ao problema:

1. **Migração SQL** — atualizar `public.admin_get_empresa_config()` para incluir `markup_ifood_percentual numeric` no retorno (adicionar à assinatura `RETURNS TABLE(...)` e ao `SELECT`). Nada mais muda no SQL — mantém `SECURITY DEFINER`, mesmo role check, mesmo GRANT.

2. **`src/lib/empresa.ts`** — adicionar `markup_ifood_percentual: number` na interface `Empresa`, mapear no `fetchEmpresaAdminConfig` (`Number(row?.markup_ifood_percentual ?? 0)`) e nos demais mappers/fallbacks já existentes (`fetchActiveEmpresa`, `fetchEmpresaConfig` com default 0).

3. **`src/lib/superadmin.ts`** — incluir `markup_ifood_percentual: 0` no mapeamento (já tem defaults para monitores).

4. **`src/components/admin/EmpresaConfigTab.tsx`**:
   - Remover o `useQuery(["empresa-markup-ifood", ...])` e o parâmetro `markupData` do `useEffect`.
   - Ler `empresa.markup_ifood_percentual` direto ao montar o form.
   - Manter o `UPDATE` direto em `empresas` no `handleSave` e no `handleApplyMarkup` (writes já funcionam — o que falha é o SELECT direto).
   - Remover a invalidação da queryKey obsoleta.

## Resultado

- Uma única RPC alimenta o formulário → não há mais race condition entre queries.
- A tela deixa de travar em branco para qualquer papel (admin, super_admin, master).
- Se por acaso a RPC ainda falhar (ex.: usuário sem role), o `error` já é tratado e exibe a caixa vermelha "Não foi possível carregar…" que adicionamos no turno anterior.
- Zero mudança em regras de negócio, RLS, ou motor financeiro.
