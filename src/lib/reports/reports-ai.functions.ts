import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  .handler(async ({ data }): Promise<GenerateReportSpecResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente no servidor.");

    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });
    const model = gateway("openai/gpt-5.5");

    const messages = [
      { role: "system" as const, content: systemPrompt() },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: data.prompt },
    ];

    try {
      const { output } = await generateText({
        model,
        messages,
        output: Output.object({ schema: ReportSpecSchema }),
        providerOptions: { lovable: { reasoningEffort: "none" } },
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
