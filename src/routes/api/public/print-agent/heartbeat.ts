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
 * POST /api/public/print-agent/heartbeat
 * Header: x-agent-token: <opaque token>
 * Marca last_seen_at do agente. Retorna a lista de impressoras conhecidas
 * da empresa para o agente descobrir quais IPs precisa atender.
 */
export const Route = createFileRoute("/api/public/print-agent/heartbeat")({
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
          .select("id, empresa_id, ativo, nome")
          .eq("token_hash", hash)
          .maybeSingle();
        if (!tok || !tok.ativo) return json({ error: "invalid_token" }, 401);

        await supabaseAdmin
          .from("printer_agent_tokens")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", tok.id);

        const { data: printers } = await supabaseAdmin
          .from("config_impressoras")
          .select(
            "id, nome, tipo_conexao, endereco_ip, porta, caminho_usb, imprime_pedido_completo, ativo",
          )
          .eq("empresa_id", tok.empresa_id)
          .eq("ativo", true);

        return json({
          ok: true,
          agent: { id: tok.id, nome: tok.nome, empresa_id: tok.empresa_id },
          printers: printers ?? [],
          server_time: new Date().toISOString(),
        });
      },
    },
  },
});
