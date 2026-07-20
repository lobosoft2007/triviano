## Objetivo

Reformular o diálogo **"Ordem de Compra Manual / Avulsa"** (dentro de Sugestão de Compras) para trabalhar como a tela de Insumos: uma tabela única, buscável, com todos os insumos e produtos compráveis. O usuário digita quantidade no próprio grid — tudo que tiver quantidade > 0 vira item da ordem. Barra fixa no topo com total e ações de imprimir / enviar PDF por WhatsApp.

---

## 1. Nova tela (substitui o Dialog atual)

Layout dentro do mesmo `Dialog` (largura `max-w-5xl`, altura ~90dvh, corpo com scroll interno):

**Cabeçalho fixo (sticky top)**
- Título "Ordem de Compra Manual / Avulsa"
- Campo **Busca** (filtra por nome, insensível a acento)
- **Fornecedor padrão** da ordem (opcional — para itens livres/sem fornecedor)
- **Observação**
- **Total da ordem** grande, tabular, sempre visível (soma de `quantidade × custo` das linhas com quantidade > 0)
- Botões no canto superior direito:
  - `Imprimir` → abre nova janela com o mesmo layout do framework de relatórios (`ReportShell` A4 retrato, cabeçalho com logo/empresa, paginação, rodapé, apenas linhas com quantidade > 0)
  - `Enviar PDF por WhatsApp` → gera o PDF do mesmo relatório e abre `https://wa.me/?text=...` com o arquivo anexado via `navigator.share` quando disponível; fallback: baixa o PDF e abre wa.me com o link/instrução
  - `Gerar ordem` (ação principal — cria a `ordens_compra` como hoje)
  - `Fechar`

**Corpo — tabela única**
Colunas: **Item** · **Custo unit.** · **Setor** · **Fornecedor** · **Quantidade (input)** · **Subtotal** · (ação: remover, só para item livre).
- Linhas: todos os **insumos estocáveis** + **produtos de revenda (manipulado = false)**, obtidos via `listInsumos()` + `admin_get_products({ p_only_manipulado_false: true })`.
- Ordenação: **Setor (ordem_exibicao)** → **Fornecedor (nome)** → **Nome do item**.
- Cabeçalhos de grupo visuais separando por setor (accordion não — só linha divisória com nome do setor sticky), e sub-cabeçalho por fornecedor dentro do setor.
- **Filtro por busca** aplica no nome; grupos vazios somem.
- Quantidade: input numérico com máscara pt-BR (`parseNumberInput`). Custo unitário editável (default = custo cadastrado), para permitir ajuste pontual.
- Subtotal recalcula em tempo real. Total no topo é a soma.

**Item livre**
- Botão `+ Adicionar item livre` no rodapé da tabela → insere uma linha editável (Nome, Setor, Fornecedor, Custo, Quantidade). Persistem só em memória; ao gerar a ordem viram `ref_id = null` como já é hoje.

---

## 2. Regra de submissão

Ao clicar `Gerar ordem`:
- Coleta todas as linhas (catálogo + livres) com `quantidade > 0`.
- Se nenhum fornecedor for definido por item, usa o fornecedor padrão do cabeçalho. Se o item catalogado tem fornecedor próprio, ele prevalece (mantém consistência).
- Chama `criarOrdemCompra` já existente. Sem mudança de schema.
- **Observação futura (não neste escopo):** hoje `ordens_compra` guarda apenas um `id_fornecedor`. Se a ordem misturar fornecedores diferentes, criamos **uma ordem por fornecedor** no mesmo submit (loop client-side em cima da RPC atual) para não perder informação. Toast lista os números gerados.

---

## 3. Imprimir e enviar PDF

Reaproveitar o framework de relatórios (`src/components/admin/reports/ReportShell.tsx`) para não reinventar layout:
- Novo componente `OrdemCompraReport.tsx` que renderiza o mesmo grid (agrupado por setor/fornecedor) no formato A4, com cabeçalho da empresa (nome, CNPJ, logo do branding), data/hora, usuário, total geral.
- `Imprimir` → `window.print()` com CSS `@page` A4 já usado nos relatórios.
- `Enviar PDF por WhatsApp` → gera PDF via `html2pdf.js` (ou `jspdf` + `html2canvas`, o que já estiver no projeto; caso nenhum esteja, adicionar `html2pdf.js`) e:
  - Se `navigator.canShare?.({ files: [pdf] })` → `navigator.share` com o arquivo (funciona em Android/Chrome/PWA).
  - Fallback desktop: baixa o PDF e abre `https://wa.me/?text=Segue%20a%20ordem%20de%20compra%20anexada.` numa nova aba com aviso "Anexe o arquivo baixado".

---

## 4. Arquivos afetados

- `src/components/admin/SugestaoComprasView.tsx` — reescrever o bloco `Dialog` manual; header/cards/lista de sugestão permanecem iguais.
- **Novo** `src/components/admin/OrdemCompraManualDialog.tsx` — encapsula todo o novo diálogo (busca, tabela agrupada, item livre, ações de topo, geração da ordem).
- **Novo** `src/components/admin/reports/OrdemCompraReport.tsx` — layout imprimível A4 usando `ReportShell`.
- **Novo** `src/lib/pdf-share.ts` — helper `printReport()` e `shareReportAsPdf(filename, node)` reutilizáveis.
- Se `html2pdf.js` não estiver instalado, adicionar como dependência.

## 5. Fora de escopo

- Alterar `ordens_compra` (schema).
- Mudar o restante da tela de Sugestão (cards, ordens recentes, gerar-por-grupo).
- Implementar envio de WhatsApp servidor-side (usamos share API do dispositivo).