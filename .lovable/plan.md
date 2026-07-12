## Cockpit Operacional v1.2.0 — Sidebar Segura do /caixa

Transforma a barra superior de abas do painel operacional (`/caixa`) em uma **Sidebar lateral com accordions**, sem afrouxar nenhuma verificação de permissão. Toda a lógica de segurança atual (`usePermissions` + flags da `permissoes_matriz` + `is_admin`) é reaproveitada — cada item/submenu é **envolvido em condicional**, então o que o usuário não pode acessar **não é renderizado** (não fica apenas desabilitado).

### 1. Mapeamento de Permissões (o pedido central — revise antes de eu executar)

Regra global: `is_admin` (Master) sempre vê tudo. Um grupo (accordion) só aparece se **pelo menos um** dos seus filhos for permitido.

| Grupo / Item | Ação/Aba | Flag exigida (além de `is_admin`) |
|---|---|---|
| **OPERACIONAL** | *(grupo)* | qualquer filho abaixo |
| ↳ Mesas | tab `mesas` | `acesso_mesas` |
| ↳ Delivery | tab `delivery` | `acesso_delivery` |
| ↳ Balcão | tab `balcao` | `acesso_atendimento_balcao` |
| **CLIENTES** | *(grupo)* | qualquer filho abaixo |
| ↳ Conta Corrente | tab `fiado` | `acesso_financeiro` |
| ↳ Cadastro de Clientes | tab `clientes` | `master` (só Master) |
| **FISCAL** | tab `fiscal` (acesso direto) | `master` |
| **CAIXA** | *(grupo)* | qualquer filho abaixo |
| ↳ Consultar Caixa (Parcial) | abre `PartialReportDialog` | `acesso_financeiro` |
| ↳ Suprimento | `handleMov("Suprimento")` | `acesso_sangria_suprimento` |
| ↳ Sangria | `handleMov("Sangria")` | `acesso_sangria_suprimento` |
| ↳ Recebimento | `handleMov("Recebimento Pedido")` | `acesso_financeiro` |
| ↳ Fechar Caixa | abre `CloseCaixaDialog` | `master` |
| **ESTOQUE** | *(grupo)* | qualquer filho abaixo |
| ↳ Ajuste Rápido | abre dialog `AjusteRapidoView` | `acesso_entrada_estoque` |
| **CONFIGURAÇÕES** | *(grupo — Master)* | `master` |
| ↳ Impressão (setores) | tab `config` | `master` |
| ↳ Pagamento | tab `pagamento` | `master` |

> **Decisões que precisam do seu aval** (não estavam na sua lista, então propus um lar lógico): as abas Master-only **Impressão** e **Pagamento** foram agrupadas em **CONFIGURAÇÕES**; **Fechar Caixa** entrou no grupo **CAIXA**; e o **Cadastro de Clientes** (Master) ficou junto de Conta Corrente no grupo **CLIENTES**. Se preferir outro arranjo (ex.: remover algum, renomear, mover Fechar Caixa para o rodapé), ajusto na revisão.

### 2. Arquitetura da Sidebar

- Novo componente `src/components/caixa/CaixaSidebar.tsx` usando as primitivas shadcn já instaladas (`Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `Collapsible`/`accordion` para os submenus, `collapsible="icon"` para recolher).
- Recebe `perms`, o `tab` ativo, e callbacks: `onSelectTab(tab)`, `onSuprimento`, `onSangria`, `onRecebimento`, `onParcial`, `onAjuste`, `onFecharCaixa`, `onLock`.
- Cada `SidebarGroup`/item é renderizado atrás de um helper de guarda (reutiliza `caixaTabAllowed` + checagens diretas de flag), garantindo **não-renderização** para quem não tem acesso.
- **Topo:** `BrandLogo` (logo + nome do restaurante da empresa ativa).
- **Rodapé (`SidebarFooter`):** logo **Triviano** (`public/logo-triviano.svg`) + item **Suporte** + botão **Bloquear Caixa** (`onLock`).

### 3. Novo layout do `/caixa`

- `OperationalPanel` passa a envolver tudo em `SidebarProvider` com layout em linha: `<CaixaSidebar/>` à esquerda + área principal (`AppShell`/`ShellHeader`/`ShellBody`) à direita, preservando o padrão `100dvh`/scroll único do AppShell.
- `ShellHeader` fica enxuto: `SidebarTrigger` (recolher/expandir), título do módulo, **Saldo atual** e botão de som. A antiga barra de abas e a barra de ações de caixa saem do header (migram para a Sidebar).
- `ShellBody` continua renderizando o conteúdo da aba ativa (delivery/mesas/balcão/fiado/clientes/config/pagamento/fiscal) exatamente como hoje. Dialogs (Parcial, Ajuste, Fechar) permanecem, agora disparados pela Sidebar.

### 4. Landing inteligente (já existente, revalidado)

`firstAllowedTab`/`caixaTabAllowed` já escolhem a primeira aba permitida e respeitam `?tab=` + `?denied=`. Mantido; a Sidebar apenas reflete o `tab` atual como item ativo. (O redirect de rota inteligente `firstAllowedRoute` no login continua intacto — Cozinheiro/KDS etc. já cai no seu módulo.)

### 5. Grade de pedidos responsiva (item 4 do pedido)

- `DeliveryColumn`: troca a lista de coluna única (`space-y-3`) por **grade fluida** — `grid gap-3 sm:grid-cols-2 xl:grid-cols-3` — para os cards ficarem lado a lado conforme a largura ganha com a saída do menu superior.
- `MesasColumn`: mesma abordagem para os blocos de mesa (`grid gap-4 xl:grid-cols-2`), mantendo o agrupamento por mesa.
- **Preservado 100%:** clique no card abre a modal de detalhes (`CompactOrderRow` → `Dialog`/`OrderCard`) e o `StatusControl` (trocas de status) e o disparo de impressão continuam funcionando (nenhuma mudança de lógica de negócio).

### Arquivos afetados

- **Novo:** `src/components/caixa/CaixaSidebar.tsx`
- **Editado:** `src/routes/_authenticated/caixa.tsx` — `OperationalPanel` reestruturado (SidebarProvider + header enxuto), `DeliveryColumn`/`MesasColumn` em grade, remoção da antiga barra de abas/ações e do `TabButton` (substituídos pela Sidebar).
- Sem migrações de banco, sem mudança de RLS, sem mudança de lógica de permissões no back-end.

### Fora de escopo

Nenhuma alteração no `/admin`, no fluxo de login, nas RPCs de permissão ou em pagamentos. Apenas UI/estrutura do painel `/caixa`.
