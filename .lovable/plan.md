## O que muda

Adicionar um **terceiro botão** no cabeçalho da Sugestão de Compras: **"Gerar Ordem Consolidada por Setor"**. Ele funcionará como o "Gerar Ordem Manual/Avulsa" (abre o mesmo diálogo, com os itens já pré-carregados vindos da sugestão), mas ao salvar gera **UMA única ordem de compra** (sem quebrar por fornecedor), com os itens **ordenados por setor** e, dentro de cada setor, **por fornecedor**.

## Comportamento

- Botão fica ao lado dos outros dois:
  1. "Gerar Ordem Única (todos fornecedores)" (já existe)
  2. **"Gerar Ordem Consolidada por Setor"** (novo)
  3. "Gerar Ordem de Compra Manual / Avulsa" (já existe)
- Ao clicar, abre o `OrdemCompraManualDialog` já existente, em modo **pré-preenchido**:
  - Recebe uma nova prop opcional `preloadedItems` (montada a partir de `sugestao`).
  - O usuário pode revisar/ajustar quantidades e custos antes de confirmar.
- Ao salvar:
  - Gera **uma única** `ordens_compra` com `id_fornecedor = null` e `observacao = "Reposição consolidada — ordenada por setor"`.
  - Antes de mandar para `criarOrdemCompra`, os `itens` são **ordenados por `setor.ordem_exibicao` → `fornecedor.nome` → `nome`**, para que a impressão saia nessa ordem.
- No relatório impresso (`OrdemCompraReport`), a ordem dos itens vem naturalmente do array persistido — não precisa alterar o componente do relatório; apenas a coluna Setor e Fornecedor já existentes exibem a agregação.

## Arquivos alterados

- `src/components/admin/SugestaoComprasView.tsx`
  - Adicionar o novo botão no `header`.
  - Novo state `preloaded` + handler `abrirConsolidadaPorSetor()` que monta `preloadedItems` a partir de `sugestao` (com `setor_id`, `fornecedor_id`, `nome`, `unidade`, `custo_unitario`, `quantidade`, `tipo`, `ref_id`) já ordenados por setor→fornecedor→nome.
  - Passar `preloadedItems` para `<OrdemCompraManualDialog />`.
- `src/components/admin/OrdemCompraManualDialog.tsx`
  - Aceitar prop opcional `preloadedItems?: OrdemCompraItemInput[]` (com metadados de setor/fornecedor).
  - Ao abrir com preloaded, popular o carrinho inicial com esses itens (usando as linhas livres do próprio diálogo) e travar `id_fornecedor = null` na chamada de `criarOrdemCompra`.
  - Garantir que a ordenação por setor→fornecedor→nome seja preservada ao enviar.

## Fora do escopo

- Não altero o motor financeiro, RLS, RPCs de custo, `criarOrdemCompra`, nem `OrdemCompraReport`.
- Não mexo nos outros dois botões existentes.
- Sem migrações de banco.
