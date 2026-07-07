## Objetivo

Levar a engenharia de layout que validamos no **Atendimento Balcão** (tela cheia, altura travada, sem scroll duplo, rolagem isolada nas áreas centrais) para **todos os módulos** — Caixa, Painel Admin e PWA Mobile do cliente — de forma consistente e sem regressões.

## Estratégia: primitivos reutilizáveis (em vez de editar 40 arquivos à mão)

Para evitar inconsistência e quebras, crio 3 componentes de layout e aplico nas telas, em vez de espalhar classes `h-screen overflow-hidden` soltas.

```text
AppShell (trava a página)
├── ShellHeader   → congelado no topo (shrink-0)
├── ShellBody     → h-full min-h-0 overflow-y-auto  (única área que rola)
└── ShellFooter   → congelado no rodapé (shrink-0)  [opcional]
```

- `src/components/layout/AppShell.tsx` — contêiner raiz: `flex h-[100dvh] flex-col overflow-hidden` (usa `100dvh` para respeitar barras do mobile).
- Header e Footer: `shrink-0`; Body: `flex-1 min-h-0 overflow-y-auto`.
- Regra de ouro anti-scroll-duplo: **só o Body rola**; header/filtros e rodapé/ações ficam cravados.

## 1. Módulos gerenciais (Caixa + Admin) — full width & height

- Remover limitadores de largura (`max-w-6xl`, `max-w-7xl`, `mx-auto`, `container`) dos contêineres de página do Caixa e Admin, forçando `w-full`.
- Envolver `caixa.tsx` e `admin.tsx` no `AppShell`: barra de abas/topo como `ShellHeader` congelado; conteúdo da aba ativa no `ShellBody` rolável.
- CRUDs e views do Admin (Insumos, Produtos, Entrada de Estoque, Fornecedores, Subprodutos, Categorias, Setores, Combos, Tesouraria, Clientes, Sugestão de Compras, Configs): remover `max-w-*`, deixar tabela/grade em `ShellBody` com `overflow-y-auto`; barras de busca/filtro e botões de ação (Salvar/Confirmar) fixos.
- Cozinha/KDS e demais views do Caixa: mesmo padrão.
- Diálogos (`PaymentDialog`, `OrderEditDialog`, etc.): manter `max-w-*` — modais **não** devem virar tela cheia; ficam de fora.

## 2. PWA Mobile do cliente (comportamento nativo)

- `home-netflix.tsx` (vitrine) e `checkout.tsx`/`perfil.tsx`: trocar `min-h-screen` + scroll de página por `AppShell` (`100dvh`, `overflow-hidden`).
- Header do cliente e barra/CTA inferior do carrinho travados na moldura; **só a vitrine/lista e o carrinho rolam** internamente.
- Eliminar o "elástico" de site (overscroll): aplicar `overscroll-behavior: none` no shell mobile.
- Manter `env(safe-area-inset-*)` para notch/gestos.

## 3. Telas fora do escopo (mantidas como estão)

Login/reset (`auth.tsx`, `reset-password.tsx`, `update-password.tsx`), 404/erro e `index.tsx` continuam com layout centralizado atual — não são módulos operacionais de tela cheia.

## Detalhes técnicos

- Usar `h-[100dvh]` (não `100vh`) para não estourar atrás das barras do navegador mobile.
- Todo contêiner flex que contém área rolável recebe `min-h-0` (senão o `overflow-y-auto` não funciona dentro de flex).
- Verificação: após aplicar, rodar typecheck e validar via Playwright (screenshots) as telas-chave — Caixa, uma CRUD do Admin e a vitrine mobile — confirmando ausência de scroll global e rodapés cravados, antes do deploy.

## Entrega

Refatoração aplicada, typecheck limpo, validação visual das telas principais e, ao final, deploy geral.
