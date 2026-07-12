import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  createMpPayment,
  fetchMpOrderStatus,
  type CreateMpPaymentResult,
  type MpPublicConfig,
} from "@/lib/mercadopago";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";

interface Props {
  orderId: string;
  total: number;
  config: MpPublicConfig;
  /** Balcão (pedido nasce oculto) ou Mesa (pedido já ativo, não ocultar). */
  context: "balcao" | "mesa";
  payerEmail?: string;
  /**
   * Disparado UMA única vez quando o pagamento é confirmado (webhook do MP
   * marcou pago_online). O chamador registra o pagamento e finaliza o pedido.
   */
  onConfirmed: () => void;
}

/**
 * Cobrança PIX dinâmica do Mercado Pago para o PDV/Caixa.
 * - Cria a Order do MP para o pedido já existente e exibe o QR + Copia e Cola.
 * - Faz polling do status até o webhook confirmar o pagamento real.
 * - Ao confirmar, chama `onConfirmed()` (baixa feita pelo chamador).
 */
export function PdvPixCharge({
  orderId,
  total,
  config,
  context,
  payerEmail,
  onConfirmed,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<CreateMpPaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmedHandled = useRef(false);
  const paidStatuses = useRef(new Set(["paid", "processed", "approved"]));

  const handleConfirmed = useCallback(() => {
    if (confirmedHandled.current) return;
    confirmedHandled.current = true;
    setPaid(true);
    onConfirmed();
  }, [onConfirmed]);

  // -------- Cria a cobrança PIX ao montar --------
  const startPix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createMpPayment({
        orderId,
        method: "pix",
        context,
        payer: { email: payerEmail },
      });
      setPix(res);
      if (res.paid) handleConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o PIX.");
    } finally {
      setLoading(false);
    }
  }, [orderId, context, payerEmail, handleConfirmed]);

  useEffect(() => {
    if (!pix && !loading && !error) void startPix();
  }, [pix, loading, error, startPix]);

  // -------- Polling do status (aguarda o webhook confirmar) --------
  useEffect(() => {
    if (paid || !pix) return;
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
          handleConfirmed();
        }
      } catch (err) {
        console.warn("PdvPixCharge polling: falha ao consultar status", err);
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
  }, [orderId, pix, paid, handleConfirmed]);

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
        <p className="font-display text-lg font-bold text-success">
          Pagamento confirmado!
        </p>
        <p className="text-sm text-muted-foreground">
          Finalizando a venda de {formatBRL(total)}…
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
            setPix(null);
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

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
            <p className="text-sm text-muted-foreground">
              QR indisponível — use o código abaixo.
            </p>
          )}
          <p className="text-center text-sm font-semibold">
            Valor: {formatBRL(total)}
          </p>
          {pix.qr_code && (
            <div className="w-full space-y-2">
              <p className="break-all rounded-lg bg-secondary p-2 text-center text-[11px] leading-tight">
                {pix.qr_code}
              </p>
              <Button
                type="button"
                onClick={copyPix}
                className="h-11 w-full rounded-xl"
              >
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
