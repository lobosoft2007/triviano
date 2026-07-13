# Permissão dedicada: Abrir/Fechar Caixa (v1.2.x)

## Objetivo
Permitir que o operador **abra e feche o próprio caixa** sem receber o `acesso_financeiro` completo (que expõe Consultar Caixa/Relatório Parcial, Recebimento, Suprimento e Sangria). Para isso, criamos uma nova flag isolada na Matriz de Permissões: **Abrir/Fechar Caixa**.

## Sua pergunta: risco de segurança e complexidade

**Risco: baixo / nenhum.** A barreira de segurança real é o RLS da tabela `fluxo_caixa`, que usa `can_manage_empresa` e já isola tudo **por empresa** (um operador nunca alcança o caixa de outra loja). A nova flag é apenas uma camada de *menor privilégio* no app — ela restringe, nunca amplia acesso. Nada do que você quer esconder (relatórios financeiros, recebimentos, sangria/suprimento) fica exposto, pois cada um continua com sua própria flag (`acesso_financeiro`, `acesso_sangria_suprimento`).

**Complexidade: baixa.** Uma migração simples + ajustes pontuais no front-end. Sem refatoração de lógica de negócio.

## Mapeamento de permissões (o que cada perfil verá)

| Item | Flag hoje | Flag depois |
|------|-----------|-------------|
| Abrir Caixa (tela de abertura) | qualquer acesso ao Caixa | **`acesso_abrir_fechar_caixa`** |
| Fechar Caixa (sidebar) | `acesso_financeiro` | **`acesso_abrir_fechar_caixa`** |
| Consultar Caixa / Relatório Parcial | `acesso_financeiro` | *(inalterado)* |
| Recebimento | `acesso_financeiro` | *(inalterado)* |
| Suprimento / Sangria | `acesso_sangria_suprimento` | *(inalterado)* |

Resultado: você marca só **Abrir/Fechar Caixa** no nível do operador → ele abre e fecha o turno, mas o submenu Caixa mostra apenas "Fechar Caixa"; nada de financeiro.

## Passos técnicos

### 1. Banco de dados (migração)
- `ALTER TABLE public.permissoes_matriz ADD COLUMN acesso_abrir_fechar_caixa boolean NOT NULL DEFAULT false;`
- Atualizar a função `get_my_permissions()` para retornar a nova coluna em todos os ramos:
  - Master admin → `true`
  - Sem nível / sem matriz → `false`
  - Funcionário → valor de `m.acesso_abrir_fechar_caixa`
- Compatibilidade: níveis existentes ficam com `false` por padrão (ninguém perde acesso indevidamente; o Master Admin continua com tudo).

### 2. Front-end — camada de permissões
- `src/lib/permissions.ts`: adicionar `"acesso_abrir_fechar_caixa"` ao tipo `PermissionFlag`, ao objeto `DENY_ALL`, à interface `MyPermissions` e à lista `PERMISSION_LABELS` (rótulo: **"Abrir / Fechar Caixa"**).
- `src/lib/niveis.ts`: incluir a flag no array `FLAGS` (para salvar/ler na tela de Permissões).

### 3. Front-end — Sidebar do Caixa
- `src/components/caixa/CaixaSidebar.tsx`: criar `canAbrirFecharCaixa = isMaster || perms.acesso_abrir_fechar_caixa` e usar essa flag no item **Fechar Caixa** (hoje em `canFinanceiro`).

### 4. Front-end — abertura de turno
- `src/routes/_authenticated/caixa.tsx`: ao renderizar a `LockScreen` (caixa fechado), exigir a nova flag. Se o usuário pode entrar no Caixa mas **não** tem `acesso_abrir_fechar_caixa`, mostrar um aviso amigável ("Aguardando a abertura do caixa por um responsável") em vez da tela de abertura. Master Admin e quem tiver a flag abrem normalmente.

### 5. Tela de Permissões (Retaguarda)
- `src/components/admin/PermissoesTab.tsx`: a nova flag aparece automaticamente por vir de `PERMISSION_LABELS`. Verificar apenas se o layout comporta mais um switch (nenhuma mudança de lógica esperada).

## Verificação
- `tsgo` nos arquivos alterados.
- Teste manual: criar/usar um nível só com "Abrir/Fechar Caixa" → confirmar que abre e fecha o turno e que **não** vê Consultar Caixa, Recebimento, Sangria/Suprimento nem o Admin.
