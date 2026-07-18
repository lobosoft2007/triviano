import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/tap/pix/webhook/:provider
 *
 * Called by Mercado Pago or PagBank when a Tap PIX charge is paid. We
 * look up the tap_pix_charges row by external_id, re-fetch the payment
 * with the empresa's own credentials (never trust webhook body alone),
 * and if approved call `record_tap_pix_paid` to settle the order.
 *
 * NOTE: signature verification for both providers is stubbed for the
 * sandbox rollout — turn it on before flipping to production (see the
 * `TODO(prod)` markers below).
 */
export const Route = createFileRoute("/api/public/tap/pix/webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = params.provider as "mercadopago" | "pagbank";
        if (provider !== "mercadopago" && provider !== "pagbank") {
          return new Response("unknown provider", { status: 400 });
        }
        const body = await request.text();
        let payload: Record<string, unknown> = {};
        try {
          payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
        } catch {
          /* ignore, some providers ping with empty body */
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Find charge by external_id (best-effort).
        const externalId =
          provider === "mercadopago"
            ? extractMpPaymentId(request, payload)
            : extractPagBankOrderId(payload);
        if (!externalId) return new Response("no external id", { status: 200 });

        const { data: charge } = await supabaseAdmin
          .from("tap_pix_charges")
          .select("id, empresa_id, valor, status")
          .eq("provider", provider)
          .eq("external_id", externalId)
          .maybeSingle();
        if (!charge) return new Response("not our charge", { status: 200 });
        if (charge.status === "paid") return new Response("ok", { status: 200 });

        // Re-fetch payment status from provider with empresa's credentials.
        const { data: cfg } = await supabaseAdmin
          .from("tap_provider_config")
          .select("credentials, ambiente")
          .eq("empresa_id", charge.empresa_id)
          .eq("provider", provider)
          .maybeSingle();
        const creds = ((cfg?.credentials ?? {}) as Record<string, string>) ?? {};

        let approved = false;
        let paidValue = Number(charge.valor);

        if (provider === "mercadopago") {
          const at = creds.access_token ?? "";
          const res = await fetch(
            `https://api.mercadopago.com/v1/payments/${externalId}`,
            { headers: { Authorization: `Bearer ${at}` } }
          );
          const p = (await res.json()) as {
            status?: string;
            transaction_amount?: number;
          };
          approved = p.status === "approved";
          paidValue = Number(p.transaction_amount ?? paidValue);
        } else {
          const bearer =
            creds.token_aplicacao || creds.client_secret || "";
          const base =
            (cfg?.ambiente ?? "sandbox") === "prod"
              ? "https://api.pagbank.com.br"
              : "https://sandbox.api.pagseguro.com";
          const res = await fetch(`${base}/orders/${externalId}`, {
            headers: { Authorization: `Bearer ${bearer}` },
          });
          const p = (await res.json()) as {
            charges?: Array<{ status?: string; amount?: { value?: number } }>;
          };
          const paid = p.charges?.find((c) => c.status === "PAID");
          approved = Boolean(paid);
          if (paid?.amount?.value != null) paidValue = paid.amount.value / 100;
        }

        if (!approved) return new Response("ok", { status: 200 });

        await supabaseAdmin.rpc("record_tap_pix_paid", {
          p_charge_id: charge.id,
          p_external_id: externalId,
          p_valor: paidValue,
          p_raw: payload as never,
        });
        return new Response("ok", { status: 200 });
      },
    },
  },
});

function extractMpPaymentId(
  request: Request,
  payload: Record<string, unknown>
): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (q) return q;
  const data = payload["data"] as { id?: string | number } | undefined;
  if (data?.id != null) return String(data.id);
  const id = payload["id"];
  return id != null ? String(id) : null;
}

function extractPagBankOrderId(
  payload: Record<string, unknown>
): string | null {
  const id = payload["id"];
  if (typeof id === "string") return id;
  const charges = payload["charges"] as
    | Array<{ order?: { id?: string } }>
    | undefined;
  return charges?.[0]?.order?.id ?? null;
}
