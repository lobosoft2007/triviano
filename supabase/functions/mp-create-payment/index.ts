// ============================================================
// Mercado Pago — criação de pagamento (Checkout Transparente)
// ------------------------------------------------------------
// Cria uma Order no Mercado Pago para um pedido já existente no banco.
// Suporta PIX (retorna QR Code dinâmico) e Cartão (token gerado pelo
// Card Payment Brick no frontend).
//
// Isolamento multi-tenant: as credenciais (access token) são SEMPRE lidas
// da configuração de pagamento da empresa DONA do pedido — nunca de uma
// variável global. Assim cada franquia cobra na sua própria conta MP.
//
// Segurança: o access token secreto vive apenas no banco (coluna admin-only)
// e é usado somente aqui, no servidor. O frontend nunca o vê.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MP_API = "https://api.mercadopago.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CreatePaymentBody {
  order_id: string;
  method: "pix" | "card";
  // Ambiente detectado no frontend a partir do host real do navegador.
  env?: "prod" | "test";
  // Contexto de origem da cobrança:
  //  - "app"    : cliente pagando pelo app (fluxo padrão, gating de visibilidade).
  //  - "balcao" : PDV/Balcão — pedido nasce oculto (rascunho) até a confirmação.
  //  - "mesa"   : Mesa/Delivery já ativo no Caixa — NÃO alterar visibilidade.
  context?: "app" | "balcao" | "mesa";
  // Card-only (Checkout Transparente / Card Payment Brick):
  token?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
}

/** Deriva o ambiente (prod/test) a partir de um host, como fallback. */
function envFromHost(host: string): "prod" | "test" {
  const h = (host ?? "").toLowerCase();
  if (!h) return "test";
  if (h === "localhost" || h.startsWith("127.")) return "test";
  if (h.includes("id-preview--")) return "test";
  if (h.endsWith(".lovable.app") || h.endsWith(".lovable.dev")) return "test";
  if (h.endsWith(".lovableproject.com") || h.endsWith(".local")) return "test";
  if (h.endsWith(".com.br") || h.endsWith(".com")) return "prod";
  return "test";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1) Autenticar o cliente pelo token do usuário logado.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Não autenticado." }, 401);

  let body: CreatePaymentBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  if (!body.order_id || !body.method) {
    return json({ error: "order_id e method são obrigatórios." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 2) Carregar o pedido e validar posse.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, total, empresa_id, mp_order_id, pago_online")
    .eq("id", body.order_id)
    .maybeSingle();
  if (orderErr || !order) return json({ error: "Pedido não encontrado." }, 404);
  if (order.pago_online) return json({ error: "Pedido já pago." }, 409);

  // Autorização: o DONO do pedido sempre pode pagar. Além dele, um OPERADOR
  // (papel admin) da EMPRESA dona do pedido pode gerar a cobrança — necessário
  // no PDV/Caixa, onde o pedido de mesa pertence ao cliente, não ao operador.
  // Reutiliza `can_manage_empresa` (super_admin OU admin da própria empresa),
  // avaliado com o token do usuário logado (multi-tenant seguro).
  let authorized = order.user_id === user.id;
  if (!authorized && order.empresa_id) {
    const { data: canManage } = await userClient.rpc("can_manage_empresa", {
      _empresa_id: order.empresa_id,
    });
    authorized = !!canManage;
  }
  if (!authorized) return json({ error: "Pedido de outro usuário." }, 403);


  // 3) Credenciais do MERCADO PAGO da EMPRESA dona do pedido (multi-tenant).
  const { data: cfg } = await admin
    .from("config_pagamentos")
    .select(
      "mp_access_token, mp_access_token_prod, mp_access_token_test, mp_ativo",
    )
    .eq("empresa_id", order.empresa_id)
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Ambiente detectado automaticamente: preferimos o enviado pelo frontend
  // (host real do navegador) e caímos para a origem/referer como fallback.
  const originHost = (() => {
    try {
      const u = req.headers.get("origin") || req.headers.get("referer") || "";
      return u ? new URL(u).hostname : "";
    } catch {
      return "";
    }
  })();
  const env: "prod" | "test" =
    body.env === "prod" || body.env === "test" ? body.env : envFromHost(originHost);

  // Escolha automática do token conforme o ambiente. Mantemos fallback para o
  // token "efetivo" legado, garantindo continuidade se as chaves separadas
  // ainda não estiverem preenchidas.
  const envToken =
    env === "prod" ? cfg?.mp_access_token_prod : cfg?.mp_access_token_test;
  const accessToken = (envToken?.trim() || cfg?.mp_access_token?.trim()) ?? "";
  if (!cfg?.mp_ativo || !accessToken) {
    return json({ error: "Mercado Pago não configurado para esta empresa." }, 400);
  }
  console.log(`mp-create-payment: ambiente=${env} host=${originHost}`);


  const amount = Number(order.total).toFixed(2);
  const payerEmail = body.payer?.email?.trim() || user.email || "comprador@example.com";

  // 4) Montar a Order do Mercado Pago (API de Orders).
  const paymentMethod =
    body.method === "pix"
      ? { id: "pix", type: "bank_transfer" }
      : {
          id: body.payment_method_id,
          type: "credit_card",
          token: body.token,
          installments: body.installments ?? 1,
          ...(body.issuer_id ? { issuer_id: body.issuer_id } : {}),
        };

  const mpBody = {
    type: "online",
    processing_mode: "automatic",
    external_reference: order.id,
    total_amount: amount,
    payer: {
      email: payerEmail,
      ...(body.payer?.identification ? { identification: body.payer.identification } : {}),
    },
    transactions: {
      payments: [{ amount, payment_method: paymentMethod }],
    },
  };

  let mpResp: Response;
  try {
    mpResp = await fetch(`${MP_API}/v1/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // A chave precisa ser estável por pedido + método. Antes usávamos
        // Date.now(), então voltar ao carrinho/reabrir o checkout podia criar
        // múltiplas Orders no MP e sobrescrever mp_payment_id no pedido local;
        // se o cliente pagasse uma cobrança antiga, o webhook não encontrava
        // mais a linha e o polling ficava preso no QR.
        "X-Idempotency-Key": `${order.id}-${body.method}-${env}`,
      },
      body: JSON.stringify(mpBody),
    });
  } catch (e) {
    console.error("mp-create-payment: fetch falhou", e);
    return json({ error: "Falha ao contatar o Mercado Pago." }, 502);
  }

  const mp = await mpResp.json().catch(() => ({}));
  if (!mpResp.ok) {
    console.error("mp-create-payment: erro MP", mpResp.status, JSON.stringify(mp));
    return json({ error: mp?.message || "Erro no Mercado Pago.", detail: mp }, 502);
  }

  // 5) Extrair dados relevantes (defensivo: o QR do PIX pode vir em campos
  // diferentes conforme a versão da API).
  const firstPayment = mp?.transactions?.payments?.[0] ?? {};
  const poi =
    firstPayment?.payment_method ??
    firstPayment?.point_of_interaction?.transaction_data ??
    mp?.point_of_interaction?.transaction_data ??
    {};

  const mpOrderId = String(mp?.id ?? "");
  const mpPaymentId = String(firstPayment?.id ?? mp?.id ?? "");
  const mpStatus = String(mp?.status ?? firstPayment?.status ?? "pending");
  const qrCode = poi?.qr_code ?? poi?.qrCode ?? null;
  const qrCodeBase64 = poi?.qr_code_base64 ?? poi?.qrCodeBase64 ?? null;
  const ticketUrl = poi?.ticket_url ?? firstPayment?.ticket_url ?? null;

  const isPaid = ["paid", "processed", "approved"].includes(mpStatus.toLowerCase());

  // 6) Persistir referências e gating de visibilidade.
  //
  // Para o pedido de MESA (já ativo e visível no Caixa), NUNCA alteramos a
  // visibilidade/estado operacional: apenas gravamos as referências do MP e o
  // tipo de pagamento. Assim uma mesa em atendimento não some do painel se o
  // cliente demorar ou desistir do QR. A baixa é feita pelo operador no
  // navegador quando o webhook confirmar (pago_online=true).
  //
  // Para App e Balcão, o pedido fica oculto (rascunho) até a confirmação — o
  // gating financeiro impede que um pedido não pago chegue ao KDS/Caixa.
  const context = body.context ?? "app";
  const tipoPagamento =
    body.method === "pix" ? "pix" : "cartao_credito_online";

  const updatePayload: Record<string, unknown> =
    context === "mesa"
      ? {
          mp_order_id: mpOrderId,
          mp_payment_id: mpPaymentId,
          mp_status: mpStatus,
          pago_online: isPaid,
          tipo_pagamento: tipoPagamento,
        }
      : {
          mp_order_id: mpOrderId,
          mp_payment_id: mpPaymentId,
          mp_status: mpStatus,
          pago_online: isPaid,
          // Enquanto não confirmado, o pedido fica oculto do Caixa/KDS.
          aguardando_pagamento: !isPaid,
          status: isPaid ? "pending" : "rascunho_pagamento",
          status_pedido: "Recebido",
          tipo_pagamento: tipoPagamento,
        };

  await admin.from("orders").update(updatePayload).eq("id", order.id);


  return json({
    status: mpStatus,
    paid: isPaid,
    mp_order_id: mpOrderId,
    mp_payment_id: mpPaymentId,
    qr_code: qrCode,
    qr_code_base64: qrCodeBase64,
    ticket_url: ticketUrl,
  });
});
