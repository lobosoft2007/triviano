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
 * POST /api/public/print-agent/ack
 * Header: x-agent-token: <opaque token>
 * Body: { job_id: string, ok: boolean, error?: string }
 */
export const Route = createFileRoute("/api/public/print-agent/ack")({
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

        const body = (await request.json().catch(() => ({}))) as {
          job_id?: string;
          ok?: boolean;
          error?: string;
        };
        if (!body.job_id) return json({ error: "missing_job_id" }, 400);

        // sanity: job pertence à empresa do token
        const { data: job } = await supabaseAdmin
          .from("print_jobs")
          .select("empresa_id")
          .eq("id", body.job_id)
          .maybeSingle();
        if (!job || job.empresa_id !== tok.empresa_id) {
          return json({ error: "job_not_found" }, 404);
        }

        const { error } = await supabaseAdmin.rpc("ack_print_job", {
          p_job_id: body.job_id,
          p_ok: !!body.ok,
          p_error: body.error ?? undefined,
        });
        if (error) return json({ error: error.message }, 500);

        return json({ ok: true });
      },
    },
  },
});
