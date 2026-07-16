## Problema
No Caixa, o modal "Finalizar e Receber" (`ComandaPaymentDialog.tsx`) está com scroll horizontal — os valores (ex.: `formatBRL`) estão sendo cortados. Causa provável: o modal usa `max-w-md` (≈ 28rem) e a linha "Adicionar pagamento" empilha `select` + `Input` (`w-28`) + botão `+` num único flex-row, sem permitir wrap; e as linhas de resumo/drafts têm valores tabulares longos disputando espaço.

## Ajustes propostos (apenas UI em `ComandaPaymentDialog.tsx`)

1. **Alargar o Dialog**: trocar `max-w-md` por `max-w-lg` (mantém encaixe em mobile via `w-[95vw]` implícito do `DialogContent`). Isso já elimina a maior parte do overflow.

2. **Linha "Adicionar pagamento" mais tolerante**:
   - Envolver select+input+botão em `flex flex-wrap gap-2` (ou grid `grid-cols-[1fr_auto_auto]`) para que em telas estreitas o input caia para baixo em vez de estourar.
   - Trocar `w-28` do `Input` por `w-24 min-w-0` e adicionar `min-w-0` no `select` para permitir shrink real (sem `min-w-0`, flex children não encolhem abaixo do conteúdo, gerando scroll horizontal).

3. **Linhas de drafts e resumo**:
   - Adicionar `min-w-0` nos containers e `truncate` no nome do meio de pagamento (`d.meio_nome`) para valores longos não empurrarem o total.
   - Garantir `tabular-nums` já presente + `whitespace-nowrap` nos valores.

4. **Header (ModalActionBar)**: título "Finalizar e Receber · Mesa N" pode ficar longo — se necessário, aplicar `truncate` no title (verificar se o componente já suporta; se não, apenas manter o alargamento do dialog resolve).

## Escopo
- Um único arquivo tocado: `src/components/caixa/ComandaPaymentDialog.tsx`.
- Sem mudanças de lógica financeira, split, PIX ou queries.
- Sem mudanças no `ModalActionBar` a menos que o title continue truncando após alargar.

## Validação
- Abrir modal em viewport 375px e 768px, conferir ausência de scroll horizontal e valores íntegros.
