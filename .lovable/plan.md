## Problemas observados no PDF/print da Ordem de Compra

1. **Coluna "Setor" em branco (todos "—")**  
   Os itens vindos da Sugestão passam por `PreloadedOCItem → hidratação`. Quando o `ref_id` bate com o catálogo (`insumo:xxx` / `produto:xxx`), o item vai para `rowState` e o setor é lido de `r.source.setor_id`. Quando não bate, cai em `freeItems` e depende do `setor_id` que veio da sugestão. Em ambos os caminhos o relatório resolve o nome via `setorMap.get(...)?.setor ?? ""` — se o `setor_id` estiver `null` na origem (insumos/produtos sem setor cadastrado ou coluna não retornada) o relatório mostra "—".

2. **Última linha ("Caixa de pizza c/ 25") aparece duplicada abaixo do TOTAL GERAL**  
   Na verdade é a **página 2 do print**: quando o corpo da tabela transborda por uma linha, o navegador **repete o `<thead>` no topo da nova página** (comportamento padrão de `thead { display: table-header-group }`). Como o rótulo "Pág 1 / 1" está hard-coded no cabeçalho, o usuário vê o mesmo número em ambas as páginas e interpreta como duplicidade.

## O que muda

### `src/styles.css` (bloco `@media print`)
- Dentro de `body.printing-report`, forçar `.report-a4 thead { display: table-row-group; }` para **não repetir** o cabeçalho da tabela em cada página impressa. Isso elimina o "cabeçalho + 1 linha" no rodapé da página 2.
- Reduzir `.report-content { padding-top }` de 22mm para 18mm — o cabeçalho fixo real é ~16mm; a folga extra estava empurrando conteúdo para a página seguinte.

### `src/components/admin/reports/OrdemCompraReport.tsx`
- Substituir o texto estático `Pág 1 / 1` por paginação real via CSS: usar `<span class="report-pagenum-marker" />` cujo `::after` conteúdo em `@media print` seja `counter(page) " / " counter(pages)`. Fora do print, exibir apenas em branco (sem numeração fake).
- Reduzir levemente o espaçamento vertical do bloco de totais (`marginTop 16px → 10px`) e do grupo (`marginBottom 16px → 10px`) para diminuir a probabilidade de overflow com listas médias.
- Aceitar prop opcional `titulo` (default "Ordem de Compra — Sugestão") para permitir usos futuros; mudança compatível.

### `src/components/admin/OrdemCompraManualDialog.tsx` (rows do relatório)
- Fallback do setor: quando `setorMap.get(...)?.setor` for vazio para um item, tentar `fornMap`/nome de fornecedor não altera setor — em vez disso, exibir "—" apenas quando realmente não houver setor cadastrado, e adicionar um `title` no célula com aviso "Sem setor cadastrado no item".
- Corrigir a fonte do setor no caminho `freeItems`: propagar `setor_id` de `PreloadedOCItem` (já feito) e **também** guardar `unidade` da origem (hoje o free item força `"un"`, o que gera a discrepância "5" × "5 un" na tabela, evidenciando que rows vieram de fontes diferentes).

### `src/lib/estoque.ts` (verificação da origem)
- Garantir que `fetchSugestaoCompras` mantém `setor_id` real (já mantém para insumos e produtos). Nenhuma alteração se a query já retornar a coluna.

## Fora do escopo
- Não altero RPCs, RLS, motor financeiro nem `criar_ordem_compra`.
- Não mexo em `pdf-share.ts` nem no fluxo de WhatsApp.
- Sem migrações de banco.

## Como validar
1. Abrir Sugestão de Compras → "Gerar Ordem Única" (dentro do dialog).
2. Clicar Imprimir e conferir na pré-visualização:
   - Coluna Setor preenchida quando os itens tiverem setor cadastrado.
   - Sem cabeçalho + linha "solta" após TOTAL GERAL.
   - Numeração "Pág X / Y" refletindo o total real de páginas.
3. Repetir para "Baixar PDF" — o mesmo relatório é usado, o resultado deve ser consistente.