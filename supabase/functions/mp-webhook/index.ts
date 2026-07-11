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

type MpConfig = {
  empresa_id?: string;
  mp_access_token?: string | null;
  mp_access_token_prod?: string | null;
  mp_access_token_test?: string | null;
  mp_webhook_secret?: string | null;
};

function candidateTokens(cfg?: MpConfig | null): string[] {
  const tokens = [
    cfg?.mp_access_token_prod,
    cfg?.mp_access_token_test,
    cfg?.mp_access_token,
  ]
    .map((t) => t?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(tokens)];
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

  const isPaymentTopic = topic.includes("payment");

  // Localizar o pedido pelos ids salvos na criação do pagamento.
  let { data: order } = await admin
    .from("orders")
    .select("id, empresa_id, mp_order_id, mp_payment_id, pago_online")
    .or(`mp_payment_id.eq.${resourceId},mp_order_id.eq.${resourceId}`)
    .maybeSingle();

  let discoveredCfg:
    | (MpConfig & { empresa_id: string })
    | null = null;
  let discoveredPayment: Record<string, unknown> | null = null;

  // Fallback crítico: se o cliente voltou ao carrinho e a criação de pagamento
  // gerou/salvou outro mp_payment_id, o webhook de um PIX anterior chega com um
  // payment id que não bate mais na linha local. Para não perder a confirmação,
  // reconsultamos o pagamento nos tenants ativos e usamos external_reference
  // (= order.id) como fonte de verdade.
  if (!order && isPaymentTopic) {
    const { data: cfgs } = await admin
      .from("config_pagamentos")
      .select("empresa_id, mp_access_token, mp_access_token_prod, mp_access_token_test, mp_webhook_secret")
      .eq("ativo", true);

    for (const cfgItem of cfgs ?? []) {
      for (const token of candidateTokens(cfgItem)) {
        try {
          const r = await fetch(`${MP_API}/v1/payments/${resourceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) continue;
          const payment = await r.json().catch(() => ({}));
          const externalReference = String(payment?.external_reference ?? "");
          if (!externalReference) continue;
          const { data: byExternalReference } = await admin
            .from("orders")
            .select("id, empresa_id, mp_order_id, mp_payment_id, pago_online")
            .eq("id", externalReference)
            .eq("empresa_id", cfgItem.empresa_id)
            .maybeSingle();
          if (byExternalReference) {
            order = byExternalReference;
            discoveredCfg = cfgItem;
            discoveredPayment = payment;
            console.log("mp-webhook: pedido localizado por external_reference", {
              order_id: order.id,
              resourceId,
              empresa_id: order.empresa_id,
            });
            break;
          }
        } catch (e) {
          console.warn("mp-webhook: fallback external_reference falhou para tenant", {
            empresa_id: cfgItem.empresa_id,
            error: String(e),
          });
        }
      }
      if (order) break;
    }
  }

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
  const { data: cfg } = discoveredCfg
    ? { data: discoveredCfg }
    : await admin
        .from("config_pagamentos")
        .select("mp_access_token, mp_access_token_prod, mp_access_token_test, mp_webhook_secret")
        .eq("empresa_id", order.empresa_id)
        .eq("ativo", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const tokens = candidateTokens(cfg);
  const accessToken = tokens[0];
  const webhookSecret = cfg?.mp_webhook_secret?.trim();
  console.log("mp-webhook: credenciais da empresa", {
    empresa_id: order.empresa_id,
    hasAccessToken: !!accessToken,
    hasWebhookSecret: !!webhookSecret,
  });
  if (tokens.length === 0) {
    console.error("mp-webhook: empresa sem access token configurado", {
      empresa_id: order.empresa_id,
    });
    return new Response("empresa sem credenciais", { status: 200, headers: corsHeaders });
  }

  // Validação de assinatura HMAC (quando o segredo está configurado no tenant).
  // Manifesto oficial do Mercado Pago:  id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  // O Mercado Pago recomenda usar o data.id em minúsculas quando alfanumérico,
  // então validamos contra as duas formas (original e minúscula) por robustez.
  let signatureValid = !webhookSecret;
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
    for (const manifest of candidates) {
      const expected = await hmacHex(webhookSecret, manifest);
      if (timingSafeEqual(expected, v1)) {
        signatureValid = true;
        break;
      }
    }
    if (!signatureValid) {
      // Diagnóstico seguro: nunca logamos o segredo nem o hash esperado. Não
      // liberamos nada com base no payload; seguimos apenas para reconciliar
      // contra a API oficial do MP usando o token da empresa e external_reference.
      console.error("mp-webhook: assinatura HMAC inválida — reconciliando pela API oficial", {
        resourceId,
        xRequestId,
        ts,
        v1Prefix: v1.slice(0, 8),
      });
    }
    if (signatureValid) console.log("mp-webhook: assinatura HMAC válida", { resourceId });
  } else {
    console.warn(
      "mp-webhook: sem webhook secret configurado — pulando validação de assinatura",
      { empresa_id: order.empresa_id },
    );
  }

  // Reconsultar o status REAL na API do MP (fonte da verdade).
  const endpoint = isPaymentTopic
    ? `${MP_API}/v1/payments/${resourceId}`
    : `${MP_API}/v1/orders/${order.mp_order_id || resourceId}`;

  let status = "";
  let externalReference = "";
  let apiPaymentId = "";
  try {
    let httpStatus = 200;
    let j = discoveredPayment as any;
    if (!j) {
      for (const token of tokens) {
        const r = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        httpStatus = r.status;
        if (!r.ok) continue;
        j = await r.json().catch(() => ({}));
        break;
      }
    }
    j = j ?? {};
    status = String(j?.status ?? j?.transactions?.payments?.[0]?.status ?? "");
    externalReference = String(j?.external_reference ?? "");
    apiPaymentId = String(j?.id ?? j?.transactions?.payments?.[0]?.id ?? "");
    console.log("mp-webhook: status reconsultado", {
      order_id: order.id,
      endpoint,
      httpStatus,
      mpStatus: status,
      signatureValid,
    });
  } catch (e) {
    console.error("mp-webhook: falha ao reconsultar status", { order_id: order.id, error: String(e) });
    return new Response("retry", { status: 500, headers: corsHeaders });
  }

  if (externalReference && externalReference !== order.id) {
    console.error("mp-webhook: external_reference divergente", {
      order_id: order.id,
      resourceId,
      externalReference,
    });
    return new Response("external_reference inválida", { status: 409, headers: corsHeaders });
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
        mp_payment_id: isPaymentTopic ? resourceId : apiPaymentId || order.mp_payment_id,
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

