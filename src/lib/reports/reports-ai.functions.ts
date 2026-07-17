import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { ReportSpecSchema, type ReportSpec, DEFAULT_LIMIT } from "./spec";
import { DATA_SOURCES_CATALOG } from "./datasources";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateReportSpecResult {
  spec: ReportSpec | null;
  clarify: string | null;
  raw: string | null;
}

function buildCatalog(): string {
  return DATA_SOURCES_CATALOG.map((ds) => {
    const fields = ds.fields
      .map((f) => `    - ${f.key} (${f.type}, ops: ${f.ops.join("|")}${f.groupable ? ", groupable" : ""}${f.aggs ? `, aggs: ${f.aggs.join("|")}` : ""}) — ${f.label}`)
      .join("\n");
    return `- dataSource "${ds.key}" (${ds.label}): ${ds.description}\n${fields}`;
  }).join("\n\n");
}

function systemPrompt(): string {
  return `Você é um assistente que gera "receitas" de relatórios (ReportSpec em JSON) para um sistema de restaurante multi-tenant. Você NUNCA escreve SQL. Só produz o JSON conforme o schema.

FONTES DE DADOS DISPONÍVEIS (use APENAS estes campos e operadores; qualquer outro campo faz o relatório falhar):

${buildCatalog()}

REGRAS:
- Sempre responda em português do Brasil.
- Escolha UMA fonte de dados por relatório.
- "columns" define as colunas exibidas (na ordem).
- "filters" aplica filtros (op deve estar entre os permitidos do campo).
- "groupBy" só com campos "groupable". Se agrupar, marque cada coluna métrica com "agg".
- "chart" é opcional. Use quando faz sentido visualizar (ex: totais por grupo).
- "orientation" = "landscape" quando houver muitas colunas.
- Valores monetários (money=true) recebem totalização automática.
- Se o pedido for ambíguo, preencha "clarify" com uma pergunta curta e devolva um spec placeholder mínimo.
- Não invente campos. Não use SQL. Não use nomes de tabela.
- Limite máximo padrão: ${DEFAULT_LIMIT} linhas.

Devolva SEMPRE o JSON completo, mesmo em caso de "clarify".`;
}

type Provider = "lovable" | "openai" | "google";

interface AiCreds {
  provider: Provider;
  model: string;
  apiKey: string | null;
}

function buildModel(creds: AiCreds) {
  const isOpenAi = creds.provider === "openai" || (creds.provider === "lovable" && creds.model.startsWith("openai/"));

  if (creds.provider === "lovable") {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente no servidor.");
    const gateway = createLovableAiGatewayProvider(key, undefined, {
      structuredOutputs: isOpenAi,
    });
    return { model: gateway(creds.model), structuredOutputs: isOpenAi };
  }

  if (!creds.apiKey) {
    throw new Error(
      `A empresa selecionou o provedor "${creds.provider}" mas ainda não cadastrou uma chave de API. Vá em Admin → Configurações da Empresa → "Modelo de IA dos Relatórios".`,
    );
  }

  if (creds.provider === "openai") {
    const provider = createOpenAICompatible({
      name: "byo-openai",
      baseURL: "https://api.openai.com/v1",
      apiKey: creds.apiKey,
      supportsStructuredOutputs: true,
    });
    // OpenAI expects a bare model id (no "openai/" prefix).
    const modelId = creds.model.replace(/^openai\//, "");
    return { model: provider(modelId), structuredOutputs: true };
  }

  // Google Gemini via OpenAI-compatible endpoint.
  const provider = createOpenAICompatible({
    name: "byo-google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: creds.apiKey,
    supportsStructuredOutputs: false,
  });
  const modelId = creds.model.replace(/^google\//, "");
  return { model: provider(modelId), structuredOutputs: false };
}

export const generateReportSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { prompt: string; history?: ChatMessage[] };
    return {
      prompt: String(i.prompt).slice(0, 4000),
      history: (i.history ?? []).slice(-10).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: String(m.content).slice(0, 4000),
      })),
    };
  })
  .handler(async ({ data, context }): Promise<GenerateReportSpecResult> => {
    // Load per-empresa AI credentials (never exposed to the browser).
    const { data: credsRows, error: credsErr } = await context.supabase.rpc(
      "get_ai_report_credentials",
    );
    if (credsErr) throw new Error(`Falha ao ler credenciais de IA: ${credsErr.message}`);
    const credsRow = (credsRows ?? [])[0] ?? {
      provider: "lovable",
      model: "openai/gpt-5.5",
      api_key: null,
    };
    const creds: AiCreds = {
      provider: (credsRow.provider as Provider) ?? "lovable",
      model: credsRow.model ?? "openai/gpt-5.5",
      apiKey: credsRow.api_key ?? null,
    };

    const { model } = buildModel(creds);

    const messages = [
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: data.prompt },
    ];

    try {
      const { output } = await generateText({
        model,
        system: systemPrompt(),
        messages,
        output: Output.object({ schema: ReportSpecSchema }),
        ...(creds.provider === "lovable"
          ? { providerOptions: { lovable: { reasoningEffort: "none" } } }
          : {}),
      });
      return { spec: output as ReportSpec, clarify: (output as ReportSpec).clarify ?? null, raw: null };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = JSON.parse(error.text ?? "{}");
          const safe = ReportSpecSchema.safeParse(parsed);
          if (safe.success) return { spec: safe.data, clarify: safe.data.clarify ?? null, raw: error.text ?? null };
        } catch { /* fall through */ }
        return { spec: null, clarify: null, raw: error.text ?? null };
      }
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao gerar relatório: ${msg}`);
    }
  });

// keep z import in case future validators want it
void z;
