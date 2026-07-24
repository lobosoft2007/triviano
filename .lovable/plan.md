## Diagnóstico

Você acertou o modelo mental: **linha de produção = funcionário/estação que trabalha em paralelo**. 1 funcionário = 1 linha (tudo enfileira). 2 funcionários = 2 linhas (pizza e burger preparam ao mesmo tempo). Isso é exatamente o que o motor `calcular_estimativa_pedido` já faz — soma etapas dentro da mesma linha (fila) e pega o **máximo** entre linhas diferentes (paralelo).

Como as **etapas variam por categoria** (pizza tem "montar + forno", burger tem "chapa + montagem"), elas continuam morando dentro da categoria. O que muda é só o **enquadramento visual e textual** para bater com sua narrativa.

## Alterações (só UI/copy, sem mexer no motor nem no banco)

**1. `src/components/admin/TemposPreparoTab.tsx`**
- Renomear título da aba/seção: **"Linhas de Produção"** (ícone `Layers3` no lugar de `Clock`).
- Reescrever o parágrafo introdutório com o modelo mental novo:
  > "Cada linha de produção representa um funcionário/estação que trabalha em paralelo. Com 1 funcionário, use 1 linha para tudo (a cozinha faz um item de cada vez). Com 2 funcionários, crie 2 linhas (ex.: Pizza e Burger) e distribua as categorias — elas preparam simultaneamente. O tempo de cada etapa é definido dentro de cada categoria."
- Manter o card **Tempo de entrega padrão** e **Zonas de entrega** nessa mesma aba (continuam fazendo sentido aqui — são configurações de tempo global da operação).

**2. `src/components/admin/AdminSidebar.tsx` e `src/routes/_authenticated/admin.tsx`**
- Renomear o item de menu de "Tempos de Preparo" para **"Linhas de Produção"**. Manter a mesma rota/aba (só o label muda).

**3. `src/components/admin/LinhasProducaoCrud.tsx`**
- Ajustar o parágrafo auxiliar para reforçar a analogia:
  > "Cada linha = um funcionário/estação em paralelo. Categorias na mesma linha formam fila; categorias em linhas diferentes preparam ao mesmo tempo."

**4. `src/components/admin/CategoriasCrud.tsx`** (editor de categoria)
- Adicionar uma pequena legenda acima do bloco de etapas explicando:
  > "Estas etapas somam o tempo de preparo desta categoria dentro da linha de produção escolhida acima."
- Reforça que o operador entende: **linha = onde**, **etapas = quanto tempo**.

## Fora de escopo

- Não mover etapas para dentro da linha (mantemos etapa por categoria — é onde a granularidade faz sentido, como discutido).
- Não mexer em `calcular_estimativa_pedido`, `linhas_producao`, `categoria_etapas_preparo`, `zonas_entrega` nem em nenhuma RPC/tabela.
- Não mexer no editor de etapas em si (`EtapasPreparoEditor.tsx`) — só a legenda ao redor dele.

## Verificação

- Abrir `/admin` → item de menu agora se chama **Linhas de Produção**.
- Abrir a aba: título, ícone e texto refletem o modelo "linha = funcionário paralelo".
- Abrir uma categoria (ex.: Pizzas) → o seletor de linha e o editor de etapas continuam funcionando exatamente como hoje, com a nova legenda explicativa.
