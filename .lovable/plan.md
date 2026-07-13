## Objetivo
Transformar o nível **Proprietário** em um **Admin Local com acesso total** aos módulos de gestão, mantendo o isolamento por `empresa_id` e preservando o SuperAdmin (Triviano) como visão global.

## Realidade do sistema (importante)
No código, **"Proprietário" não é um `role`** — é um **nível de acesso** (`niveis_acesso`) atribuído a um funcionário via `profiles.nivel_id`. Portanto `user.role === 'Proprietário'` não existe. Os `roles` reais são: `super_admin` (Triviano, global), `admin` (empresa) e `user`.

Descoberta decisiva: a funcionária no nível Proprietário **já possui o role `admin`**, e as tabelas de gestão (`empresas`, `config_pagamentos`, `setores`, `fornecedores`, `config_impressoras`) já são protegidas por `can_manage_empresa()`, que **já isola por `empresa_id`**. Ou seja, o servidor já permite (e limita) a escrita dela à própria empresa — **o bloqueio hoje é só no front-end** (`is_admin` = `is_master_admin`, que é falso porque ela tem `nivel_id`).

Consequência: o multi-tenant (item 3) **já está garantido por RLS** para quase tudo; só precisamos liberar a interface e ajustar 2 pontos server-side (Permissões e Funcionários) que hoje exigem `is_master_admin` estrito.

## Abordagem: flag "Admin Local" (robusta) em vez de comparar nome
Em vez de casar a string `"Proprietário"` (frágil: quebra ao renomear/typo), adicionamos uma flag **`is_admin_local`** ao nível. Qualquer nível com essa flag vira admin local pleno. O nível Proprietário nasce com ela ligada. Isso cria o conceito lógico pedido (`isManager`) de forma segura e reutilizável.

## Etapas

### 1. Banco de dados (migration)
- `ALTER TABLE niveis_acesso ADD COLUMN is_admin_local boolean NOT NULL DEFAULT false`.
- Nova função `is_local_admin()` = `is_master_admin()` **OU** (nível do usuário tem `is_admin_local = true`).
- Recriar `get_my_permissions()` para retornar nova coluna **`is_manager`** (= `is_local_admin()`); admin local recebe todas as flags como `true`.
- Trocar em `niveis_acesso` e `permissoes_matriz` o gate `is_master_admin()` → `is_local_admin()` (o escopo `empresa_id = current_empresa_id()` permanece — continua isolado por empresa).
- Trocar em `admin_list_funcionarios()` e `admin_set_funcionario_nivel()` o gate `is_master_admin()` → `is_local_admin()`.
- **Saneamento:** `is_admin_local = true` no nível Proprietário existente e **todas** as flags de `permissoes_matriz` desse nível = `true`.

### 2. Camada de permissões (front-end)
- `src/lib/permissions.ts`: adicionar `is_manager` a `MyPermissions` e `DENY_ALL`; criar helper `isManager(p) = p.is_admin || p.is_manager`.
- `src/lib/niveis.ts`: incluir `is_admin_local` no fetch/insert e um setter; garantir que o preset "Proprietário" (em `src/lib/cargos.ts`) crie o nível com `is_admin_local = true` + todas as flags `true` (saneamento futuro no ato da criação).

### 3. Liberação de módulos (substituir `is_admin` por `isManager`)
Nos módulos gated como `"master"` hoje:
- `src/routes/_authenticated/admin.tsx`: nas abas **Configurações da Empresa, Identidade Visual, Pagamentos, Clientes, Setores, Fornecedores, Funcionários, Permissões** (e o acesso à própria rota /admin já passa pelas flags).
- `src/components/caixa/CaixaSidebar.tsx`: itens hoje presos a `isMaster` (Fiscal, Impressão, Pagamento, Cadastro de Clientes) passam a usar `isManager` → o Proprietário vê tudo. **Entrada de Estoque, Setores e Fornecedores** vivem no /admin (não na sidebar do caixa); ficam cobertos pelo item admin.tsx.

### 4. Isolamento multi-tenant
- Nenhuma ampliação de RLS além da troca `is_master_admin → is_local_admin` em Permissões/Funcionários (que já herdam `current_empresa_id()`).
- SuperAdmin permanece com `has_role('super_admin')` (visão global) intacto.

### 5. Verificação
- `tsgo` nos arquivos alterados.
- Teste com a conta Proprietário: abre /admin, enxerga as 8 abas, salva config da própria empresa, e **não** consegue ver/editar outra `empresa_id` nem virar super_admin.

## Riscos de segurança (avaliação)
- **Baixo.** O isolamento por empresa continua 100% no servidor (RLS + `current_empresa_id()`). Liberar a UI não expõe dados de outras empresas.
- **Ponto de atenção (dentro da empresa):** ao ganhar a aba Permissões, o Proprietário pode conceder "Admin Local" a outros níveis **da própria empresa**. Isso é o comportamento esperado de um admin local pleno; ele **não** consegue conceder `super_admin` (isso vive em `user_roles`, fora do alcance dessas telas) nem cruzar empresas.
- Observação: hoje vários funcionários da empresa carregam o role `admin` no banco — é um resíduo pré-existente que não faz parte desta tarefa, mas vale revisar depois.
