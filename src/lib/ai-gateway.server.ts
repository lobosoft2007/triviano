import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  const publish = (v?: string) => {
    const n = v?.trim() || undefined;
    if (!runId && n) runId = n;
  };
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      publish(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
      return response;
    },
    getRunId: () => runId,
  };
}

/**
 * Build a Lovable AI Gateway provider bound to the given API key.
 * Set `structuredOutputs: true` for OpenAI models when using `Output.object`
 * so strict `json_schema` is sent.
 */
export function createLovableAiGatewayProvider(
  lovableApiKey: string,
  options?: { structuredOutputs?: boolean },
) {
  const runIdFetch = createRunIdFetch();
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
  return Object.assign(provider, { getRunId: runIdFetch.getRunId });
}
