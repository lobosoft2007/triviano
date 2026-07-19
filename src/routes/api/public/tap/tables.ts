import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/tap/tables
 * Headers: x-device-token (obrigatório), x-device-id (opcional)
 * Retorna as mesas com comanda aberta na empresa do dispositivo.
 */
export const Route = createFileRoute("/api/public/tap/tables")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ request }) => {
        try {
          const bearer = request.headers
            .get("authorization")
            ?.replace(/^Bearer\s+/i, "")
            .trim();
          const deviceToken = clean(request.headers.get("x-device-token") ?? bearer);
          const deviceId = clean(request.headers.get("x-device-id"));
          if (!deviceToken) return json({ error: "missing device token" }, 401);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: dev, error: devErr } = await supabaseAdmin.rpc("pos_resolve_device", {
            p_device: deviceId,
            p_token: deviceToken,
          } as never);
          const row = Array.isArray(dev) ? dev[0] : dev;
          if (devErr || !row?.empresa_id) return json({ error: "invalid device" }, 401);

          const { data, error } = await supabaseAdmin
            .from("comanda_ativa")
            .select("id, numero_mesa, status, total_parcial")
            .eq("empresa_id", row.empresa_id)
            .eq("status", "aberta")
            .order("numero_mesa", { ascending: true });
          if (error) return json({ error: error.message }, 500);

          return json(
            (data ?? []).map((c) => ({
              id: c.id,
              numero: c.numero_mesa,
              status: c.status,
              total: Number(c.total_parcial ?? 0),
            })),
          );
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, x-device-id, x-device-token",
  };
}
function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
