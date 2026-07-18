import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/tap/pix/create
 *
 * Called by the Triviano Tap waiter app. Authenticates via headers
 * `x-device-id` + `x-device-token` (paired POS device), reads the active
 * tap_provider_config for the empresa, calls the provider's PIX API and
 * persists a `tap_pix_charges` row that the client polls or that the
 * webhook will settle.
 *
 * Body: { valor: number, descricao?: string, order_id?: string|null }
 */
export const Route = createFileRoute("/api/public/tap/pix/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const deviceId = request.headers.get("x-device-id");
          const deviceToken = request.headers.get("x-device-token");
          if (!deviceId || !deviceToken) {
            return json({ error: "missing device credentials" }, 401);
          }

          const body = (await request.json().catch(() => null)) as {
            valor?: number;
            descricao?: string;
            order_id?: string | null;
          } | null;
          if (!body || typeof body.valor !== "number" || body.valor <= 0) {
            return json({ error: "invalid body" }, 400);
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          // 1. Verify device -> empresa
          const { data: dev, error: devErr } = await supabaseAdmin.rpc(
            "verify_pos_device",
            { p_device: deviceId, p_token: deviceToken }
          );
          if (devErr || !dev || (Array.isArray(dev) && dev.length === 0)) {
            return json({ error: "invalid device" }, 401);
          }
          const empresaId = (Array.isArray(dev) ? dev[0] : dev).empresa_id as string;

          // 2. Load active Tap provider config
          const { data: cfg } = await supabaseAdmin
            .from("tap_provider_config")
            .select("provider, ambiente, credentials")
            .eq("empresa_id", empresaId)
            .eq("ativo", true)
            .maybeSingle();
          if (!cfg) {
            return json({ error: "no active tap provider" }, 409);
          }

          const creds = (cfg.credentials ?? {}) as Record<string, string>;
          const provider = cfg.provider as "mercadopago" | "pagbank";
          const ambiente = cfg.ambiente as "prod" | "sandbox";

          // 3. Insert pending charge (get id for idempotency-key)
          const { data: pending, error: insErr } = await supabaseAdmin
            .from("tap_pix_charges")
            .insert({
              empresa_id: empresaId,
              pos_device_id: deviceId,
              provider,
              ambiente,
              order_id: body.order_id ?? null,
              valor: body.valor,
              descricao: body.descricao ?? "Pedido Triviano",
              status: "pending",
            })
            .select("id")
            .single();
          if (insErr || !pending) {
            return json({ error: "db insert failed" }, 500);
          }

          // 4. Call provider
          const {
            createMercadoPagoPix,
            createPagBankPix,
          } = await import("@/lib/tap-pix.server");

          try {
            const result =
              provider === "mercadopago"
                ? await createMercadoPagoPix({
                    accessToken: creds.access_token ?? "",
                    valor: body.valor,
                    descricao: body.descricao ?? "Pedido Triviano",
                    chargeId: pending.id,
                    ambiente,
                  })
                : await createPagBankPix({
                    bearerToken:
                      creds.token_aplicacao || creds.client_secret || "",
                    valor: body.valor,
                    descricao: body.descricao ?? "Pedido Triviano",
                    chargeId: pending.id,
                    ambiente,
                  });

            await supabaseAdmin
              .from("tap_pix_charges")
              .update({
                external_id: result.external_id,
                qr_code: result.qr_code,
                qr_code_base64: result.qr_code_base64,
                copia_e_cola: result.copia_e_cola,
                expires_at: result.expires_at,
                raw_response: result.raw as never,
              })
              .eq("id", pending.id);

            return json({
              charge_id: pending.id,
              provider,
              ambiente,
              qr_code: result.qr_code,
              qr_code_base64: result.qr_code_base64,
              copia_e_cola: result.copia_e_cola,
              expires_at: result.expires_at,
            });
          } catch (err) {
            await supabaseAdmin
              .from("tap_pix_charges")
              .update({
                status: "error",
                raw_response: {
                  error: err instanceof Error ? err.message : String(err),
                } as never,
              })
              .eq("id", pending.id);
            return json(
              {
                error: err instanceof Error ? err.message : "provider error",
              },
              502
            );
          }
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : "unknown" },
            500
          );
        }
      },
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
