## Diagnóstico confirmado

O erro **"Não foi possível carregar os detalhes do item"** vem da função do front-end que monta a tela de edição do produto. Ela ainda faz leituras diretas em tabelas auxiliares do produto, principalmente:

- `produtos_addons`
- `produtos_free_addons`
- `ingredientes_produto`
- `produtos_price_options`
- `fichas_tecnicas`

A checagem no banco confirmou que algumas colunas dessas tabelas foram propositalmente bloqueadas para leitura direta, como `insumo_id`, `quantidade`, `price_option_id`, `preco_ifood` e metadados. Então o usuário pode ser Admin/Superadmin e ainda receber **403** se a tela tentar ler essas colunas por REST direto. Isso não quer dizer que o usuário não é admin; quer dizer que o caminho usado pela tela é o caminho errado para dados administrativos sensíveis.

## O que são os "detalhes do item"

São os dados que aparecem quando clica em editar um produto:

- dados principais do produto;
- opções de tamanho/preço;
- adicionais pagos;
- adicionais grátis;
- ficha técnica / ingredientes;
- metadados fiscal/estoque/custo;
- campos ligados ao modo **Manipulado / Revenda**.

A tela falha porque parte desses detalhes ainda tenta passar por leitura direta bloqueada.

## Plano de correção

### 1. Concentrar o carregamento do detalhe em RPC administrativa segura

Criar/ajustar uma função administrativa no banco para retornar, de uma vez, os detalhes necessários do produto para o Admin:

- produto base;
- opções de preço;
- adicionais pagos;
- adicionais grátis;
- ficha técnica;
- ingredientes;
- metadados fiscais e de custo.

Essa função deve:

- usar `SECURITY DEFINER`;
- permitir execução somente para usuários autenticados;
- validar internamente se o usuário pode administrar a empresa do produto;
- respeitar Superadmin;
- não liberar leitura pública nem ampliar `GRANT SELECT` nas tabelas sensíveis.

### 2. Trocar o carregamento do editor no front-end

Alterar `src/lib/erp.ts` para que `fetchProductDetail` pare de fazer `.from(...).select(...)` direto nessas tabelas auxiliares e passe a consumir a nova função administrativa.

Resultado esperado:

- ao clicar em editar, a tela não faz mais requisições REST diretas bloqueadas para essas colunas;
- o erro 403 do carregamento dos detalhes deve desaparecer;
- o editor continua recebendo todos os dados necessários.

### 3. Corrigir o fluxo de salvar Manipulado / Revenda

Revisar `saveProductDetail` para garantir que salvar `manipulado = false` não acione uma cadeia de recálculo ou leitura direta que ainda dependa de colunas bloqueadas.

A regra será:

- produto **Manipulado**: custo vem da ficha técnica;
- produto **Revenda / não manipulado**: custo vem de `custo_compra`;
- ao alternar para Revenda, o salvamento não deve tentar recalcular ficha técnica como se fosse produto manipulado.

### 4. Corrigir consultas auxiliares diretas de `products`

Substituir os pontos restantes em `src/lib/erp.ts` que ainda fazem leitura direta de `products` para validações administrativas por RPCs já existentes ou por consultas seguras equivalentes, especialmente em verificações de categoria/exclusão/listagem de revenda.

### 5. Não mexer no motor financeiro nem afrouxar segurança

Não serão feitas estas soluções arriscadas:

- não liberar `SELECT *` público ou amplo nas tabelas de produto;
- não criar policy `USING (true)`;
- não tornar dados de custo/estoque/ficha técnica públicos;
- não alterar triggers/RPCs financeiras;
- não mexer em pagamento, cashback, PIX, webhook ou fechamento de caixa.

### 6. Verificação final

Depois da implementação:

- abrir o editor de produto como usuário autenticado Admin/Superadmin;
- confirmar que o detalhe carrega sem 403;
- desmarcar **Manipulado / Preparado em casa**;
- salvar;
- reabrir o produto;
- confirmar que o campo permanece desmarcado;
- confirmar que o custo usado é `custo_compra`, não valor de venda;
- verificar que não há novas chamadas bloqueadas para as tabelas auxiliares de produto.

Se não houver sessão autenticada disponível no ambiente de teste, vou marcar explicitamente o caminho autenticado como **UNVERIFIED** e não afirmar que está corrigido até termos esse teste.