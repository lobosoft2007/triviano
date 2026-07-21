Você tem razão em cobrar: o problema não é a ordem de compra em si, é estrutural no motor de impressão A4. Pelos arquivos lidos e pelos prints, o relatório está sendo impresso ainda preso ao contexto do diálogo/app e herdando regras conflitantes de impressão. Isso faz o navegador gerar 3 páginas, mas renderizar o conteúdo deslocado/cortado, sem respeitar corretamente a área A4, cabeçalho e rodapé.

Plano de correção definitiva:

1. Separar impressão A4 da impressão térmica
- Hoje existe uma regra global de `@media print` que começa escondendo tudo e define `@page` para cupom 80mm.
- Vou isolar o modo A4 para que, quando `body.printing-report` estiver ativo, ele use apenas regras A4 e não herde o comportamento do cupom térmico.
- Resultado esperado: PDF A4 real, sem largura de 80mm, sem deslocamento lateral e sem área cortada.

2. Tirar o relatório do fluxo visual do Dialog somente na hora de imprimir
- O conteúdo continuará aparecendo no modal normalmente na tela.
- Para imprimir/PDF, criarei uma cópia limpa do relatório em um host temporário direto no `body`, fora do `DialogContent`, overlay, AppShell e containers com `overflow/position/transform`.
- Resultado esperado: o navegador pagina o relatório como documento normal, não como conteúdo dentro de uma janela modal.

3. Ajustar o layout A4 com dimensões conservadoras
- Usar A4 como padrão.
- Definir largura útil fixa por orientação:
  - Retrato: área útil compatível com A4 menos margens.
  - Paisagem: área útil compatível com A4 paisagem menos margens.
- Remover dependência de `max-width` visual e impedir que a tabela ultrapasse a página.
- Reduzir espaçamento/colunas no relatório de ordem quando necessário, com quebra de texto em Item/Setor/Fornecedor.
- Resultado esperado: nenhuma coluna cortada no lado esquerdo/direito.

4. Cabeçalho e rodapé repetidos por página
- Manter o padrão correto com `<thead>` e `<tfoot>` no `ReportShell`.
- Garantir CSS de impressão específico para `display: table-header-group` e `display: table-footer-group` no host limpo de impressão.
- Remover o contador fixo `Pág 1 / 1` do cabeçalho visual impresso; se o navegador suportar contador de página, ele fica na margem; se não suportar, não exibiremos número errado.
- Resultado esperado: cabeçalho e rodapé aparecem em todas as páginas sem sobrepor os dados.

5. Corrigir quebras de linha e de página nas linhas da tabela
- Evitar `break-inside: avoid` em excesso quando isso impede paginação normal em tabelas longas.
- Aplicar somente proteção mínima para não cortar uma linha individual no meio.
- Definir `white-space`, `overflow-wrap` e larguras de coluna para que textos longos não empurrem a tabela para fora.
- Resultado esperado: 46 itens ocupam múltiplas páginas, sem cortar linhas nem repetir blocos fora do lugar.

6. Validar antes de entregar
- Vou validar com Playwright gerando PDF A4 de um relatório grande.
- Conferir número de páginas do PDF e inspecionar visualmente as páginas convertidas em imagem.
- Só vou considerar concluído se as páginas não estiverem cortadas e se cabeçalho/rodapé estiverem corretos.

Arquivos previstos:
- `src/lib/reports/types.ts`: ajustar `printReport` para criar host limpo de impressão e aplicar regra A4 isolada.
- `src/styles.css`: separar regras A4 das regras do cupom térmico e remover conflitos de print.
- `src/components/admin/reports/ReportShell.tsx`: pequenos ajustes de marcação/classes se necessário para o clone limpo e paginação.
- `src/components/admin/reports/RelatorioOrdemCompra.tsx`: ajustar larguras/quebras de coluna da ordem de compra para caber em A4.

Critério de aceite:
- PDF da ordem de compra com dezenas de itens gera múltiplas páginas completas.
- Nenhuma página fica deslocada/cortada como nos prints enviados.
- Cabeçalho e rodapé aparecem em todas as páginas.
- O relatório continua funcionando no modal, CSV e impressão/PDF.