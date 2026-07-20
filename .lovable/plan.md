## O que muda

Adicionar um **segundo botão de salvar** dentro do próprio diálogo `OrdemCompraManualDialog` — **"Gerar Ordem Única"** — posicionado ao lado do botão atual **"Gerar ordem"** na barra de ação (topo do modal). Esse novo botão gera **uma única** Ordem de Compra, com todos os itens em uma só ordem, **ordenados por Setor → Fornecedor → Nome**.

O botão atual "Gerar ordem" continua igual (uma ordem por fornecedor).

## Comportamento

- Botão **"Gerar ordem"** (existente, verde): mantém a lógica atual — agrupa por fornecedor e cria N ordens.
- Botão **"Gerar Ordem Única"** (novo, ao lado): reutiliza a rotina consolidada já existente no arquivo (bloco `if (consolidatedMode)` do `handleSave`) para criar **uma única** `ordens_compra` com `id_fornecedor = null`, itens ordenados por `setor.ordem_exibicao` → `fornecedor.nome` → `nome`, `origem = "Manual"` e observação padrão "Ordem única — ordenada por setor/fornecedor" quando o campo estiver vazio.
- Ambos ficam desabilitados enquanto `totalItens === 0` ou `saving`.
- O botão novo aparece em **todos os usos** do diálogo (Sugestão de Compras e Ordem Manual/Avulsa direta) — o usuário escolhe no momento de salvar.

## Arquivos alterados

- `src/components/ui/modal-action-bar.tsx`
  - Adicionar props opcionais para uma **segunda ação de salvar** ao lado da principal: `onSecondarySave?: () => void`, `secondarySaveLabel?: string`, `secondarySaveDisabled?: boolean`, `secondarySaving?: boolean`.
  - Renderizar esse botão secundário logo antes do botão principal (variant `outline`), sem alterar comportamento quando as props não são passadas.
- `src/components/admin/OrdemCompraManualDialog.tsx`
  - Extrair a lógica de "salvar consolidada" do `handleSave` atual para uma função `handleSaveUnica()` que reaproveita o mesmo bloco (ordenação por setor→fornecedor→nome + `criarOrdemCompra` único com `id_fornecedor: null`).
  - Passar `onSecondarySave={handleSaveUnica}` e `secondarySaveLabel="Gerar Ordem Única"` ao `ModalActionBar`.
  - Manter a prop `consolidatedMode` existente (compatibilidade): quando `true`, o botão principal já usa o caminho consolidado — nesse caso o botão secundário fica oculto para não duplicar.
- `src/components/admin/SugestaoComprasView.tsx`
  - Sem mudança funcional. (Os 3 botões atuais continuam.)

## Fora do escopo

- Não altero `criarOrdemCompra`, RPCs, RLS, motor financeiro nem `OrdemCompraReport`.
- Não mexo em impressão, PDF ou WhatsApp.
- Sem migrações de banco.
