import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/hooks/pos-health-check
 *
 * Called by pg_cron every 5 minutes. Scans all pos_devices and inserts
 * notificacoes_cliente for admin master users when:
 *  - device online in last 24h but no heartbeat > 10min → offline suspeito
 *  - >=3 error events (erro_sdk/erro_pix/erro_impressao) in last 15min
 *
 * Auth: apikey header (Supabase anon key)
 */
export const Route = createFileRoute("/api/public/hooks/pos-health-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        if (!key || key !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return json({ error: "unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        // 1) Offline suspeitos
        const { data: offline } = await supabaseAdmin
          .from("pos_devices")
          .select("id, empresa_id, nome, last_seen_at, ativo, revogado_em")
          .is("revogado_em", null)
          .eq("ativo", true)
          .lt("last_seen_at", new Date(Date.now() - 10 * 60_000).toISOString())
          .gt("last_seen_at", new Date(Date.now() - 24 * 3600_000).toISOString());

        // 2) Erros em rajada por device (últimos 15min)
        const { data: bursts } = await supabaseAdmin
          .from("pos_device_events")
          .select("device_id, empresa_id, tipo, created_at")
          .in("tipo", ["erro_sdk", "erro_pix", "erro_impressao"])
          .gt("created_at", new Date(Date.now() - 15 * 60_000).toISOString());

        const burstMap = new Map<string, { empresa: string; count: number }>();
        for (const e of bursts ?? []) {
          const cur = burstMap.get(e.device_id) ?? { empresa: e.empresa_id, count: 0 };
          cur.count += 1;
          burstMap.set(e.device_id, cur);
        }
        const burstAlerts = [...burstMap.entries()].filter(([, v]) => v.count >= 3);

        // Fetch admin master users per empresa (uma vez por empresa envolvida)
        const empresas = new Set<string>([
          ...(offline ?? []).map((d) => d.empresa_id),
          ...burstAlerts.map(([, v]) => v.empresa),
        ]);

        const notifRows: Array<{ id_usuario: string; titulo: string; mensagem: string }> = [];
        for (const empresa of empresas) {
          const { data: admins } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("empresa_id", empresa)
            .is("nivel_id", null);
          const adminIds = (admins ?? []).map((a) => a.id);
          if (adminIds.length === 0) continue;

          for (const dev of offline ?? []) {
            if (dev.empresa_id !== empresa) continue;
            for (const uid of adminIds) {
              notifRows.push({
                id_usuario: uid,
                titulo: "Maquininha offline",
                mensagem: `${dev.nome} está sem responder há mais de 10 minutos.`,
              });
            }
          }
          for (const [devId, meta] of burstAlerts) {
            if (meta.empresa !== empresa) continue;
            const nome = (offline ?? []).find((d) => d.id === devId)?.nome ?? devId.slice(0, 8);
            for (const uid of adminIds) {
              notifRows.push({
                id_usuario: uid,
                titulo: "Erros repetidos na maquininha",
                mensagem: `${nome}: ${meta.count} falhas nos últimos 15 min.`,
              });
            }
          }
        }

        if (notifRows.length > 0) {
          await supabaseAdmin.from("notificacoes_cliente").insert(notifRows);
        }

        return json({
          ok: true,
          at: nowIso,
          offline_suspeito: offline?.length ?? 0,
          bursts: burstAlerts.length,
          notificacoes: notifRows.length,
        });
      },
    },
  },
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { "content-type": "application/json" },
  });
}
