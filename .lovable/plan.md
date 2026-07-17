
## Objetivo

Criar um módulo de **Relatórios** dentro do `/admin` com um framework reutilizável (cabeçalho, rodapé, filtros, seleção de colunas, totais, escolha de fonte) e implementar o primeiro relatório: **Relação de Clientes Cadastrados**. Todo relatório futuro seguirá esse mesmo padrão.

---

## 1. Framework de Relatórios (base reutilizável)

Vou criar uma infraestrutura enxuta em `src/lib/reports/` + `src/components/admin/reports/` para que os próximos relatórios entrem só declarando colunas + filtros + fonte de dados.

### Componentes/arquivos novos
- `src/components/admin/reports/ReportShell.tsx` — página do relatório: barra superior com filtros, seleção de colunas, escolha de fonte, botões **Visualizar**, **Imprimir/PDF** e **Exportar CSV**.
- `src/components/admin/reports/ReportPage.tsx` — renderização do relatório em formato A4 paginado (usa CSS `@page` e `print:` do Tailwind).
- `src/components/admin/reports/ReportHeader.tsx` — cabeçalho: logo da empresa à esquerda (usa `BrandLogo`), nome do relatório centralizado, "Pág X / Y" à direita, linha fina inferior.
- `src/components/admin/reports/ReportFooter.tsx` — rodapé: razão social (linha 1), endereço completo (linha 2), alinhados à esquerda, linha fina superior.
- `src/components/admin/reports/ColumnPicker.tsx` — popover com checkboxes por coluna (ordem preservada, persistida em `localStorage` por relatório).
- `src/components/admin/reports/FontPicker.tsx` — select com fontes seguras para impressão: **Inter, Outfit, Roboto, Georgia, Times New Roman, Arial, Courier New**, mais slider de tamanho (10-14pt).
- `src/lib/reports/types.ts` — tipos `ReportColumn<T>`, `ReportDefinition<T>`, helpers `sumMoney`, `countRows`, `formatCell`.
- `src/lib/reports/print.ts` — helper `printReport()` que dispara `window.print()` (fila do SO — coerente com a decisão já tomada de não fazer impressão direta).
- `src/lib/reports/csv.ts` — exportação CSV das colunas visíveis (nome do arquivo = slug do relatório + data).

### Paginação para impressão
- Cabeçalho e rodapé fixos por página via `position: running()` / repetição de `<thead>` na tabela, com contagem de páginas usando CSS `counter(page)` / `counter(pages)` dentro de `@page` — funciona no diálogo de impressão do Chrome/Edge.
- Layout A4 retrato por padrão (paisagem opcional quando > 6 colunas visíveis).

### Regras aplicáveis a TODOS os relatórios (padrão exigido)
1. **Cabeçalho**: logo (esq.) · título (centro) · "Pág X / Y" (dir.) + linha fina inferior.
2. **Filtros**: cada relatório declara seus filtros; o shell renderiza automaticamente.
3. **Inclusão/exclusão de colunas**: `ColumnPicker`, com preset "padrão" e persistência local.
4. **Totais monetários**: `ReportColumn.money = true` faz somar automaticamente e exibir no rodapé da tabela.
5. **Contagem de registros**: linha "Total de registros: N" no fim.
6. **Escolha de fonte**: `FontPicker` aplica `font-family` + tamanho no container do relatório (também no print).

---

## 2. Novo item no menu `/admin`

- Adicionar grupo **Relatórios** em `src/components/admin/AdminSidebar.tsx` com o primeiro item **Clientes cadastrados** (`aba = "rel-clientes"`).
- Editar `src/routes/_authenticated/admin.tsx` para renderizar `<RelatorioClientes />` quando `aba === "rel-clientes"`.
- Guard por permissão: usar a mesma flag do bloco "Clientes" (`canManageEmpresa` / permissão de admin) — sem nova flag na matriz.

---

## 3. Relatório: Relação de Clientes Cadastrados

### Fonte de dados
Reaproveita `fetchClientes()` de `src/lib/clientes.ts` (já existe). Sem query nova; empresa atual já isolada por RLS.

### Colunas disponíveis (todas selecionáveis, padrão marcado com ✅)
- ✅ Nome completo
- ✅ Telefone (DDD + número)
- E-mail (nova — carregar via `admin_list_clientes_emails` ou já disponível em `profiles`; se não estiver, marco esta coluna como "requer read adicional" e ficará como opcional condicional)
- CEP
- Logradouro completo (tipo + logradouro + número + complemento)
- Bairro
- ✅ Município / UF
- ✅ Cashback (R$) — **soma no rodapé**
- ✅ Saldo devedor fiado (R$) — **soma no rodapé**
- Limite fiado (R$) — **soma no rodapé**
- Fiado autorizado (Sim/Não)
- Bloqueado (Sim/Não)
- Data de cadastro

### Filtros
- **Busca** (nome / telefone / bairro / cidade) — mesmo comportamento de `ClientesView`.
- **Cidade** (multi-select das cidades presentes).
- **Bairro** (multi-select).
- **Status**: Todos / Ativos / Bloqueados.
- **Fiado**: Todos / Só autorizados / Só com saldo devedor > 0.
- **Cashback**: Todos / Só com saldo > 0.
- **Cadastrados entre** (data inicial / data final sobre `created_at`).
- **Ordenar por**: Nome (A-Z) · Cadastro (mais recente) · Saldo devedor (maior) · Cashback (maior).

### Totais no rodapé
- Total de registros: **N**.
- Soma de Cashback, Saldo devedor fiado, Limite fiado (só das colunas monetárias visíveis).

### Ações
- **Visualizar** (render inline paginado).
- **Imprimir / Salvar PDF** (`window.print()` — usa o "Salvar como PDF" do navegador).
- **Exportar CSV** (colunas visíveis, filtros aplicados).

---

## 4. Detalhes técnicos

- **Sem migrações de banco.** Puramente frontend + reuso de leituras existentes.
- **Empresa (para cabeçalho/rodapé)**: usar hook existente que carrega `empresas` do tenant atual (nome fantasia → título da barra, razão social + endereço → rodapé, `logo_url` → cabeçalho). Se algum campo estiver faltando, o rodapé cai em fallback (nome fantasia).
- **Impressão**: apenas CSS + `window.print()` (nada de WebUSB/serial, consistente com a decisão já tomada sobre impressão).
- **Persistência de preferências** (colunas visíveis, fonte, tamanho): `localStorage` por relatório (`report:<slug>:prefs`).
- **Sem alterações no motor financeiro, fiscal, RLS ou meios de pagamento.**

---

## 5. Ordem de execução

1. Criar `src/lib/reports/` (types, csv, print).
2. Criar componentes em `src/components/admin/reports/` (Shell, Page, Header, Footer, ColumnPicker, FontPicker).
3. Adicionar CSS de impressão (paginação A4 + `@page` counters) em `src/styles.css` sob `@media print`.
4. Criar `src/components/admin/reports/RelatorioClientes.tsx` declarando colunas + filtros + fonte de dados.
5. Adicionar item no `AdminSidebar` e branch de render em `admin.tsx`.
6. Smoke test: abrir no `/admin`, filtrar, alternar colunas, trocar fonte, imprimir (Salvar como PDF), exportar CSV.

---

## O que **não** faz parte deste plano
- Novos relatórios (vendas, produtos, financeiro) — virão em plano próprio reutilizando o framework.
- Agendamento/envio automático por e-mail.
- Geração de PDF server-side (ficará como opção futura se o `window.print()` do navegador não atender).
