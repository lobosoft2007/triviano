## Situação atual (verificada)

- A flag que ativa o meio a meio é a coluna `categories.allows_half`.
- No banco, as duas categorias de Pizzas (`pizzas` e `pizzas-t99`) já estão com `allows_half = true`.
- A API pública `/rest/v1/categories` retorna corretamente `allows_half: true` para essas categorias (testado via anon key).
- O `ProductCustomizer` renderiza o checkbox "Pizza meio a meio" quando `!isAcai && category.allows_half` (`src/components/ProductCustomizer.tsx:382`).
- **Não existe nenhum toggle no /admin** para essa flag — hoje só dá pra mexer direto no banco. É por isso que "não achei onde reabilitar".

Ou seja: no banco está ligado, mas você não vê a opção no PWA. Antes de mudar código de UI, preciso confirmar por onde a pizza está sendo aberta hoje, porque tem dois caminhos de home no projeto (`index.tsx` clássico e `home-netflix.tsx`) — os dois usam a mesma flag, mas o modal do "netflix" tem uma etapa de pré-seleção que pode estar fechando antes de abrir o customizador.

## Plano

### 1. Diagnóstico rápido do "checkbox não aparece"

- Abrir o preview autenticado, entrar em uma pizza e inspecionar via DevTools:
  - confirmar qual componente abriu (Sheet do `ProductCustomizer` ou Dialog do `home-netflix`).
  - checar se `category.allows_half` chega como `true` no cliente (log temporário controlado, removido depois).
- Se o problema for cache do PWA (service worker antigo servindo menu sem `allows_half`), forçar reload / bump de versão.
- Se o problema for de fluxo (home-netflix abrindo direto no carrinho sem passar pelo customizador), corrigir o gatilho para respeitar `needsCustomization` que já inclui `allows_half`.

Sem alterar regra de negócio nem preço — só garantir que o checkbox volte a aparecer.

### 2. Adicionar controle no /admin (Categorias)

Fonte única de verdade para você não precisar mais me chamar:

- Em `src/components/admin/CategoriasCrud.tsx`, adicionar no editor de cada categoria:
  - Switch **"Permite pizza meio a meio"** → grava `categories.allows_half`.
  - (Bônus, mesmo dialog) Campo numérico **"Mínimo de itens"** → grava `categories.min_items` (útil pros Pastéis, que também não têm UI hoje).
- Persistência via update no Supabase, respeitando as policies já existentes de categorias.
- Sem migration — as colunas já existem.

### 3. Verificação

- Marcar/desmarcar o switch em `Pizzas` no /admin e confirmar que:
  - a lista de pizzas no PWA passa a mostrar/esconder o checkbox "Pizza meio a meio";
  - ao marcar meio a meio, a lista de segundo sabor aparece e o preço sai como média dos dois (comportamento já existente, só quero garantir que não regrediu).

## Fora do escopo

- Não mexer no cálculo de preço meio a meio, no cupom da cozinha, nem no combo Burger+Petisco.
- Não mexer em RLS/GRANT de `categories` (já validado que anon lê `allows_half`).