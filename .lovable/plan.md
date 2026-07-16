## Objetivo

Permitir que o Admin **bloqueie** um funcionário (férias, afastamento, desligamento) em vez de excluir. O cadastro e todo o histórico (pedidos, movimentações de caixa, ajustes de estoque, etc.) permanecem intactos, mas o funcionário fica **impedido de operar** dentro do Triviano enquanto estiver bloqueado.

## 1. Banco de dados (uma migração)

A coluna `profiles.bloqueado boolean` já existe (usada hoje para clientes) — vamos reutilizá-la para funcionários também.

- **RPC `admin_set_funcionario_bloqueado(p_user_id uuid, p_bloqueado boolean)`** (`security definer`):
  - Só executa se `is_local_admin()` for verdadeiro.
  - Confirma que o alvo pertence à mesma `empresa_id` do operador e tem `nivel_id IS NOT NULL` (é funcionário, não cliente nem master).
  - Faz `UPDATE public.profiles SET bloqueado = p_bloqueado WHERE id = p_user_id`.
  - `GRANT EXECUTE ... TO authenticated`.
- **Ajuste em `get_my_permissions()`**: se o próprio `profiles.bloqueado` do usuário logado for `true`, retorna a linha `DENY_ALL` (todas as flags `false`, `is_admin/is_manager/is_funcionario = false`). Isso desliga automaticamente todos os guards do Caixa e Admin sem tocar em cada tela.
- **Ajuste em `admin_list_funcionarios()`**: passa a devolver também `bloqueado boolean` para alimentar a UI.

Motor financeiro, RLS de pedidos, triggers e webhook do MP não são alterados (mem://constraints/motor-financeiro-protegido).

## 2. Backend TS

- `src/lib/niveis.ts`
  - `Funcionario` ganha `bloqueado: boolean`.
  - Nova função `setFuncionarioBloqueado(user_id, bloqueado)` chamando a RPC acima.

## 3. UI — `src/components/admin/FuncionariosTab.tsx`

Na linha de cada funcionário, ao lado do seletor de nível e antes do botão excluir:

- **Switch "Ativo / Bloqueado"** (ou botão com ícone `Lock` / `LockOpen`).
- Quando bloqueado: a linha ganha um badge cinza "Bloqueado" e o nome fica em `text-muted-foreground`.
- Toast de confirmação ("Funcionário bloqueado." / "Funcionário liberado.").
- Invalida `["funcionarios"]` no cache.

O botão **Excluir** permanece disponível (para casos realmente definitivos), mas o texto de ajuda no topo da aba passa a sugerir bloquear em vez de excluir para preservar o histórico.

## 4. Efeito prático do bloqueio

Como `get_my_permissions()` passa a devolver `DENY_ALL` para funcionário bloqueado:

- Guards `canEnterCaixa` / `canEnterAdmin` recusam a entrada e a rota `_authenticated` redireciona para `/` (comportamento já existente para quem não tem permissão).
- Toda RPC financeira/operacional que exige uma flag específica (abrir caixa, sangria, fechar comanda, etc.) já falha via `has_permission_flag` do backend.
- Login continua funcionando (não bloqueamos `auth.users`), então o desbloqueio é imediato quando o Admin voltar a marcar como ativo — sem precisar recriar conta nem redefinir senha.

## 5. Fora do escopo

- Não alteramos schema de pedidos/caixa (autoria preservada por FK atual).
- Não mexemos em clientes (fluxo `set_cliente_bloqueado` já existe e continua separado).
- Sem novos e-mails ou notificações ao funcionário bloqueado.
