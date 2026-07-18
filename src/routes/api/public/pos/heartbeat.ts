import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/pos/heartbeat
 *
 * Called by the Triviano Tap / POS app every ~60s while foregrounded.
 * Authenticates with pos_devices (x-device-id + x-device-token via
 * verify_pos_device RPC), updates device health columns and records a
 * heartbeat/erro event when applicable.
 *
 * Body: {
 *   app_version?: string, os_version?: string, battery_pct?: number,
 *   network_type?: 'wifi'|'4g'|'5g'|'offline',
 *   printer_ok?: boolean, nfc_ok?: boolean, sdk_provider_ativo?: string,
 *   last_error?: string | null,
 *   events?: Array<{ tipo: string, payload?: Record<string, unknown> }>
 * }
 *
 * Response: { ok: true, ativo: boolean, commands: Array<{id, comando, payload}> }
 */
export const Route = createFileRoute("/api/public/pos/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const deviceId = request.headers.get("x-device-id");
          const deviceToken = request.headers.get("x-device-token");
          if (!deviceId || !deviceToken) return json({ error: "missing device credentials" }, 401);

          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: dev, error: devErr } = await supabaseAdmin.rpc("verify_pos_device", {
            p_device: deviceId, p_token: deviceToken,
          });
          if (devErr || !dev || (Array.isArray(dev) && dev.length === 0)) {
            return json({ error: "invalid device" }, 401);
          }
          const empresaId = (Array.isArray(dev) ? dev[0] : dev).empresa_id as string;

          const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
          for (const k of [
            "app_version","os_version","network_type","sdk_provider_ativo",
          ]) if (typeof body[k] === "string") patch[k] = body[k];
          if (typeof body.battery_pct === "number") patch.battery_pct = Math.max(0, Math.min(100, body.battery_pct));
          if (typeof body.printer_ok === "boolean") patch.printer_ok = body.printer_ok;
          if (typeof body.nfc_ok === "boolean") patch.nfc_ok = body.nfc_ok;
          if (typeof body.last_error === "string" && body.last_error.length > 0) {
            patch.last_error = body.last_error.slice(0, 500);
            patch.last_error_at = new Date().toISOString();
          }

          const { data: devRow } = await supabaseAdmin
            .from("pos_devices")
            .update(patch)
            .eq("id", deviceId)
            .select("ativo, revogado_em")
            .maybeSingle();

          // Record heartbeat + any provided events (append-only)
          const events: Array<{ tipo: string; payload?: Record<string, unknown> }> = Array.isArray(body.events)
            ? (body.events as Array<{ tipo: string; payload?: Record<string, unknown> }>) : [];
          const rows = [
            { empresa_id: empresaId, device_id: deviceId, tipo: "heartbeat", payload: { battery_pct: patch.battery_pct, network_type: patch.network_type } },
            ...events
              .filter((e) => typeof e?.tipo === "string")
              .slice(0, 20)
              .map((e) => ({ empresa_id: empresaId, device_id: deviceId, tipo: e.tipo, payload: e.payload ?? {} })),
          ];
          await supabaseAdmin.from("pos_device_events").insert(rows);

          // Deliver pending commands (mark as entregue)
          const { data: pending } = await supabaseAdmin
            .from("pos_device_commands")
            .select("id, comando, payload")
            .eq("device_id", deviceId)
            .eq("status", "pendente")
            .order("created_at", { ascending: true })
            .limit(10);
          const ids = (pending ?? []).map((c) => c.id);
          if (ids.length > 0) {
            await supabaseAdmin
              .from("pos_device_commands")
              .update({ status: "entregue", delivered_at: new Date().toISOString() })
              .in("id", ids);
          }

          const ativo = !!devRow?.ativo && !devRow?.revogado_em;
          return json({ ok: true, ativo, commands: pending ?? [] });
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
