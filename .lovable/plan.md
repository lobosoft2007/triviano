## Objetivo

Permitir horários de funcionamento **por categoria**, com múltiplas janelas por dia da semana. Categoria fora do horário some do cardápio público. Quando **nenhuma** categoria está aberta, o PWA do cliente mostra "Loja fechada" com o próximo dia/horário de abertura.

Hoje não existe nada de horário nem no `empresas` nem em `categories`.

## 1. Banco (uma migração)

Nova tabela `public.category_horarios`:

- `id uuid pk`
- `categoria_id uuid` FK `categories.id ON DELETE CASCADE`
- `empresa_id uuid` (denormalizado p/ RLS rápida, preenchido por trigger a partir da categoria)
- `dia_semana smallint` 0–6 (0 = domingo, padrão JS `getDay()`)
- `hora_inicio time`, `hora_fim time`
- `created_at`, `updated_at`
- índice `(categoria_id, dia_semana)`

Regras: `hora_fim > hora_inicio` (janelas que cruzam a meia-noite viram duas linhas, uma até 23:59 e outra a partir de 00:00 no dia seguinte — mantém a lógica simples). **Sem linhas = categoria disponível 24/7** (compat retro com o cardápio atual).

`GRANT SELECT TO anon, authenticated` (para o cardápio público) + `GRANT ALL TO service_role`. RLS: SELECT público liberado (dado não-sensível), INSERT/UPDATE/DELETE restrito a `is_local_admin()` da mesma `empresa_id`.

**Timezone:** fixo `America/Sao_Paulo` (calculado em SQL via `timezone('America/Sao_Paulo', now())`). Multi-tenant é todo BR, então não precisa coluna por empresa neste primeiro corte.

## 2. Funções SQL

- `is_categoria_aberta(p_categoria_id uuid, p_at timestamptz default now()) returns boolean` — true se não há linhas OU alguma linha bate no `(dia_semana, hora)` local.
- **Ajustar `get_public_menu(p_empresa_id)`** para filtrar categorias fechadas via join com `category_horarios` (mantendo as sem horário). Categorias fechadas somem — assim o cardápio já vem pronto sem lógica no cliente.
- `get_next_opening(p_empresa_id uuid) returns table(dia_semana smallint, hora_inicio time, categoria_nome text)` — varre até 7 dias à frente e devolve o próximo slot de qualquer categoria da empresa; usada quando o cardápio volta vazio.

## 3. Backend TS (`src/lib/menu.ts` + novo helper)

- Tipo `MenuState = { categories, products, isClosed, nextOpening? }`.
- Chama `get_public_menu` + `get_next_opening` em paralelo. Se `categories.length === 0`, marca `isClosed = true` e devolve `nextOpening`.

## 4. Admin — `src/components/admin/CategoriasCrud.tsx`

- Novo botão "Horários" (ícone `Clock`) em cada categoria, abrindo modal `CategoriaHorariosDialog`:
  - Lista as 7 linhas de dia da semana.
  - Cada dia: switch **Fechado / Aberto** + botão "+ janela" para adicionar múltiplos intervalos (ex.: 11:00–15:00 e 18:00–23:00).
  - Ação "Copiar para os outros dias" para agilizar.
  - Salva chamando `upsertCategoryHorarios(categoria_id, linhas[])` (delete-all + insert em transação via RPC `admin_set_category_horarios`).
- Badge discreto no card da categoria quando tem restrição de horário.

## 5. PWA cliente — cardápio (`src/routes/_authenticated/menu.tsx` e/ou `home-netflix.tsx`)

- Quando `menu.isClosed`: substituir a grade por um card grande "Loja fechada no momento" + `nextOpening` formatado ("Reabre segunda-feira às 11:00") + CTA para abrir carrinho vazio desativado. Rotas de checkout já protegidas pelo carrinho vazio, mas adiciono um guard no `CartSheet` que impede checkout se todos os itens forem de categorias que fecharam entre a adição e o pagamento (revalida via `is_categoria_aberta` no `create_order`).
- Categorias com restrição podem ganhar uma tag "até 15:00" no header (opcional; incluído).

## 6. Guarda no pedido

- Em `create_order` (RPC existente), validar cada produto: se a categoria dele estiver fechada agora, aborta com mensagem "O item X só está disponível entre HH:MM e HH:MM." Evita brechas em quem deixou o carrinho aberto.

## 7. Fora do escopo

- Horário por produto individual (por enquanto só por categoria).
- Feriados/exceções pontuais.
- Timezone configurável por empresa (fixo em `America/Sao_Paulo` neste corte).
- Motor financeiro, meios de pagamento e webhook MP: não são tocados.
