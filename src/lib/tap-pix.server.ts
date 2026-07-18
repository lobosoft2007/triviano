/**
 * Server-only helpers for Triviano Tap PIX charges.
 *
 * Called from src/routes/api/public/tap/pix/* server routes. Never imported
 * from client code. Uses supabaseAdmin because the caller is authenticated
 * by device token (not a Supabase user session).
 */

export type TapProviderName = "mercadopago" | "pagbank";

export interface CreatePixResult {
  external_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  copia_e_cola: string | null;
  expires_at: string | null;
  raw: unknown;
}

/**
 * Creates a dynamic PIX charge on Mercado Pago.
 * Docs: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */
export async function createMercadoPagoPix(params: {
  accessToken: string;
  valor: number;
  descricao: string;
  chargeId: string;
  ambiente: "prod" | "sandbox";
}): Promise<CreatePixResult> {
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      "X-Idempotency-Key": params.chargeId,
    },
    body: JSON.stringify({
      transaction_amount: Number(params.valor.toFixed(2)),
      description: params.descricao,
      payment_method_id: "pix",
      external_reference: params.chargeId,
      payer: { email: "cliente@triviano.app" },
    }),
  });
  const json = (await res.json()) as {
    id?: number | string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
    date_of_expiration?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      `Mercado Pago PIX falhou (${res.status}): ${json.message ?? "erro"}`
    );
  }
  const td = json.point_of_interaction?.transaction_data;
  return {
    external_id: String(json.id ?? ""),
    qr_code: td?.qr_code ?? null,
    qr_code_base64: td?.qr_code_base64 ?? null,
    copia_e_cola: td?.qr_code ?? null,
    expires_at: json.date_of_expiration ?? null,
    raw: json,
  };
}

/**
 * Creates a dynamic PIX charge on PagBank (PagSeguro) via Orders API.
 * Docs: https://developer.pagbank.com.br/reference/criar-pedido
 */
export async function createPagBankPix(params: {
  bearerToken: string;
  valor: number;
  descricao: string;
  chargeId: string;
  ambiente: "prod" | "sandbox";
}): Promise<CreatePixResult> {
  const base =
    params.ambiente === "prod"
      ? "https://api.pagbank.com.br"
      : "https://sandbox.api.pagseguro.com";
  const cents = Math.round(params.valor * 100);
  const res = await fetch(`${base}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.bearerToken}`,
      "x-idempotency-key": params.chargeId,
    },
    body: JSON.stringify({
      reference_id: params.chargeId,
      customer: { name: "Cliente Triviano", email: "cliente@triviano.app" },
      items: [
        {
          reference_id: params.chargeId,
          name: params.descricao.slice(0, 100) || "Pedido Triviano",
          quantity: 1,
          unit_amount: cents,
        },
      ],
      qr_codes: [{ amount: { value: cents } }],
      notification_urls: [],
    }),
  });
  const json = (await res.json()) as {
    id?: string;
    qr_codes?: Array<{
      id?: string;
      text?: string;
      expiration_date?: string;
      links?: Array<{ rel?: string; href?: string; media?: string }>;
    }>;
    error_messages?: Array<{ description?: string }>;
  };
  if (!res.ok) {
    throw new Error(
      `PagBank PIX falhou (${res.status}): ${
        json.error_messages?.[0]?.description ?? "erro"
      }`
    );
  }
  const qr = json.qr_codes?.[0];
  const pngLink = qr?.links?.find((l) => l.media === "image/png")?.href;
  return {
    external_id: json.id ?? qr?.id ?? "",
    qr_code: qr?.text ?? null,
    qr_code_base64: null,
    copia_e_cola: qr?.text ?? null,
    expires_at: qr?.expiration_date ?? null,
    raw: { ...json, qr_png_url: pngLink ?? null },
  };
}
