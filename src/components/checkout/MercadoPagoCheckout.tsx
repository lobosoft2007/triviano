import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  createMpPayment,
  fetchMpOrderStatus,
  initMercadoPago,
  type CreateMpPaymentResult,
  type MpPublicConfig,
} from "@/lib/mercadopago";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";

interface Props {
  orderId: string;
  total: number;
  method: "pix" | "card";
  config: MpPublicConfig;
  payerEmail?: string;
  onPaid: () => void;
}

/**
 * Checkout Transparente do Mercado Pago.
 * - PIX: cria a Order, exibe o QR Code dinâmico + Copia e Cola e faz polling
 *   até o webhook confirmar o pagamento.
 * - Cartão: monta o Card Payment Brick (tokenização segura no cliente) e envia
 *   o token para a Edge Function processar.
 */
export function MercadoPagoCheckout({
  orderId,
  total,
  method,
  config,
  payerEmail,
  onPaid,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<CreateMpPaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const mountedContainer = useRef(false);
  const paidHandled = useRef(false);
  const paidStatuses = useRef(new Set(["paid", "processed", "approved"]));

  // -------- Polling do status (PIX e cartão pendente) --------
  useEffect(() => {
    if (paid) return;
    if (method === "pix" && !pix) return;
    let alive = true;
    let running = false;
    const checkStatus = async () => {
      if (running) return;
      running = true;
      try {
        const st = await fetchMpOrderStatus(orderId);
        if (!alive) return;
        const mpStatus = (st?.mp_status ?? "").toLowerCase();
        if (st?.pago_online || paidStatuses.current.has(mpStatus)) {
          if (paidHandled.current) return;
          paidHandled.current = true;
          setPaid(true);
          toast.success("Pagamento confirmado!");
          onPaid();
        }
      } catch (err) {
        console.warn("MP polling: falha ao consultar status do pedido", err);
      } finally {
        running = false;
      }
    };
    void checkStatus();
    const timer = setInterval(checkStatus, 1200);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId, method, pix, paid, onPaid]);

  // -------- PIX: cria a cobrança ao montar --------
  const startPix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createMpPayment({ orderId, method: "pix", payer: { email: payerEmail } });
      setPix(res);
      if (res.paid) {
        if (paidHandled.current) return;
        paidHandled.current = true;
        setPaid(true);
        onPaid();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o PIX.");
    } finally {
      setLoading(false);
    }
  }, [orderId, payerEmail, onPaid]);

  useEffect(() => {
    if (method === "pix" && !pix && !loading && !error) void startPix();
  }, [method, pix, loading, error, startPix]);

  // -------- Cartão: monta o Card Payment Brick --------
  useEffect(() => {
    if (method !== "card" || mountedContainer.current) return;
    mountedContainer.current = true;
    let cancelled = false;
    (async () => {
      try {
        const mp = await initMercadoPago(config.public_key);
        if (cancelled) return;
        const bricks = mp.bricks();
        brickRef.current = await bricks.create("cardPayment", "mp-card-brick", {
          initialization: { amount: total, payer: { email: payerEmail } },
          customization: { visual: { style: { theme: "default" } } },
          callbacks: {
            onReady: () => {},
            onError: (err: unknown) => {
              console.error("MP card brick error", err);
            },
            onSubmit: async (formData: {
              token?: string;
              installments?: number;
              payment_method_id?: string;
              issuer_id?: string;
              payer?: { email?: string; identification?: { type?: string; number?: string } };
            }) => {
              setLoading(true);
              setError(null);
              try {
                const res = await createMpPayment({
                  orderId,
                  method: "card",
                  token: formData.token,
                  installments: formData.installments,
                  paymentMethodId: formData.payment_method_id,
                  issuerId: formData.issuer_id,
                  payer: formData.payer ?? { email: payerEmail },
                });
                if (res.paid) {
                  if (paidHandled.current) return;
                  paidHandled.current = true;
                  setPaid(true);
                  onPaid();
                } else {
                  setError("Pagamento não aprovado. Verifique os dados do cartão.");
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha ao processar o cartão.");
              } finally {
                setLoading(false);
              }
            },
          },
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar o cartão.");
      }
    })();
    return () => {
      cancelled = true;
      brickRef.current?.unmount();
      brickRef.current = null;
      mountedContainer.current = false;
    };
  }, [method, config.public_key, total, payerEmail, orderId, onPaid]);

  async function copyPix() {
    if (!pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  if (paid) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="font-display text-lg font-bold text-success">Pagamento confirmado!</p>
        <p className="text-sm text-muted-foreground">
          Seu pedido de {formatBRL(total)} já está na cozinha.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={() => {
            setError(null);
            if (method === "pix") {
              setPix(null);
            }
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (method === "pix") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-5">
        {loading || !pix ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando QR Code PIX…</p>
          </div>
        ) : (
          <>
            {pix.qr_code_base64 ? (
              <img
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code PIX"
                className="h-56 w-56 rounded-xl bg-white p-2"
              />
            ) : (
              <p className="text-sm text-muted-foreground">QR indisponível — use o código abaixo.</p>
            )}
            <p className="text-center text-sm font-semibold">
              Valor: {formatBRL(total)}
            </p>
            {pix.qr_code && (
              <div className="w-full space-y-2">
                <p className="break-all rounded-lg bg-secondary p-2 text-center text-[11px] leading-tight">
                  {pix.qr_code}
                </p>
                <Button type="button" onClick={copyPix} className="h-11 w-full rounded-xl">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
                    </>
                  )}
                </Button>
              </div>
            )}
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aguardando confirmação do pagamento…
            </p>
          </>
        )}
      </div>
    );
  }

  // Cartão
  return (
    <div className="space-y-3">
      <div id="mp-card-brick" />
      {loading && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Processando pagamento…
        </p>
      )}
    </div>
  );
}
