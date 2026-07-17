# Plano: Configuração do Modelo de IA do Assistente de Relatórios

## Objetivo
Permitir que o administrador da empresa escolha qual modelo de IA o Assistente de Relatórios usará, dentro das opções suportadas pelo Lovable AI Gateway. Hoje o modelo está fixo em `openai/gpt-5.5`.

## Modelos suportados (catálogo Lovable AI)
- `openai/gpt-5.5` (padrão — melhor qualidade geral)
- `openai/gpt-5.4` (boa qualidade, custo menor que o 5.5)
- `openai/gpt-5.4-mini` (custo reduzido)
- `openai/gpt-5.4-nano` (mais econômico, tarefas simples)
- `google/gemini-3.1-pro-preview` (alternativa Google)
- `google/gemini-3.5-flash` (rápido e barato)
- `google/gemini-3.1-flash-lite` (mais econômico Google)

## Escopo da mudança

### 1. Banco de dados
- Adicionar coluna `ai_report_model text DEFAULT 'openai/gpt-5.5'` na tabela `public.empresas`.
- Atualizar a função `admin_get_empresa_config()` para retornar `ai_report_model`.
- Garantir GRANTs necessários (a tabela `empresas` já existe; a coluna herda as permissões atuais).

### 2. Tipos e helpers (`src/lib/empresa.ts`)
- Incluir `ai_report_model: string` na interface `Empresa` e no retorno de `fetchEmpresaAdminConfig`.
- Incluir `ai_report_model` no `EmpresaUpdate` e persistir via `updateEmpresa`.

### 3. Server function de geração de relatórios (`src/lib/reports/reports-ai.functions.ts`)
- Aceitar `model: string` no `inputValidator` (validar contra a allowlist acima).
- Ajustar `createLovableAiGatewayProvider`:
  - `structuredOutputs: true` quando o modelo for `openai/*`.
  - `structuredOutputs: false` quando for `google/*` (Gemini não usa json_schema estrito).
- Usar o modelo recebido em vez do hardcoded `openai/gpt-5.5`.

### 4. Interface de configuração (`src/components/admin/EmpresaConfigTab.tsx`)
- Adicionar uma nova seção "Inteligência Artificial — Relatórios".
- Incluir um select com os modelos suportados e uma breve descrição de custo/desempenho.
- Salvar junto com as demais configurações da empresa.

### 5. Assistente de Relatórios (`src/components/admin/reports/RelatorioChatIA.tsx`)
- Ler o modelo configurado da empresa ativa (via `empresaAdminConfigQueryOptions`).
- Enviar `model` no payload da chamada a `generateReportSpec`.
- Exibir um badge/discreto indicando qual modelo está ativo no chat.

### 6. Validações e segurança
- Manter `.middleware([requireSupabaseAuth])` na server function.
- A allowlist de modelos fica no servidor; o cliente só pode escolher entre opções permitidas.
- Preservar o fallback `NoObjectGeneratedError` para modelos que eventualmente não respeitem o schema.

## O que NÃO muda
- O `LOVABLE_API_KEY` continua provisionado automaticamente pelo Lovable; não é necessário configurar chave.
- O catálogo de fontes de dados (`clientes`, `vendas`, `produtos_estoque`) permanece o mesmo.
- A arquitetura de segurança (RLS, `can_manage_empresa`, `requireSupabaseAuth`) não é alterada.

## Critério de aceite
- Admin consegue abrir **Admin → Configurações da Empresa → IA / Relatórios**, escolher um modelo e salvar.
- Ao usar o **Assistente IA de Relatórios**, o prompt é processado pelo modelo selecionado.
- Se o modelo for inválido ou não estiver na allowlist, a server function rejeita com erro claro.
- O padrão permanece `openai/gpt-5.5` para empresas que ainda não configuraram.

## Risco / Nota técnica
Modelos Gemini usam `response_format: { type: "json_object" }` (não schema estrito). Isso aumenta levemente a chance de JSON não-conforme, mas o código já trata isso via `NoObjectGeneratedError` e `ReportSpecSchema.safeParse`. O fallback mantém a robustez.