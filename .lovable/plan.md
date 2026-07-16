## Objetivo
Transformar a aba **Horários** em um sub-item de **Categorias** no sidebar do `/admin`, mantendo o conteúdo e as permissões atuais.

## Contexto atual
- `src/routes/_authenticated/admin.tsx` define `AdminTab` com `"horarios"` e renderiza `<HorariosResumoTab />` no switch de conteúdo.
- `src/components/admin/AdminSidebar.tsx` lista `"horarios"` como item irmão de `"categorias"` dentro do grupo "Cadastros".
- Ambos usam a permissão `acesso_cadastro_produtos`.

## Mudanças propostas

### 1. Estrutura do sidebar (`src/components/admin/AdminSidebar.tsx`)
- Introduzir suporte a **itens aninhados** no grupo "Cadastros":
  - "Categorias" vira um item expansível com dois sub-itens:
    - **Categorias** → tab `"categorias"`
    - **Horários** → tab `"horarios"`
- Criar um helper interno (ex.: `SidebarNestedGroup`) que renderize um `Collapsible` dentro de `SidebarMenuSub`, reaproveitando os componentes do shadcn Sidebar.
- Manter o comportamento de abertura automática: quando `activeTab` for `"categorias"` ou `"horarios"`, o grupo "Cadastros" e o sub-menu "Categorias" ficam abertos.
- Preservar a regra de `tabAllowed`: só exibe o sub-item se a flag permitir.

### 2. Tipo e renderização de conteúdo (`src/routes/_authenticated/admin.tsx`)
- Manter `"horarios"` no tipo `AdminTab`.
- Manter `TAB_FLAG.horarios = "acesso_cadastro_produtos"`.
- Manter a renderização `{tab === "horarios" && <HorariosResumoTab />}`.
- Remover `"horarios"` do array `TABS` usado para descobrir a primeira aba permitida e o label do header (ou marcar como `hidden: true`), pois ele não deve mais aparecer como aba de topo.
- O header continua mostrando o label correto via `TABS.find(...)` ou fallback para "Horários".

### 3. Ícones
- O item pai "Categorias" continua com ícone `Tags`.
- O sub-item "Horários" usa ícone `Clock`.

## Detalhes técnicos
- Sem novas queries ou alterações no backend.
- Sem mudanças na lógica de `HorariosResumoTab` ou `CategoriaHorariosDialog`.
- Layout respeita o `AppShell` e o sidebar colapsável (`collapsible="icon"`).
- Cores e tokens permanecem semânticos (nenhum hardcoded).

## Fora do escopo
- Alterar o conteúdo/funcionalidade da aba Horários.
- Criar horários por produto individual.
- Mudar permissões ou regras de acesso.