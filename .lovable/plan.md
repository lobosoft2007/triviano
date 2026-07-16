## Painel Resumo de Horários no /admin

Adicionar uma nova aba **"Horários"** no `/admin` que mostra, em uma única tela, todas as categorias do cardápio com suas janelas de funcionamento, status atual (aberta/fechada agora) e acesso rápido para editar.

### O que a aba mostra
- **Cabeçalho de status geral**: total de categorias, quantas estão abertas agora, quantas sem horário definido (24/7) e quantas fechadas.
- **Grade de cards** (uma por categoria), ordenada por nome, cada card contém:
  - Nome da categoria + ícone/emoji atual.
  - Badge de status: `Aberta agora` (verde) · `Fechada agora` (cinza) · `Sempre disponível` (âmbar, quando não há janelas).
  - Mini-grade **Dom–Sáb** (7 colunas) com as janelas de horário do dia. Dias sem janela ficam apagados com "—".
  - Botão **"Editar horários"** que abre o mesmo `CategoriaHorariosDialog` já existente.
- **Filtros no topo**: busca por nome + toggle "Só abertas agora" / "Só fechadas" / "Sem restrição".

### Como funciona
- Reusa `listCategoryHorarios` e `CategoriaHorariosDialog` — sem SQL novo.
- Faz **1 query agregada** em `category_horarios` (todas categorias da empresa em uma chamada) + lê categorias já em cache do admin (mesma fonte que `CategoriasCrud`).
- Status "aberta agora" calculado no cliente comparando `dia_semana`/`hora_inicio`/`hora_fim` com `new Date()`, atualizado a cada 60s.
- Após salvar no dialog, `queryClient.invalidateQueries` refaz o resumo.

### Permissão
- Aba usa a mesma flag de `categorias`: `acesso_cadastro_produtos` (staff com essa permissão acessa; master também).

### Arquivos a criar/editar
- **Novo**: `src/components/admin/HorariosResumoTab.tsx` — componente da aba (query, filtros, cards, dialog reutilizado).
- **Editar**: `src/routes/_authenticated/admin.tsx`
  - Adicionar `"horarios"` ao tipo `AdminTab`.
  - Entrada em `TABS` (após "categorias"): `{ key: "horarios", label: "Horários", icon: Clock }`.
  - Entrada em `TAB_FLAG`: `horarios: "acesso_cadastro_produtos"`.
  - Render do `<HorariosResumoTab />` no switch de conteúdo.
- **Editar**: `src/components/admin/AdminSidebar.tsx` (se listar tabs explicitamente) — verificar e incluir; caso ele leia de `TABS` centralizadas, nada a mudar.

### Detalhes técnicos
- Query única: `supabase.from("category_horarios").select("categoria_id, dia_semana, hora_inicio, hora_fim").in("categoria_id", ids)` agrupada por categoria em memória.
- Cálculo de "aberta agora" respeita janelas que cruzam meia-noite (ex.: 22:00–02:00) dividindo em dois intervalos.
- Layout responsivo: grid `md:grid-cols-2 xl:grid-cols-3`, dentro do padrão `AppShell` já usado no admin. Nenhum token de cor hardcoded.

### Fora do escopo
- Edição em lote de horários (só via dialog existente, uma categoria por vez).
- Horários por produto individual.
- Alterações no PWA cliente.