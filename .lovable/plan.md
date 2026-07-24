## Problema

No editor de categoria (`CategoriasCrud.tsx`), ao rolar o formulário longo (nome, cor, tamanho, meio-a-meio, mínimo, linha de produção, etapas, prévia), o botão **Salvar** desaparece porque:

- O `ModalActionBar` usa `sticky top-0`, mas **sticky só funciona se existir um ancestral com scroll**.
- O `DialogContent` atual (`src/components/ui/dialog.tsx`) não define `max-height` nem `overflow`. Quando o conteúdo excede a viewport, o modal inteiro é empurrado para fora (está `fixed top-50% translate -50%`), o topo é clipado, e o "sticky" não tem onde grudar.

## Abordagem

Fazer o próprio `DialogContent` do editor virar o container de scroll, com altura máxima limitada. Assim o `ModalActionBar` (que já é `sticky top-0 -mx-6 -mt-6`) fica realmente fixado no topo enquanto só o corpo rola.

Mudança pontual — apenas no `<DialogContent>` do editor de categoria, sem tocar no componente `dialog.tsx` global (evita regressão em outros modais).

## Alterações

**`src/components/admin/CategoriasCrud.tsx`** (uma linha, no `<DialogContent>` do editor):

- Adicionar `max-h-[90dvh] overflow-y-auto` à className.
- Resultado: `className="max-w-md max-h-[90dvh] overflow-y-auto"`.

Isso é suficiente para que:
1. O modal nunca ultrapasse 90% da altura da viewport.
2. O corpo role internamente.
3. O `ModalActionBar` (Voltar + Salvar) fique visível no topo o tempo todo, em qualquer altura de tela.

## Verificação

- Abrir uma categoria existente (ex.: Pizzas) no `/admin` → Categorias.
- Rolar até o final (etapas de preparo + prévia).
- Confirmar que o botão **Salvar** continua visível no topo durante todo o scroll.
- Testar em viewport pequena (mobile ~700px de altura) e desktop.

## Fora de escopo

Não alterar `src/components/ui/dialog.tsx` nem outros modais nesta rodada. Se o mesmo padrão for necessário em outros editores longos, aplicar o mesmo par de classes pontualmente ou promover para o `DialogContent` num plano separado.
