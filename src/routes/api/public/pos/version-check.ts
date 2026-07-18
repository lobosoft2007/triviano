import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/pos/version-check?current=1.2.3
 * Returns { latest, min_required, must_update, apk_url, notas }
 */
export const Route = createFileRoute("/api/public/pos/version-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const current = url.searchParams.get("current") ?? "0.0.0";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("pos_app_releases")
          .select("versao, versao_minima_obrigatoria, apk_url, notas")
          .eq("ativo", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) {
          return json({ latest: current, min_required: current, must_update: false });
        }
        const must = cmp(current, data.versao_minima_obrigatoria) < 0;
        return json({
          latest: data.versao,
          min_required: data.versao_minima_obrigatoria,
          must_update: must,
          apk_url: data.apk_url ?? null,
          notas: data.notas ?? null,
        });
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});

function cmp(a: string, b: string): number {
  const A = a.split(".").map((n) => parseInt(n, 10) || 0);
  const B = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0, y = B[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
