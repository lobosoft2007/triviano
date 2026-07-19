import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/pos/pair
 * Body: { code: string (6 dígitos), deviceLabel?: string, fingerprint?: string }
 * Response: { deviceId, deviceToken, empresaId, flavor }
 */
export const Route = createFileRoute("/api/public/pos/pair")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            code?: string;
            deviceLabel?: string;
            fingerprint?: string;
          };
          const code = String(body.code ?? "").trim();
          if (!code) return json({ error: "code obrigatório" }, 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("pos_pair_device", {
            p_code: code,
            p_fingerprint: body.fingerprint ?? body.deviceLabel ?? null,
          });
          if (error) return json({ error: error.message }, 400);

          const d = data as {
            device_id: string;
            empresa_id: string;
            flavor: string;
            token: string;
          };
          return json({
            deviceId: d.device_id,
            deviceToken: d.token,
            empresaId: d.empresa_id,
            flavor: d.flavor,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "unknown" }, 500);
        }
      },
    },
  },
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
