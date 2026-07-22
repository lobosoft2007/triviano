## Diagnóstico

A funcionalidade **existe no banco e no PWA**, mas está escondida:

- **Backend:** tabela `ingredientes_produto` já tem a coluna `permitir_exclusao` (boolean). O menu público (`src/lib/menu.ts`) já lê `permitir_exclusao = true` e monta a lista `removable_ingredients` de cada produto.
- **PWA:** o `ProductCustomizer` já renderiza a seção **"Deseja remover algum ingrediente?"** — mas **só aparece se houver pelo menos um ingrediente marcado como removível** para o produto. Como nenhum produto tem essa flag ligada hoje, a seção nunca aparece.
- **Admin:** o toggle existe, mas está enterrado dentro da tabela da **Ficha Técnica** (`FichaTecnicaEditor.tsx`), como um pequeno checkbox chamado "Cliente remove" na coluna "Remoção". Além de invisível na prática, ele exige entender ficha técnica (insumos/subprodutos, unidades, CMV) só para dizer "cliente pode pedir sem tomate". Por isso o admin não encontra e o cliente nunca vê.

## O que vou fazer

Criar uma **seção dedicada e óbvia** no formulário do produto no `/admin`, separada da ficha técnica, chamada **"Ingredientes que o cliente pode remover"**, e garantir que o PWA use exatamente essa lista.

### 1. Nova seção no formulário do produto (Admin)

No editor de produto (`src/routes/_authenticated/admin.tsx` + provavelmente um novo `src/components/admin/RemovableIngredientsEditor.tsx`), adicionar um bloco visível acima/abaixo dos adicionais, com:

- Título claro: **"Ingredientes que o cliente pode remover"**
- Subtítulo explicativo: *"Ex.: Tomate, Cebola, Picles. O cliente verá 'Sem tomate' no PWA ao personalizar o pedido."*
- Lista de chips com nome de cada ingrediente removível + botão "Adicionar ingrediente" (input simples de texto).
- Cada linha tem um "X" para remover.
- Botão auxiliar **"Importar da Ficha Técnica"**: preenche automaticamente com os insumos/subprodutos já cadastrados na ficha, para o admin só marcar quais quer expor.

### 2. Persistência

- Salvar/atualizar em `ingredientes_produto` com `permitir_exclusao = true` (mesma tabela e mesma coluna que o PWA já lê — nada muda no schema).
- Entradas criadas por essa seção usam `tipo = 'removivel_cliente'` (ou similar) para não conflitar com a ficha técnica quando ela também alimenta a tabela; se hoje só existir uma linha por ingrediente, faço um upsert por `(product_id, nome)`.
- Manter compatibilidade: a checkbox atual dentro da Ficha Técnica continua funcionando; as duas fontes convergem para a mesma coluna.

### 3. Ajuste na Ficha Técnica

- Manter o checkbox existente, mas renomear a coluna para **"Cliente pode remover"** e adicionar tooltip explicando que também aparece na nova seção dedicada.

### 4. PWA

- Nenhuma mudança de lógica necessária (`ProductCustomizer` já mostra a seção quando `removable_ingredients` tem itens).
- Confirmar visualmente que, após marcar "Tomate" como removível em um Hambúrguer, a seção aparece com o botão "Sem Tomate" no PWA.

### 5. Validação

- Cadastrar 2 ingredientes removíveis em um produto de teste no `/admin`.
- Abrir o produto no PWA e confirmar a seção "Deseja remover algum ingrediente?".
- Enviar o pedido e conferir que as remoções aparecem no carrinho, checkout, cupom da cozinha e no `/caixa`.

## Fora do escopo

- Nenhuma alteração de schema (a coluna já existe).
- Nenhuma alteração no motor financeiro, RLS ou preços.
- Nenhuma mudança na lógica de adicionais pagos/grátis.
