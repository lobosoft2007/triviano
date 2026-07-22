// ============================================================
// FiadoPixDialog — quitação de saldo devedor (fiado / conta corrente) via PIX
// ------------------------------------------------------------
// O cliente escolhe o valor a pagar (até o saldo devedor), gera o QR Code
// dinâmico no Mercado Pago e o dialog faz polling até a confirmação. Ao
// confirmar, o webhook (mp-webhook) já chamou pay_fiado_from_mp e o saldo
// devedor foi reduzido no banco; aqui apenas notificamos e invalidamos os
// queries de perfil/extrato para refletir na UI.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, QrCode, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import {
  createMpFiadoPayment,
  fetchMpFiadoStatus,
} from "@/lib/mercadopago";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  saldoDevedor: number;
}

export function FiadoPixDialog({ open, onOpenChange, userId, saldoDevedor }: Props) {
  const queryClient = useQueryClient();
  const [valorStr, setValorStr] = useState(saldoDevedor.toFixed(2));
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<{
    chargeId: string;
    qr_code: string;
    qr_code_base64: string | null;
    valor: number;
  } | null>(null);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setValorStr(saldoDevedor.toFixed(2));
      setQr(null);
      setPaid(false);
    }
  }, [open, saldoDevedor]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (!qr || paid) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await fetchMpFiadoStatus(qr.chargeId);
        if (s?.status === "paid") {
          setPaid(true);
          stopPolling();
          toast.success("Pagamento confirmado! Saldo devedor atualizado.");
          queryClient.invalidateQueries({ queryKey: ["full-profile", userId] });
          queryClient.invalidateQueries({ queryKey: ["profile", userId] });
          queryClient.invalidateQueries({ queryKey: ["extrato-cc", userId] });
        }
      } catch {
        // silencia; próximo tick tenta de novo
      }
    }, 3000);
    return stopPolling;
  }, [qr, paid, stopPolling, queryClient, userId]);

  async function handleCreate() {
    const v = Number(valorStr.replace(",", "."));
    if (!(v > 0)) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (v > saldoDevedor + 0.001) {
      toast.error("Valor maior que o saldo devedor.");
      return;
    }
    setCreating(true);
    try {
      const r = await createMpFiadoPayment({ valor: v });
      if (!r.qr_code) {
        throw new Error("QR Code não foi gerado.");
      }
      setQr({
        chargeId: r.charge_id,
        qr_code: r.qr_code,
        qr_code_base64: r.qr_code_base64,
        valor: v,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível gerar o PIX.",
      );
    } finally {
      setCreating(false);
    }
  }

  function handleClose(v: boolean) {
    if (!v) {
      stopPolling();
    }
    onOpenChange(v);
  }

  async function copyBrCode() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.qr_code);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagar fiado via PIX
          </DialogTitle>
          <DialogDescription>
            Saldo devedor atual:{" "}
            <span className="font-semibold text-foreground">
              {formatBRL(saldoDevedor)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {!qr && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valor">Valor a pagar</Label>
              <Input
                id="valor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={saldoDevedor}
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
                className="h-12 rounded-xl text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                Você pode quitar parcialmente ou o valor total.
              </p>
            </div>
            <Button
              size="lg"
              className="h-12 rounded-xl"
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <QrCode className="mr-2 h-5 w-5" /> Gerar QR Code
                </>
              )}
            </Button>
          </div>
        )}

        {qr && !paid && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Escaneie o QR ou copie o código para pagar{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(qr.valor)}
              </span>
            </p>
            {qr.qr_code_base64 && (
              <img
                src={`data:image/png;base64,${qr.qr_code_base64}`}
                alt="QR Code PIX"
                className="h-56 w-56 rounded-lg border border-border bg-white p-2"
              />
            )}
            <div className="flex w-full flex-col gap-2">
              <textarea
                readOnly
                value={qr.qr_code}
                className="h-20 w-full resize-none rounded-lg border border-border bg-muted p-2 text-xs"
              />
              <Button
                variant="outline"
                onClick={copyBrCode}
                className="h-11 rounded-xl"
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando
              confirmação...
            </p>
          </div>
        )}

        {paid && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-14 w-14 text-primary" />
            <p className="text-lg font-semibold">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground">
              Seu saldo devedor foi atualizado.
            </p>
            <Button className="mt-2 h-11 rounded-xl" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
