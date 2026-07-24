## Contexto

Na rodada anterior implementei o backend do motor de estimativa (tabelas `linhas_producao`, `categoria_etapas_preparo`, `zonas_entrega`, colunas em `orders`, RPC `calcular_estimativa_pedido`) e a exibição no checkout + cupom. Porém a aba de administração descrita no plano original **não foi construída** — por isso não há onde cadastrar linhas, etapas nem zonas hoje. Vamos fechar essa lacuna.

## O que será construído (somente UI no /admin)

### 1. Nova aba "Tempos de Preparo" em `/admin`
Adicionar item na `AdminSidebar` e a rota/seção correspondente em `routes/_authenticated/admin.tsx`. A aba terá 3 blocos empilhados:

**a) Linhas de Produção** — `LinhasProducaoCrud.tsx`
- Lista/CRUD de `linhas_producao` (nome, ativo).
- Ex.: "Pizza", "Burger", "Açaí", "Bar".

**b) Zonas de Entrega** — `ZonasEntregaCrud.tsx`
- Lista/CRUD de `zonas_entrega` (nome, tempo_entrega_min, ativo).
- Nota explicando que zona sem escolha usa `empresas.tempo_entrega_padrao_min` (campo já existe; será exposto em `EmpresaConfigTab`).

**c) Etapas por Categoria** — integrado ao editor de categoria em `CategoriasCrud.tsx`
- No modal "Editar categoria" adiciono:
  - `Select` de **Linha de Produção** (`categories.linha_producao_id`).
  - Sub-editor `EtapasPreparoEditor.tsx`: lista de etapas ordenadas com `nome` + `duracao_min`, botões adicionar/remover/reordenar.
- Explicação curta: "gargalo = maior etapa; total = soma".

### 2. Campo "Tempo de entrega padrão" em `EmpresaConfigTab`
- Input numérico ligado a `empresas.tempo_entrega_padrao_min` (fallback quando o pedido não tem zona).

### 3. Camada de dados
- Extender `src/lib/erp.ts` (ou novo `src/lib/tempos-admin.ts`) com funções:
  `listLinhasProducao / saveLinhaProducao / deleteLinhaProducao`,
  `listZonasEntrega / saveZonaEntrega / deleteZonaEntrega`,
  `listEtapasCategoria / saveEtapasCategoria` (upsert em lote por categoria_id),
  ajuste em `saveCategory` para persistir `linha_producao_id`.
- Todas usam o cliente Supabase autenticado; RLS já criada na migração anterior (`can_manage_empresa`).

## Fora de escopo

- Nenhuma alteração no motor financeiro, no cálculo da RPC ou no cupom (já entregues).
- Sem novas migrações de banco — as tabelas já existem.
- Sem mudanças no PWA/checkout.

## Validação

1. Criar linha "Pizza" e "Burger" na nova aba.
2. Editar categoria "Pizzas": vincular à linha "Pizza" e cadastrar etapas (montagem 5, forno 15).
3. Criar zona "Centro" 15 min.
4. Fazer pedido no PWA e conferir a faixa exibida + linha "PREVISTO" no cupom.
