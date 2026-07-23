import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-agent-token",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/**
 * POST /api/public/print-agent/claim
 * Header: x-agent-token: <opaque token>
 * Body: { limit?: number }
 * Response: { jobs: PrintJob[] }
 */
export const Route = createFileRoute("/api/public/print-agent/claim")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const token = request.headers.get("x-agent-token") ?? "";
        if (!token) return json({ error: "missing_token" }, 401);

        const hash = createHash("sha256").update(token).digest("hex");
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: tok } = await supabaseAdmin
          .from("printer_agent_tokens")
          .select("id, empresa_id, ativo")
          .eq("token_hash", hash)
          .maybeSingle();

        if (!tok || !tok.ativo) return json({ error: "invalid_token" }, 401);

        // heartbeat
        await supabaseAdmin
          .from("printer_agent_tokens")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", tok.id);

        const body = (await request.json().catch(() => ({}))) as {
          limit?: number;
        };
        const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);

        const { data, error } = await supabaseAdmin.rpc("claim_print_jobs", {
          p_empresa_id: tok.empresa_id,
          p_limit: limit,
        });
        if (error) return json({ error: error.message }, 500);

        return json({ jobs: data ?? [] });
      },
    },
  },
});
