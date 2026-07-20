## O que muda

### 1. Sugestão de Compras — botão "Ordem Única"
No `SugestaoComprasView` já existe um botão **Gerar ordem** por fornecedor. Vou adicionar, no cabeçalho da lista, um botão **"Gerar Ordem Única (todos fornecedores)"** que consolida todos os itens sugeridos em **uma única Ordem de Compra**, com `id_fornecedor = null` e observação `"Reposição automática — consolidada"`. O comportamento por fornecedor continua igual.

### 2. Escolha da orientação (Retrato / Paisagem) na impressão
Hoje `Imprimir` chama `printReport("portrait")` fixo. Vou:
- Adicionar um pequeno seletor **Retrato/Paisagem** ao lado do botão **Imprimir** nos dois diálogos de ordem (`OrdemCompraDetailDialog` e `OrdemCompraManualDialog`), com padrão **Paisagem** (cabe melhor).
- Passar a orientação escolhida para `printReport(...)`, `downloadNodeAsPdf(...)` e `shareNodeAsPdfWhatsapp(...)`.
- Ajustar o CSS `.report-content` (`src/styles.css`) para `padding-top: 22mm` (hoje 16mm), o que elimina os "pontinhos" que aparecem por causa da primeira linha do `<thead>` ficando escondida sob o cabeçalho fixo (`report-header` com logo de 40px + borda + padding ocupa ~20mm, maior que os 16mm reservados). Também vou reduzir o padding do próprio `.report-header` para diminuir o desperdício.

### 3. Correção do erro "unsupported color function 'oklch'" em Baixar PDF / WhatsApp
Causa raiz: o `html2canvas` (usado pelo `html2pdf.js`) lê os estilos computados de **todos** os descendentes. A preflight do Tailwind v4 aplica `border-color: var(--border)` em `*, *::before, *::after`, e `--border` está definido como `oklch(...)` em `:root` (`src/styles.css`). Mesmo o relatório usando cores hex inline, qualquer elemento sem `border-color` explícito herda `oklch(...)` e o parser do html2canvas quebra.

Correção em duas camadas:

- **Escopo CSS no relatório** (`src/styles.css`): declarar overrides seguros em `.report-a4, .report-a4 *`, mapeando os custom-properties usados pela preflight para valores hex (`--background:#fff; --foreground:#111; --border:#ccc; --ring:transparent; --primary:#111; --muted:#eee; --muted-foreground:#555; --card:#fff; --card-foreground:#111; --secondary:#f2f2f2; --secondary-foreground:#111; --destructive:#c0392b; --accent:#eee;`) e forçando `border-color: #ccc !important; box-shadow: none !important; background-image: none !important;`. Isso resolve tanto o `oklch` quanto qualquer resíduo de `color-mix`/`shadow`.
- **Blindagem na geração do PDF** (`src/lib/pdf-share.ts`): antes de chamar o `html2canvas`, clonar o nó dentro de um wrapper temporário anexado ao `<body>` com `all: initial; color:#111; background:#fff` no wrapper — assim mesmo que apareça algum novo custom-property no futuro, ele não vaza para dentro do relatório.

## Arquivos alterados

- `src/components/admin/SugestaoComprasView.tsx` — botão Ordem Única + handler que agrega todos os itens em uma chamada `criarOrdemCompra`.
- `src/components/admin/OrdemCompraDetailDialog.tsx` — seletor de orientação; usar orientação escolhida em `printReport`, `downloadNodeAsPdf`, `shareNodeAsPdfWhatsapp`.
- `src/components/admin/OrdemCompraManualDialog.tsx` — mesmo seletor de orientação + repassar orientação nas 3 chamadas.
- `src/styles.css` — reset de custom-properties dentro de `.report-a4` (fix oklch) e ajuste de `padding-top` do `.report-content` para eliminar sobreposição do cabeçalho.
- `src/lib/pdf-share.ts` — wrapper temporário de isolamento em torno do nó a ser renderizado.

## Fora do escopo (não mexo)
- Motor financeiro, RLS, RPCs de custo/ordem.
- Layout geral dos relatórios (só ajustes de espaçamento/impressão).
- Nenhuma migração de banco.
