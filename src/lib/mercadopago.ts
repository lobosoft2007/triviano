// ============================================================
// Mercado Pago — integração de frontend (Checkout Transparente)
// ------------------------------------------------------------
// - Lê a CHAVE PÚBLICA da empresa do host atual (nunca o token secreto).
// - Carrega o SDK oficial do Mercado Pago sob demanda.
// - Chama a Edge Function `mp-create-payment` (que usa o token secreto no
//   servidor) para criar a Order e obter o QR do PIX / processar o cartão.
// - Faz polling do status do pedido enquanto o cliente paga.
//
// Isolamento multi-tenant: tanto a chave pública quanto o token secreto são
// resolvidos a partir da empresa dona do host/pedido — nunca globais.
// ============================================================
import { supabase } from "@/integrations/supabase/client";
import { currentEnv, currentHost } from "@/lib/empresa";

export interface MpPublicConfig {
  empresa_id: string;
  public_key: string;
  ambiente: string;
  ativo: boolean;
  aceita_pix_online: boolean;
  aceita_cartao_online: boolean;
  aceita_na_entrega: boolean;
}

/** Configuração pública (chave pública + ambiente) do tenant do host atual. */
export async function fetchMpPublicConfig(): Promise<MpPublicConfig | null> {
  const { data, error } = await supabase.rpc("get_mp_public_config", {
    p_host: currentHost(),
    // Ambiente detectado pelo host REAL do navegador (staging → test,
    // domínio próprio → prod). O host acima é sintético para staging, por
    // isso a detecção de ambiente vem separada.
    p_ambiente: currentEnv(),
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row || !row.public_key || !row.ativo) return null;
  return {
    empresa_id: row.empresa_id,
    public_key: row.public_key,
    ambiente: row.ambiente ?? "test",
    ativo: !!row.ativo,
    aceita_pix_online: row.aceita_pix_online ?? true,
    aceita_cartao_online: row.aceita_cartao_online ?? true,
    aceita_na_entrega: row.aceita_na_entrega ?? true,
  };
}

export interface CreateMpPaymentInput {
  orderId: string;
  method: "pix" | "card";
  /**
   * Origem da cobrança. "app" (padrão) é o cliente pagando pelo app; "balcao"
   * e "mesa" são cobranças feitas pelo operador no PDV/Caixa (o pedido de mesa
   * já está visível, então não pode ser ocultado).
   */
  context?: "app" | "balcao" | "mesa";
  token?: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
}

export interface CreateMpPaymentResult {
  status: string;
  paid: boolean;
  mp_order_id: string;
  mp_payment_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
}

/** Cria o pagamento no Mercado Pago via Edge Function (token secreto no servidor). */
export async function createMpPayment(
  input: CreateMpPaymentInput,
): Promise<CreateMpPaymentResult> {
  const { data, error } = await supabase.functions.invoke<CreateMpPaymentResult>(
    "mp-create-payment",
    {
      body: {
        order_id: input.orderId,
        method: input.method,
        context: input.context ?? "app",
        token: input.token,
        installments: input.installments,
        payment_method_id: input.paymentMethodId,
        issuer_id: input.issuerId,
        payer: input.payer,
        // Ambiente detectado pelo host real do navegador. A Edge Function usa
        // este valor para escolher o Access Token (produção x teste).
        env: currentEnv(),
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error("Resposta vazia do pagamento.");
  return data;
}

export interface MpOrderStatus {
  pago_online: boolean;
  mp_status: string | null;
  aguardando_pagamento: boolean;
  status_pedido: string;
}

/** Lê a situação de pagamento do pedido (somente o dono / admin). */
export async function fetchMpOrderStatus(orderId: string): Promise<MpOrderStatus | null> {
  const { data, error } = await supabase.rpc("mp_get_order_status", {
    p_order_id: orderId,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    pago_online: !!row.pago_online,
    mp_status: row.mp_status ?? null,
    aguardando_pagamento: !!row.aguardando_pagamento,
    status_pedido: row.status_pedido ?? "Recebido",
  };
}

// -------------------- SDK loader --------------------

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      opts?: { locale?: string },
    ) => MercadoPagoInstance;
  }
}

export interface MercadoPagoInstance {
  bricks: () => {
    create: (
      brick: string,
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<{ unmount: () => void }>;
  };
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
let sdkPromise: Promise<void> | null = null;

/** Carrega o SDK do Mercado Pago uma única vez. */
export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar o SDK.")));
      if (window.MercadoPago) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o SDK do Mercado Pago."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/** Instancia o SDK com a chave pública da empresa. */
export async function initMercadoPago(publicKey: string): Promise<MercadoPagoInstance> {
  await loadMercadoPagoSdk();
  if (!window.MercadoPago) throw new Error("SDK do Mercado Pago indisponível.");
  return new window.MercadoPago(publicKey, { locale: "pt-BR" });
}
