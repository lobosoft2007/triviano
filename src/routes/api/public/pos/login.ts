import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/pos/login
 * Headers: x-device-id, x-device-token
 * Body: { pin: string, deviceId?: string, deviceToken?: string }
 * Response: { userId, nome, sessionToken, deviceId, empresaId, flavor }
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
            device_id?: string;
            device_token?: string;
            sessionToken?: string;
          };
          const bearerToken = request.headers
            .get("authorization")
            ?.replace(/^Bearer\s+/i, "")
            .trim();
          const deviceId =
            clean(request.headers.get("x-device-id") ?? body.deviceId ?? body.device_id);
          const deviceToken =
            clean(
              request.headers.get("x-device-token") ??
                body.deviceToken ??
                body.device_token ??
                body.sessionToken ??
                bearerToken,
            );
          if (!deviceToken) return json({ error: "missing device token" }, 401);

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
            device_id?: string;
          };
          return json({
            userId: d.user_id,
            nome: d.full_name,
            sessionToken: deviceToken,
            deviceId: d.device_id ?? deviceId,
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
    "Access-Control-Allow-Headers": "content-type, authorization, x-device-id, x-device-token",
  };
}
function clean(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
