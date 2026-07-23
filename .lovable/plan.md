## Plano — corrigir criação do Agente de Impressão

### 1. Corrigir os RPCs `create_printer_agent_token` e `revoke_printer_agent_token`
Hoje eles chamam `can_manage_empresa()` sem argumento, mas a função exige `empresa_id uuid`. É essa a causa real do "Não foi possível criar o agente".

- Substituir o guard por: `is_master_admin() OR can_manage_empresa(current_empresa_id())`.
- Manter `SECURITY DEFINER` e `search_path = public`.
- Em `create_...`: gerar token, gravar hash e associar à `current_empresa_id()`.

### 2. Ajustar as políticas RLS de `printer_agent_tokens`
Sim, vou usar **as duas policies** que você sugeriu (padrão já adotado no projeto):

- `tokens_admin_master` — Admin Master (via `is_master_admin()`, que é o helper oficial deste projeto; não vamos ler `profiles.is_admin` diretamente porque a matriz de papéis vive em `user_roles` + `niveis_acesso`).
- `tokens_empresa_manager` — `empresa_id = current_empresa_id() AND can_manage_empresa(current_empresa_id())`.

Ambas cobrindo `FOR ALL` (SELECT/INSERT/UPDATE/DELETE), restritas ao role `authenticated`. As policies antigas restritas a "master only" serão removidas.

### 3. Melhorar a mensagem de erro no toast
Em `AgentsSection` (dentro de `src/routes/_authenticated/caixa.tsx`), no `onError` da mutation de criar/revogar agente:

```ts
onError: (err: unknown) => {
  const msg = err instanceof Error ? err.message : "Falha desconhecida";
  toast.error(msg);
}
```

Assim o erro real do Postgres/RLS aparece na tela.

### 4. Validar
- Rodar linter Supabase.
- Testar criação de agente como Admin Local (Claudia) e como Admin Master.
- Confirmar que o token aparece uma única vez com botão "Copiar" e é listado depois.

### Fora do escopo
Motor financeiro, meios de pagamento, webhook MP — intocados.