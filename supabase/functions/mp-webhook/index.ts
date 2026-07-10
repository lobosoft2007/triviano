// ============================================================
// Mercado Pago — Webhook (Ouvido Digital)
// ------------------------------------------------------------
// Recebe as notificações do Mercado Pago quando o status de um pagamento
// muda. Ao confirmar o pagamento (paid/approved), libera o pedido:
//   - marca pago_online = true e aguardando_pagamento = false;
//   - o UPDATE dispara o realtime -> som no Caixa + card no KDS.
//
// Público (verify_jwt = false), pois quem chama é o Mercado Pago. Toda a
// segurança é feita AQUI: validação de assinatura HMAC (x-signature) com o
// segredo da empresa e reconsulta do status real na API do MP.
//
// Isolamento multi-tenant: descobrimos a empresa pelo pedido (external
// reference / ids salvos) e usamos o access token DAQUELA empresa.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MP_API = "https://api.mercadopago.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-signature, x-request-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// HMAC-SHA256 no padrão de validação do Mercado Pago.
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // O MP faz um GET simples para validar a URL ao cadastrar o webhook.
  if (req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const rawBody = await req.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    /* alguns webhooks vêm só por query params */
  }

  // Identificar o recurso notificado (payment / order / merchant_order).
  const topic =
    (payload.type as string) ||
    (payload.topic as string) ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    "";
  const data = (payload.data as { id?: string }) ?? {};
  const resourceId =
    data.id ||
    (payload.id as string) ||
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";

  if (!resourceId) {
    // Nada para processar; responde 200 para não gerar reentrega.
    return new Response("no resource id", { status: 200, headers: corsHeaders });
  }

  // Localizar o pedido pelos ids salvos na criação do pagamento.
  const { data: order } = await admin
    .from("orders")
    .select("id, empresa_id, mp_order_id, mp_payment_id, pago_online")
    .or(`mp_payment_id.eq.${resourceId},mp_order_id.eq.${resourceId}`)
    .maybeSingle();

  if (!order) {
    // Pedido ainda não conhecido (corrida) — 200 para reentrega posterior.
    return new Response("order not found yet", { status: 200, headers: corsHeaders });
  }

  // Credenciais da empresa dona do pedido.
  const { data: cfg } = await admin
    .from("config_pagamentos")
    .select("mp_access_token, mp_webhook_secret")
    .eq("empresa_id", order.empresa_id)
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const accessToken = cfg?.mp_access_token?.trim();
  const webhookSecret = cfg?.mp_webhook_secret?.trim();
  if (!accessToken) {
    return new Response("empresa sem credenciais", { status: 200, headers: corsHeaders });
  }

  // Validação de assinatura (quando o segredo está configurado).
  if (webhookSecret) {
    const xSignature = req.headers.get("x-signature") ?? "";
    const xRequestId = req.headers.get("x-request-id") ?? "";
    const parts = Object.fromEntries(
      xSignature.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k?.trim(), v?.trim()];
      }),
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) {
      return new Response("assinatura ausente", { status: 401, headers: corsHeaders });
    }
    const manifest = `id:${resourceId};request-id:${xRequestId};ts:${ts};`;
    const expected = await hmacHex(webhookSecret, manifest);
    if (!timingSafeEqual(expected, v1)) {
      console.error("mp-webhook: assinatura inválida", { resourceId });
      return new Response("assinatura inválida", { status: 401, headers: corsHeaders });
    }
  }

  // Reconsultar o status REAL na API do MP (fonte da verdade).
  const isPaymentTopic = topic.includes("payment");
  const endpoint = isPaymentTopic
    ? `${MP_API}/v1/payments/${resourceId}`
    : `${MP_API}/v1/orders/${order.mp_order_id || resourceId}`;

  let status = "";
  try {
    const r = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = await r.json().catch(() => ({}));
    status = String(j?.status ?? j?.transactions?.payments?.[0]?.status ?? "");
  } catch (e) {
    console.error("mp-webhook: falha ao reconsultar", e);
    return new Response("retry", { status: 500, headers: corsHeaders });
  }

  const paid = ["paid", "processed", "approved"].includes(status.toLowerCase());

  if (paid && !order.pago_online) {
    await admin
      .from("orders")
      .update({
        pago_online: true,
        aguardando_pagamento: false,
        mp_status: status,
        status: "pending",
        status_pedido: "Recebido",
      })
      .eq("id", order.id);
  } else if (!paid) {
    await admin.from("orders").update({ mp_status: status }).eq("id", order.id);
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
