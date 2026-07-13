# Painel Admin v1.3.0 — Sidebar ERP

Substituir a barra de abas horizontal do `/admin` por uma **Sidebar profissional à esquerda** (mesmo padrão do Cockpit do Caixa: `SidebarProvider` + `SidebarInset` + `AppShell`), mantendo todo o conteúdo e as regras de segurança já existentes. Nenhuma rota nova — a navegação continua por estado interno (`?tab=`), só muda a "casca" visual.

## Estrutura de navegação (menu → aba interna → permissão)

A rota continua sendo `/admin`. Cada item aponta para uma aba interna já existente. Um item só aparece se a permissão correspondente for verdadeira (Admin Local / Proprietário e SuperAdmin veem tudo).

```text
[Logo + Nome Fantasia da empresa]   ← topo da sidebar

▸ CADASTROS
   • Cardápio ............... acesso_cadastro_produtos
   • Categorias ............. acesso_cadastro_produtos
   • Insumos ................ acesso_entrada_estoque
   • SubProdutos ............ acesso_entrada_estoque
   • Setores ................ master (Admin Local / SuperAdmin)
   • Fornecedores ........... master
   • Clientes ............... master
   • Funcionários ........... master
   • Permissões ............. master

▸ FINANCEIRO
   • Conta Corrente ......... acesso_financeiro
   • Financeiro (Dashboard) . acesso_financeiro

▸ ESTOQUE
   • Entrada de Estoque ..... acesso_entrada_estoque
   • Ajuste Rápido .......... acesso_entrada_estoque
   • Sugestão de Compras .... acesso_entrada_estoque

▸ MARKETING
   • Campanhas .............. acesso_cadastro_produtos

▸ EMPRESA
   • Configurações .......... master
   • Identidade Visual ...... master
   • Pagamentos ............. master

[ Suporte (WhatsApp) ]              ← rodapé fixo
[ selo "by TRIVIANO" + logo ]
[ Bloquear / Sair ]
```

Observação: você citou "Conta Corrente" em CADASTROS **e** em FINANCEIRO — é a mesma aba. Para evitar duplicidade, vou deixá-la apenas em **FINANCEIRO** (é seu lugar natural). Se preferir duplicada nos dois grupos, é só avisar.

## Segurança (sem mudança de backend)

- A visibilidade de cada item usa exatamente a matriz atual (`TAB_FLAG` já mapeado em `admin.tsx`) — nenhuma flag nova.
- **Admin Local (`is_admin_local` / `is_manager`)** e **SuperAdmin** enxergam todos os itens, inclusive os `master`.
- Funcionário sem permissão: o item some da sidebar **e** o deep-link `?tab=` continua bloqueado com o toast "Acesso negado" (guarda já existente, mantida).
- Grupos vazios (sem nenhum filho permitido) não são renderizados.
- Nenhuma alteração de RLS, RPC ou migração — é refatoração de front-end/apresentação.

## Responsividade

- **Desktop:** sidebar fixa e expandida (`collapsible="icon"`), conteúdo rola suave à direita.
- **Mobile/Tablet:** sidebar recolhível via `SidebarTrigger` no header enxuto do topo.
- Layout preso ao viewport (`AppShell` = `100dvh`, só o corpo rola) — igual ao Caixa.

## Detalhes técnicos

1. **Novo componente** `src/components/admin/AdminSidebar.tsx` — modelado no `CaixaSidebar.tsx` (mesmos `SidebarAccordionGroup`, `BrandLogo` no topo, rodapé Suporte + selo Triviano). Recebe `perms`, `activeTab`, `onSelectTab` e um helper de visibilidade por aba.
2. **`src/routes/_authenticated/admin.tsx`** — trocar o bloco de `ShellHeader` com as `TABS` horizontais por `SidebarProvider > AdminSidebar + SidebarInset > AppShell > (ShellHeader enxuto com SidebarTrigger + título dinâmico) + ShellBody`. O `switch` de conteúdo (`{tab === ...}`) e o dialog de produto permanecem intactos. Botões "Novo produto" e "Painel Master" (SuperAdmin) migram para o header enxuto.
3. **Título dinâmico** no header — mapa `AdminTab → título`, como o `CAIXA_TAB_TITLES`.
4. **Versão** — `src/lib/version.ts`: `APP_VERSION = "1.3.0"`, `VERSION_STATUS`, `LAST_PATCH_DATE`, e atualizar `STABLE_RELEASE`/`validated`.
5. Sem novas dependências. Validação com `tsgo` e checagem visual no Preview (desktop + mobile).

Nenhuma lógica de negócio, query ou permissão de backend é alterada — apenas a camada de layout/navegação do Admin.