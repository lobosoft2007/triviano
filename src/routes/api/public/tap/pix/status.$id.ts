import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/tap/pix/status/:id
 * Lightweight polling endpoint the waiter app uses while it waits for
 * the webhook to settle the charge. Auth is still by device headers so
 * only devices of the same empresa can read the charge.
 */
export const Route = createFileRoute("/api/public/tap/pix/status/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const deviceId = request.headers.get("x-device-id");
        const deviceToken = request.headers.get("x-device-token");
        if (!deviceId || !deviceToken) {
          return json({ error: "missing device credentials" }, 401);
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: dev } = await supabaseAdmin.rpc("verify_pos_device", {
          p_device: deviceId,
          p_token: deviceToken,
        });
        if (!dev || (Array.isArray(dev) && dev.length === 0)) {
          return json({ error: "invalid device" }, 401);
        }
        const empresaId = (Array.isArray(dev) ? dev[0] : dev).empresa_id as string;

        const { data: charge } = await supabaseAdmin
          .from("tap_pix_charges")
          .select("id, status, valor, paid_at, expires_at, order_id")
          .eq("id", params.id)
          .eq("empresa_id", empresaId)
          .maybeSingle();
        if (!charge) return json({ error: "not found" }, 404);
        return json(charge);
      },
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type, x-device-id, x-device-token",
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
