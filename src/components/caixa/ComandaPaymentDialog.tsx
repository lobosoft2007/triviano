import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, QrCode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { fetchMeiosPagamento } from "@/lib/caixa";
import { finalizeComandaPaid } from "@/lib/mesa";
import { fetchMpPublicConfig } from "@/lib/mercadopago";
import { ComandaPixCharge } from "@/components/checkout/ComandaPixCharge";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

/**
 * Liquidação UNIFICADA da comanda no Caixa (v1.7.0).
 * Um único clique fecha a conta INTEIRA da mesa (todos os pedidos vinculados):
 *  - Dinheiro/Cartão → registra o pagamento e finaliza via finalize_comanda_paid.
 *  - PIX online → QR agregado (valor total) confirmado pelo webhook.
 */
export function ComandaPaymentDialog({
  comandaId,
  numeroMesa,
  total,
  open,
  onOpenChange,
}: {
  comandaId: string;
  numeroMesa: number;
  total: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [meioId, setMeioId] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [onlinePix, setOnlinePix] = useState(false);

  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento"],
    queryFn: () => fetchMeiosPagamento(true),
    enabled: open,
  });

  const { data: mpConfig } = useQuery({
    queryKey: ["mp-public-config"],
    queryFn: fetchMpPublicConfig,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const mpPixActive = !!mpConfig?.ativo && !!mpConfig?.aceita_pix_online;

  useEffect(() => {
    if (!meioId && meios && meios.length > 0) setMeioId(meios[0].id);
  }, [meios, meioId]);

  const selectedMeio = useMemo(
    () => (meios ?? []).find((m) => m.id === meioId),
    [meios, meioId],
  );
  const isPixSelected =
    (selectedMeio?.nome ?? "").trim().toLowerCase() === "pix";
  const canOnlinePix = mpPixActive && isPixSelected && total > 0;

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["caixa-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["caixa-movs"] }),
      queryClient.invalidateQueries({ queryKey: ["mesa-fechamentos"] }),
    ]);
  }

  async function handleFinalize() {
    if (!meioId) {
      toast.error("Selecione um meio de pagamento.");
      return;
    }
    setFinalizing(true);
    try {
      await finalizeComandaPaid(comandaId, meioId);
      await invalidateAll();
      toast.success(`Mesa ${numeroMesa} liquidada com sucesso! 🎉`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar.";
      if (msg.includes("ESTOQUE_INSUFICIENTE")) {
        const insumo = msg.split("ESTOQUE_INSUFICIENTE:")[1]?.trim() || "um insumo";
        toast.error(
          `Estoque insuficiente: "${insumo}" acabou de esgotar. Reponha o estoque para prosseguir.`,
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setFinalizing(false);
    }
  }

  async function handleOnlinePixConfirmed() {
    // O webhook já liquidou a comanda no servidor; aqui só atualizamos a UI.
    await invalidateAll();
    toast.success(`Mesa ${numeroMesa} paga via PIX! 🎉`);
    setOnlinePix(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-md overflow-y-auto">
        <ModalActionBar
          title={
            onlinePix
              ? `PIX · Mesa ${numeroMesa}`
              : `Finalizar e Receber · Mesa ${numeroMesa}`
          }
          onBack={() => (onlinePix ? setOnlinePix(false) : onOpenChange(false))}
          onSave={handleFinalize}
          saving={finalizing}
          saveDisabled={!meioId}
          saveLabel="Finalizar e Receber"
          hideSave={onlinePix}
        />

        {onlinePix && mpConfig ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total a receber
              </p>
              <p className="font-display text-2xl font-black tabular-nums">
                {formatBRL(total)}
              </p>
            </div>
            <ComandaPixCharge
              comandaId={comandaId}
              total={total}
              config={mpConfig}
              onConfirmed={handleOnlinePixConfirmed}
            />
            <Button
              variant="ghost"
              onClick={() => setOnlinePix(false)}
              disabled={finalizing}
              className="h-11 w-full rounded-xl font-semibold text-muted-foreground"
            >
              Voltar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total da conta (todos os pedidos)
              </p>
              <p className="font-display text-3xl font-black tabular-nums text-success">
                {formatBRL(total)}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Meio de pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {(meios ?? []).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMeioId(m.id)}
                    className={`flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      meioId === m.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    {meioId === m.id && (
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    )}
                    {m.nome}
                  </button>
                ))}
              </div>
            </div>

            {canOnlinePix && (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl"
                onClick={() => setOnlinePix(true)}
                disabled={finalizing}
              >
                <QrCode className="mr-2 h-5 w-5" /> Cobrar via PIX (QR do total)
              </Button>
            )}

            {finalizing && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Liquidando conta…
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
