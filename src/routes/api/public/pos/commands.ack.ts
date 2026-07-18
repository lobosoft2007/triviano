import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/pos/commands/ack
 * Body: { command_id: string, status: 'executado'|'falhou', result?: object }
 * Auth: x-device-id + x-device-token
 */
export const Route = createFileRoute("/api/public/pos/commands/ack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const deviceId = request.headers.get("x-device-id");
          const deviceToken = request.headers.get("x-device-token");
          if (!deviceId || !deviceToken) return json({ error: "missing device credentials" }, 401);

          const body = (await request.json().catch(() => null)) as {
            command_id?: string; status?: "executado" | "falhou"; result?: Record<string, unknown>;
          } | null;
          if (!body?.command_id || !["executado", "falhou"].includes(body.status ?? "")) {
            return json({ error: "invalid body" }, 400);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: dev, error: devErr } = await supabaseAdmin.rpc("verify_pos_device", {
            p_device: deviceId, p_token: deviceToken,
          });
          if (devErr || !dev || (Array.isArray(dev) && dev.length === 0)) {
            return json({ error: "invalid device" }, 401);
          }

          await supabaseAdmin
            .from("pos_device_commands")
            .update({ status: body.status, ack_at: new Date().toISOString(), result: body.result ?? {} })
            .eq("id", body.command_id)
            .eq("device_id", deviceId);

          return json({ ok: true });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "unknown" }, 500);
        }
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-device-id, x-device-token",
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
