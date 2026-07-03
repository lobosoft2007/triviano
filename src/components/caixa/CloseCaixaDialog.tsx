import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { Button } from "@/components/ui/button";
import { MoneyCounter, type MoneyCount } from "@/components/MoneyCounter";
import { closeCaixa } from "@/lib/caixa";
import { formatBRL } from "@/lib/format";

export function CloseCaixaDialog({
  open,
  onOpenChange,
  caixaId,
  saldoEsperado,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caixaId: string;
  saldoEsperado: number;
  onClosed: () => Promise<void> | void;
}) {
  const [counts, setCounts] = useState<MoneyCount>({});
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const diff = useMemo(() => total - saldoEsperado, [total, saldoEsperado]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await closeCaixa({
        id: caixaId,
        valorFechamento: total,
        metadados: Object.keys(counts).length ? counts : null,
      });
      await onClosed();
      toast.success("Caixa fechado.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível fechar o caixa.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-xl">
        <ModalActionBar
          title="Fechamento de caixa"
          onBack={() => onOpenChange(false)}
          onSave={handleConfirm}
          saving={submitting}
          saveLabel="Fechar"
        />
        <DialogDescription>
          Conte o dinheiro físico em caixa. O valor apurado encerra o turno.
        </DialogDescription>

        <MoneyCounter
          value={counts}
          onChange={(c, t) => {
            setCounts(c);
            setTotal(t);
          }}
        />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Saldo esperado
            </p>
            <p className="font-display text-sm font-bold tabular-nums">
              {formatBRL(saldoEsperado)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Apurado
            </p>
            <p className="font-display text-sm font-bold tabular-nums text-primary">
              {formatBRL(total)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Diferença
            </p>
            <p
              className={`font-display text-sm font-bold tabular-nums ${
                Math.abs(diff) < 0.005
                  ? "text-muted-foreground"
                  : diff > 0
                    ? "text-emerald-500"
                    : "text-destructive"
              }`}
            >
              {diff > 0 ? "+" : ""}
              {formatBRL(diff)}
            </p>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
