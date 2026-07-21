## Diagnóstico

**1) "Pág 0 / 0"** — o contador está dentro de `.report-header`, que em impressão é `position: fixed`. No Chromium, `counter(page)`/`counter(pages)` dentro de elemento `position: fixed` avalia como **0**. Por isso aparece "Pág 0 / 0" em toda página.

**2) Só imprime a 1ª página** — no `@media print` a regra atual força `.report-a4 { position: absolute; top: 0 }`. Elementos posicionados absolutamente **não paginam**: o navegador desenha o bloco todo e recorta na quebra da 1ª página, cortando as páginas 2 e 3. É por isso que 46 itens saem só até a 1ª folha.

**3) Setor em branco** — em `OrdemCompraManualDialog.tsx` a coluna Setor é resolvida via `setorMap.get(setor_id)?.setor` — tanto no ramo do catálogo (`selectedRows`) quanto nos itens livres (preload da Sugestão). Basta o `setorMap` estar vazio no instante em que o `reportRows` é gerado (query `erp-setores` ainda hidratando, ou a instância desse `useQuery` no diálogo montada tarde) para todas as células ficarem "—". Precisamos parar de depender do `setorMap` no relatório: o nome do setor já vem da fonte e deve ser carregado direto.

## Correções

### A. Paginação real no cabeçalho (`src/styles.css`)

Substituir o esquema de header/footer `position: fixed` + `counter(page)` interno por **@page margin boxes**, que são o mecanismo padrão para número de página:

```css
@media print {
  body.printing-report {
    /* nada de fixed: o cabeçalho vai como “running header” do @page */
  }

  @page {
    /* já vem de printReport() com size + margens; adicionamos: */
    @top-right {
      content: "Pág " counter(page) " / " counter(pages);
      font: 10pt "Inter", sans-serif;
      color: #555;
    }
  }

  /* .report-a4 volta a fluir naturalmente */
  body.printing-report .report-a4 {
    position: static;      /* <- ESSENCIAL para paginar */
    width: 100%;
    color: #000;
    background: #fff;
  }

  /* header/footer deixam de ser fixed; renderizam uma vez no fluxo */
  body.printing-report .report-header,
  body.printing-report .report-footer {
    position: static;
  }

  /* Sem padding-top/bottom de reserva (não há mais fixed cobrindo) */
  body.printing-report .report-content {
    padding-top: 0;
    padding-bottom: 0;
  }
}
```

Também esconder o `.report-pagenum` do JSX na impressão (deixa de ser fonte da numeração):

```css
body.printing-report .report-pagenum { display: none; }
```

### B. Estender o `@page` gerado pelo `printReport` (`src/lib/reports/types.ts`)

Injetar o mesmo `@top-right` no `<style>` dinâmico (fica junto do `@page { size: A4 ... }` que já é criado por chamada). Assim, mesmo trocando orientação, o contador reaparece.

### C. Setor sempre presente (`OrdemCompraManualDialog.tsx`)

Parar de resolver setor/fornecedor via `setorMap`/`fornMap` na geração de `reportRows`:

1. Ampliar `FreeItem` para carregar `setor_nome` e `fornecedor_nome` já resolvidos no momento da hidratação (o dialog tem `setores`/`fornecedores` — se estiverem vazios no primeiro tick, o efeito de preload continua reagindo às queries; adicionar `setores`/`fornecedores` às dependências do preload).
2. Ampliar `PreloadedOCItem` (opcional) com `setor_nome` e `fornecedor_nome`. `SugestaoComprasView` já tem os dois maps e passa direto.
3. Em `reportRows`:
   - free item → usar `f.setor_nome` (fallback `setorMap.get(...)`).
   - catalog item → manter `setorMap`, mas com o mesmo fallback via `PreloadedOCItem` se o item veio da Sugestão (guardar num `Map<catalogKey, setor_nome>` construído no preload).

Assim o relatório fica imune a race das queries `erp-setores` / `erp-fornecedores`.

### D. Verificação

Após aplicar, imprimir a Ordem Consolidada com 46 itens e conferir via preview de impressão do navegador:

- 3 páginas geradas (46 itens no A4 paisagem).
- Cabeçalho mostra "Pág 1 / 3", "Pág 2 / 3", "Pág 3 / 3".
- Coluna "Setor" preenchida em todas as linhas.
- Sem duplicação de thead nem overflow em Retrato.

## Arquivos afetados

- `src/styles.css` — bloco `@media print` do relatório A4.
- `src/lib/reports/types.ts` — `printReport` injeta `@top-right`.
- `src/components/admin/OrdemCompraReport.tsx` — remover o span `.report-pagenum` (ou apenas ocultar via CSS já feito em A).
- `src/components/admin/OrdemCompraManualDialog.tsx` — `FreeItem` + `PreloadedOCItem` + preload + `reportRows`.
- `src/components/admin/SugestaoComprasView.tsx` — preencher `setor_nome`/`fornecedor_nome` ao montar `PreloadedOCItem`.
