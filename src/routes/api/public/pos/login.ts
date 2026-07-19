import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/pos/login
 * Headers: x-device-id, x-device-token
 * Body: { pin: string }
 * Response: { userId, nome, sessionToken, empresaId, flavor }
 */
export const Route = createFileRoute("/api/public/pos/login")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            pin?: string;
            deviceId?: string;
            deviceToken?: string;
          };
          const deviceId =
            request.headers.get("x-device-id") ?? body.deviceId ?? null;
          const deviceToken =
            request.headers.get("x-device-token") ?? body.deviceToken ?? null;
          if (!deviceId || !deviceToken) return json({ error: "missing device credentials" }, 401);

          const pin = String(body.pin ?? "").trim();
          if (!pin) return json({ error: "pin obrigatório" }, 400);


          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("pos_login_pin", {
            p_device: deviceId,
            p_token: deviceToken,
            p_pin: pin,
          });
          if (error) return json({ error: error.message }, 401);

          const d = data as {
            user_id: string;
            full_name: string;
            empresa_id: string;
            flavor: string;
          };
          return json({
            userId: d.user_id,
            nome: d.full_name,
            sessionToken: deviceToken,
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
    "Access-Control-Allow-Headers": "content-type, x-device-id, x-device-token",
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
