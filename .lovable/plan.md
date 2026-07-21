## Objetivo

Reescrever a impressão/preview da **Ordem de Compra** (Sugestão + Manual + Consolidada por Setor) usando como base o mesmo padrão do **Relatório de Clientes** — `ReportShell` + `printReport()` do `src/lib/reports/types.ts`. O `ReportShell` já resolve tudo que estava quebrado no `OrdemCompraReport` atual (página em branco, "Pág 0/0", setor vazio, oklch no PDF): cabeçalho/rodapé, paginação `@page`, filtros, seleção de colunas, escolha de fonte, totais monetários e contagem de registros.

Essas regras (cabeçalho com logo + título + Pág x/y, rodapé com razão social/endereço, filtros, seleção de colunas, totais monetários, contagem, escolha de fonte) passam a ser as **regras oficiais** de qualquer relatório novo do sistema — via `ReportShell`.

## Escopo — só a Ordem de Compra

Não mexer no `RelatorioClientes`, no `RelatorioChatIA` nem no `ReportShell` propriamente dito (ele já está correto). Também não mexer no motor financeiro, RLS, RPCs ou schema.

## Mudanças

### 1. Substituir a impressão da Ordem de Compra pelo `ReportShell`

Criar `src/components/admin/reports/RelatorioOrdemCompra.tsx` seguindo o mesmo padrão do `RelatorioClientes.tsx`:

- Recebe via props: `title` (ex.: "Ordem de Compra — Sugestão", "Ordem Consolidada por Setor", "Ordem Manual"), `rows: OrdemCompraLinha[]`, `observacao?`, `loading?`.
- Colunas padronizadas (todas selecionáveis; `defaultHidden` nas menos usadas):
  - Item (nome), Setor, Fornecedor, Unidade, Qtd (numeric), Custo un. (money), Subtotal (money), Estoque atual (defaultHidden), Mínimo/Máximo (defaultHidden), Tipo (defaultHidden).
- Filtros no header do shell (dentro do slot `filters`):
  - Busca (nome/fornecedor/setor), Setor (select), Fornecedor (select), Tipo (insumo/produto/livre), Ordenar (Setor→Fornecedor→Nome | Fornecedor→Nome | Nome | Maior subtotal).
- Totais: `money: true` em Custo un. e Subtotal → `ReportShell` já soma no rodapé; contagem de itens sai automática.
- Rodapé: já vem de `ReportShell` com razão social + endereço da `empresas`.
- Fonte, orientação (retrato/paisagem) e "Imprimir / PDF": já é o `printReport()` do shell, que injeta o `@page` com `counter(page) / counter(pages)` — resolve a página em branco e a paginação zerada do relatório atual.

### 2. Preparar os dados a partir das três origens existentes

Criar um helper `src/lib/reports/ordem-compra-rows.ts` com uma única função `buildOrdemCompraRows(input)` que retorna `OrdemCompraLinha[]` já com `setor_nome`, `fornecedor_nome`, `estoque_atual`, `minimo`, `maximo`, `custo_compra`, `quantidade`, `unidade`, `tipo`, `nome` resolvidos. Ela é chamada em três lugares:

- **Sugestão de Compra** (`SugestaoComprasView.tsx`) → para os botões:
  - "Gerar Ordem Única" → uma lista.
  - "Gerar Ordem Consolidada por Setor" → mesma função, `orderBy: setor→fornecedor→nome`.
- **Ordem Manual** (`OrdemCompraManualDialog.tsx`) → mesmos dados dos itens editados no diálogo.
- **Detalhe da OC** (`OrdemCompraDetailDialog.tsx`) → itens da OC persistida.

O helper resolve nome de setor/fornecedor **na origem**, eliminando a corrida de `setorMap`/`fornMap` que hoje deixa a coluna Setor em branco.

### 3. Trocar o preview atual pelo novo componente

- `SugestaoComprasView.tsx`: os botões "Gerar Ordem Única" e "Gerar Ordem Consolidada por Setor" passam a abrir um `Dialog` (ou navegar para uma aba) que renderiza `<RelatorioOrdemCompra rows={...} title={...} />`. Remover a rota atual que instanciava o `OrdemCompraReport` fora do shell.
- `OrdemCompraManualDialog.tsx`: substituir o preview (`<OrdemCompraReport ... />` + `window.print()` manual) por `<RelatorioOrdemCompra ... />` renderizado num `Sheet`/`Dialog` de tela cheia. A parte de **salvar a OC no banco** continua igual — só o preview/impressão muda.
- `OrdemCompraDetailDialog.tsx`: mesma troca de preview.

### 4. Aposentar o `OrdemCompraReport` antigo

Após 1–3 funcionarem, apagar `src/components/admin/reports/OrdemCompraReport.tsx` e as regras `@media print` específicas dele em `src/styles.css` (`.report-a4`, `.report-header`/`.report-footer` fixed, `.report-pagenum`, `@top-right` duplicado). O `printReport()` do shell já cobre tudo.

### 5. PDF / WhatsApp

- Botão "Imprimir / PDF" do `ReportShell` já usa `window.print()` → "Salvar como PDF" do navegador. Sem `html2pdf.js`, sem `oklch`, sem página em branco.
- Botão "Enviar por WhatsApp" some do preview. Fica só o compartilhamento nativo do PDF que o próprio SO oferece após "Salvar como PDF". Se o usuário quiser um botão dedicado de WhatsApp num segundo momento, entra num plano separado.

## Fora do escopo

- Não mudar `RelatorioClientes`, `RelatorioChatIA`, `ReportShell`.
- Não mudar cálculos de sugestão de compra, custo, estoque, ficha técnica, motor financeiro, RLS/GRANTs.
- Não alterar o fluxo de salvar OC (manual/consolidada) — apenas o preview/impressão.

## Verificação

1. Sugestão de Compra → "Gerar Ordem Única" com 46 itens → preview mostra header/toolbar (colunas, fonte, orientação, CSV, Imprimir), 46 linhas, totais em Custo un. e Subtotal, "Total de registros: 46".
2. "Imprimir / PDF" → visualização do navegador mostra 3 páginas A4, cabeçalho com logo + título + "Pág 1/3", rodapé com razão social/endereço.
3. Coluna Setor preenchida em todas as linhas.
4. Ordem Consolidada por Setor → mesma lista ordenada por setor → fornecedor → nome.
5. Ordem Manual → preview idêntico ao da Sugestão.
6. Detalhe de OC salva → preview idêntico.
7. Nada de "oklch" no console, nenhuma página em branco.
