Plano para corrigir definitivamente a quebra de página do relatório de Ordem de Compra:

1. Ajustar o `ReportShell` para impressão real em A4
- Transformar o relatório em uma tabela principal de impressão, com cabeçalho no `<thead>` e rodapé no `<tfoot>`.
- Manter as colunas/linhas dentro do `<tbody>`, permitindo que o navegador quebre automaticamente em várias páginas.
- Remover qualquer dependência de altura de tela, scroll ou container do diálogo durante a impressão.

2. Garantir cabeçalho e rodapé em todas as páginas
- Colocar o cabeçalho visual do relatório dentro do grupo de cabeçalho da tabela de impressão.
- Colocar o rodapé da empresa dentro do grupo de rodapé da tabela de impressão.
- Usar `display: table-header-group` e `display: table-footer-group` no CSS de impressão.

3. Corrigir tamanho do papel e paginação
- Definir `@page` como A4 retrato ou paisagem conforme a opção escolhida no relatório.
- Garantir margens compatíveis com o cabeçalho/rodapé e sem cortes.
- Remover o contador fixo `Pág 1 / 1` da área impressa e deixar a paginação do navegador/print assumir o contador correto.

4. Neutralizar wrappers que impedem quebra de página
- No `@media print`, tornar `DialogContent`, overlays, `AppShell`, `ShellBody` e demais ancestrais relevantes como fluxo normal, sem `position: fixed`, `height: 100dvh`, `overflow: hidden/auto` ou `transform`.
- Imprimir apenas `.report-a4`, mas sem prender o relatório dentro de uma “janela” de uma página.

5. Validar com ordem grande
- Testar uma ordem com dezenas de itens para confirmar que gera múltiplas páginas.
- Confirmar que cada página tem cabeçalho, rodapé e que os itens não ficam cortados entre páginas.
- Confirmar que Setor e Fornecedor continuam aparecendo após a correção anterior.