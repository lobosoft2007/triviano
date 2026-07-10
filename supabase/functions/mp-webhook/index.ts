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

  // -------- Log de auditoria (entrada) --------
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const xSignature = req.headers.get("x-signature") ?? "";
  console.log("mp-webhook: recebido", {
    topic,
    resourceId,
    xRequestId,
    hasSignature: xSignature.length > 0,
  });

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
    console.warn("mp-webhook: pedido ainda não encontrado", { resourceId });
    return new Response("order not found yet", { status: 200, headers: corsHeaders });
  }
  console.log("mp-webhook: pedido localizado", {
    order_id: order.id,
    empresa_id: order.empresa_id,
    mp_order_id: order.mp_order_id,
    mp_payment_id: order.mp_payment_id,
    pago_online: order.pago_online,
  });

  // Credenciais da empresa dona do pedido (lidas de config_pagamentos).
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
  console.log("mp-webhook: credenciais da empresa", {
    empresa_id: order.empresa_id,
    hasAccessToken: !!accessToken,
    hasWebhookSecret: !!webhookSecret,
  });
  if (!accessToken) {
    console.error("mp-webhook: empresa sem access token configurado", {
      empresa_id: order.empresa_id,
    });
    return new Response("empresa sem credenciais", { status: 200, headers: corsHeaders });
  }

  // Validação de assinatura HMAC (quando o segredo está configurado no tenant).
  // Manifesto oficial do Mercado Pago:  id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  // O Mercado Pago recomenda usar o data.id em minúsculas quando alfanumérico,
  // então validamos contra as duas formas (original e minúscula) por robustez.
  if (webhookSecret) {
    const parts = Object.fromEntries(
      xSignature.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k?.trim(), v?.trim()];
      }),
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) {
      console.error("mp-webhook: assinatura ausente ou malformada", {
        resourceId,
        rawSignature: xSignature,
      });
      return new Response("assinatura ausente", { status: 401, headers: corsHeaders });
    }
    const candidates = [
      `id:${resourceId};request-id:${xRequestId};ts:${ts};`,
      `id:${resourceId.toLowerCase()};request-id:${xRequestId};ts:${ts};`,
    ];
    let valid = false;
    for (const manifest of candidates) {
      const expected = await hmacHex(webhookSecret, manifest);
      if (timingSafeEqual(expected, v1)) {
        valid = true;
        break;
      }
    }
    if (!valid) {
      // Diagnóstico seguro: nunca logamos o segredo nem o hash esperado.
      console.error("mp-webhook: assinatura HMAC inválida", {
        resourceId,
        xRequestId,
        ts,
        v1Prefix: v1.slice(0, 8),
      });
      return new Response("assinatura inválida", { status: 401, headers: corsHeaders });
    }
    console.log("mp-webhook: assinatura HMAC válida", { resourceId });
  } else {
    console.warn(
      "mp-webhook: sem webhook secret configurado — pulando validação de assinatura",
      { empresa_id: order.empresa_id },
    );
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
    console.log("mp-webhook: status reconsultado", {
      order_id: order.id,
      endpoint,
      httpStatus: r.status,
      mpStatus: status,
    });
  } catch (e) {
    console.error("mp-webhook: falha ao reconsultar status", { order_id: order.id, error: String(e) });
    return new Response("retry", { status: 500, headers: corsHeaders });
  }

  const paid = ["paid", "processed", "approved"].includes(status.toLowerCase());

  if (paid && !order.pago_online) {
    // Pagamento confirmado: libera o pedido para o Caixa/KDS (dispara realtime).
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
    console.log("mp-webhook: PEDIDO LIBERADO (pago)", { order_id: order.id, mpStatus: status });
  } else if (!paid) {
    await admin.from("orders").update({ mp_status: status }).eq("id", order.id);
    console.log("mp-webhook: pedido ainda não pago", { order_id: order.id, mpStatus: status });
  } else {
    console.log("mp-webhook: pedido já estava pago (idempotente)", { order_id: order.id });
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});

