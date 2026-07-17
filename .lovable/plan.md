## Objetivo
Adicionar no menu **Relatórios** do `/admin` uma aba **"Assistente de Relatórios (IA)"** que conversa com o usuário e gera relatórios dinâmicos (tabela + gráfico) sobre **Clientes**, **Vendas/Pedidos** e **Estoque/Produtos**, reaproveitando o framework `ReportShell` (cabeçalho, rodapé, orientação, impressão, CSV). Permite **salvar** o relatório gerado para reutilizar.

## Arquitetura (segurança primeiro)

A IA **não gera SQL**. Ela devolve um JSON `ReportSpec` estruturado que o back-end valida e executa contra fontes whitelisted, sempre respeitando RLS/multi-tenant.

### 1. Contrato `ReportSpec` — `src/lib/reports/spec.ts`
```ts
type ReportSpec = {
  title: string;
  dataSource: "clientes" | "vendas" | "produtos_estoque";
  filters: { field: string; op: "eq"|"neq"|"gte"|"lte"|"between"|"in"|"like"|"is_null"|"not_null"; value: unknown }[];
  columns: { key: string; label: string; agg?: "sum"|"count"|"avg"|"min"|"max"; money?: boolean }[];
  groupBy?: string[];
  orderBy?: { field: string; dir: "asc"|"desc" }[];
  limit?: number;                                    // default 500, hard cap 5000
  chart?: { type: "bar"|"line"|"pie"|"area"; x: string; y: string; series?: string } | null;
  orientation?: "portrait" | "landscape";
};
```

Schema Zod estrito no back (server-side). Campos fora da whitelist da fonte → 400.

### 2. Catálogo de fontes — `src/lib/reports/datasources.ts` (client-safe types + labels)
Cada fonte declara: `fields` (nome, tipo, filtrável, agregável, agrupável) e `defaultOrder`. Exemplos:
- **clientes**: id, nome, telefone, cidade, bairro, cashback, saldo_devedor_fiado, limite_fiado, bloqueado, created_at.
- **vendas**: order_id, created_at, canal, status, total, meio_pagamento, cidade_entrega, bairro_entrega, item_categoria, item_nome, item_qtd, item_subtotal.
- **produtos_estoque**: produto_id, nome, categoria, setor, estoque_atual, custo_unit, giro_30d, ultima_venda, ativo.

### 3. Server function de execução — `src/lib/reports/reports.functions.ts`
`runReportQuery({ spec })` com `requireSupabaseAuth`:
1. Valida `spec` com Zod.
2. Para cada `filter`/`column`/`groupBy`/`orderBy`, verifica contra a whitelist da fonte; sem `select *`, sem operadores fora da lista.
3. Constrói a query Supabase **por fonte** (funções separadas `queryClientes`, `queryVendas`, `queryProdutosEstoque`) — nada de query builder genérico com nomes vindos do JSON aplicados a tabelas arbitrárias.
4. RLS ativa pela sessão do admin (`can_manage_empresa`) → isolamento por franquia garantido pelo próprio banco.
5. Retorna `{ rows, totals, meta: { columnsUsed, spec } }`.

### 4. Server function de IA — `src/lib/reports/reports-ai.functions.ts`
`generateReportSpec({ prompt, history, previousSpec? })` com `requireSupabaseAuth`:
- AI Gateway via helper `createLovableAiGatewayProvider` em `src/lib/ai-gateway.server.ts` (novo), com `structuredOutputs: true`.
- Modelo default: `openai/gpt-5.5`.
- `generateText` + `Output.object({ schema: ReportSpecSchema })` — schema pequeno, sem `.min/.max` (limites vão no prompt e são clampados no back).
- **System prompt** injeta:
  - Regras do framework (A4, moeda BRL, orientação, colunas, gráficos suportados).
  - Catálogo de fontes com campos permitidos, tipos e agregações.
  - Exemplos few-shot (3 prompts→specs).
  - Regra: se pedido for ambíguo ou fora do catálogo, devolver `{ title: "", dataSource: ..., filters: [], columns: [], _clarify: "pergunta" }` (campo `_clarify` fica no `title` para simplicidade).
- Guard `NoObjectGeneratedError` → tenta parsear `error.text`, senão devolve mensagem legível.
- Surfaça 429/402 explicitamente.
- **Não** persiste histórico (chat vive só no navegador).

### 5. Salvar relatórios — nova tabela + CRUD
Migração:
```sql
CREATE TABLE public.relatorios_salvos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default current_empresa_id() references empresas(id) on delete cascade,
  criado_por uuid not null references auth.users(id),
  nome text not null,
  descricao text,
  spec jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_salvos TO authenticated;
GRANT ALL ON public.relatorios_salvos TO service_role;
ALTER TABLE public.relatorios_salvos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage by empresa" ON public.relatorios_salvos
  FOR ALL TO authenticated
  USING (can_manage_empresa(empresa_id))
  WITH CHECK (can_manage_empresa(empresa_id));
```
Server functions: `listRelatoriosSalvos`, `createRelatorioSalvo`, `updateRelatorioSalvo`, `deleteRelatorioSalvo` — todas com `requireSupabaseAuth`.

### 6. UI

**Menu (`AdminSidebar`)**, grupo Relatórios, novo item:
- **Assistente de Relatórios (IA)** → aba `rel-chat`
- **Meus Relatórios** → aba `rel-salvos` (lista salva com botão "Abrir")

**Nova página `RelatorioChatIA.tsx`** — layout split:
- **Esquerda (35%)** — chat com AI Elements:
  - `Conversation` / `Message` / `MessageResponse` / `PromptInput` / `Shimmer`.
  - Uma conversa por vez, mensagens em `localStorage` (`report-chat:messages`).
  - Botão "Nova conversa" limpa localStorage.
  - Textarea sempre focada.
- **Direita (65%)** — preview:
  - `ReportSpecRunner` (novo) chama `runReportQuery`, monta colunas dinâmicas e renderiza dentro do `ReportShell` + `ChartRenderer` (Recharts, novo).
  - Toolbar do Shell mantém: colunas, fonte, retrato/paisagem, CSV, Imprimir/PDF.
  - Botão extra "Salvar este relatório" → dialog com nome/descrição → grava em `relatorios_salvos`.

**Nova página `MeusRelatorios.tsx`**:
- Grid de cards (nome, descrição, data, autor).
- Ações: Abrir (renderiza no `ReportSpecRunner`), Renomear, Excluir.

**Novos componentes reutilizáveis:**
- `src/components/admin/reports/ChartRenderer.tsx` — Recharts BarChart/LineChart/PieChart/AreaChart baseado em `spec.chart`.
- `src/components/admin/reports/ReportSpecRunner.tsx` — dado um `ReportSpec`, executa `runReportQuery` (TanStack Query) e monta as `ReportColumn[]` dinamicamente para o `ReportShell`.
- `src/components/admin/reports/SaveReportDialog.tsx`.

### 7. Wiring no `admin.tsx`
Novas branches por `aba`:
- `rel-chat` → `<RelatorioChatIA />`
- `rel-salvos` → `<MeusRelatorios />`

### 8. Segurança e guardrails
- Whitelist rígida de campos/ops por fonte, aplicada **no servidor** (não confiar no front).
- `limit` hard-cap 5000 no back; default 500.
- `runReportQuery` e `generateReportSpec` protegidas por `requireSupabaseAuth` + verificação `can_manage_empresa` do tenant atual.
- Nenhum acesso a: `config_fiscal`, `notas_fiscais`, `config_pagamentos` (credenciais), `auth.*`, dados de outras empresas.
- LOVABLE_API_KEY provisionada via `ai_gateway--create`.
- `structuredOutputs: true` no provider (é modelo OpenAI).

### 9. Dependências novas
- `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/react` (para AI Elements do chat).
- AI Elements: `bunx ai-elements@latest add conversation message prompt-input shimmer`.
- Recharts **já está** no projeto (shadcn/ui).

## Fora de escopo (Fase 2+)
- Múltiplas conversas de chat persistidas (fica em localStorage single-thread).
- Compartilhar relatórios salvos entre empresas.
- Agendamento por e-mail.
- Fontes adicionais (financeiro/caixa, cashback, fiado detalhado) — entram depois seguindo o mesmo padrão de adapter.
- Edição visual do `spec` sem chat.

## Ordem de implementação
1. Migração `relatorios_salvos` + GRANT + RLS.
2. `src/lib/reports/spec.ts` (types + Zod).
3. `src/lib/reports/datasources.ts` (catálogo).
4. `src/lib/ai-gateway.server.ts` (helper).
5. `src/lib/reports/reports.functions.ts` (`runReportQuery` + CRUD de salvos).
6. `src/lib/reports/reports-ai.functions.ts` (`generateReportSpec`).
7. `ChartRenderer.tsx`, `ReportSpecRunner.tsx`, `SaveReportDialog.tsx`.
8. `RelatorioChatIA.tsx`, `MeusRelatorios.tsx`.
9. Wiring em `AdminSidebar` + `admin.tsx`.
10. Instalar AI Elements + smoke test end-to-end (prompt → spec → tabela+gráfico → salvar → reabrir → imprimir).
