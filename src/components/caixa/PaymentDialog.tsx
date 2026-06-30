import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  fetchPagamentos,
  addPagamento,
  deletePagamento,
  finalizeOrderPaid,
  FORMAS_PAGAMENTO,
  type CaixaOrder,
  type FormaPagamento,
} from "@/lib/caixa";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PaymentDialog({
  order,
  open,
  onOpenChange,
}: {
  order: CaixaOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: pagamentos, isLoading } = useQuery({
    queryKey: ["pagamentos", order.id],
    queryFn: () => fetchPagamentos(order.id),
    enabled: open,
  });

  const [forma, setForma] = useState<FormaPagamento>("Dinheiro");
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const totalPago = useMemo(
    () => (pagamentos ?? []).reduce((s, p) => s + p.valor_pago, 0),
    [pagamentos],
  );
  const restante = Math.round((order.total - totalPago) * 100) / 100;
  const matches = Math.abs(restante) < 0.005;

  async function handleAdd() {
    const v = Number(valor.replace(",", "."));
    if (Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setBusy(true);
    try {
      await addPagamento({ orderId: order.id, forma, valor: v });
      await queryClient.invalidateQueries({ queryKey: ["pagamentos", order.id] });
      setValor("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  function fillRemaining() {
    if (restante > 0) setValor(restante.toFixed(2));
  }

  async function handleRemove(id: string) {
    try {
      await deletePagamento(id);
      await queryClient.invalidateQueries({ queryKey: ["pagamentos", order.id] });
    } catch {
      toast.error("Erro ao remover pagamento.");
    }
  }

  async function handleFinalize() {
    if (!matches) return;
    setFinalizing(true);
    try {
      await finalizeOrderPaid(order.id);
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      toast.success(`Pedido #${order.id.slice(0, 6).toUpperCase()} baixado.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar.");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Dividir pagamento · #{order.id.slice(0, 6).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add line */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label>Adicionar pagamento</Label>
            <div className="flex gap-2">
              <select
                value={forma}
                onChange={(e) => setForma(e.target.value as FormaPagamento)}
                className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="h-10 w-28 rounded-lg"
              />
              <Button onClick={handleAdd} disabled={busy} size="icon" className="h-10 w-10 shrink-0">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            {restante > 0 && (
              <button
                onClick={fillRemaining}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Preencher restante ({formatBRL(restante)})
              </button>
            )}
          </div>

          {/* Lines */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (pagamentos?.length ?? 0) === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Nenhum pagamento lançado ainda.
              </p>
            ) : (
              pagamentos!.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span className="font-medium">{p.forma_pagamento}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatBRL(p.valor_pago)}
                    </span>
                    <button
                      onClick={() => handleRemove(p.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          <div className="space-y-1 rounded-xl bg-card p-3 text-sm shadow-card">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total do pedido</span>
              <span className="tabular-nums">{formatBRL(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pago</span>
              <span className="tabular-nums">{formatBRL(totalPago)}</span>
            </div>
            <div
              className={`flex justify-between border-t border-border pt-1 font-display font-bold ${
                matches ? "text-success" : "text-destructive"
              }`}
            >
              <span>{restante >= 0 ? "Restante" : "Excedente"}</span>
              <span className="tabular-nums">{formatBRL(Math.abs(restante))}</span>
            </div>
          </div>

          {!matches && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              A soma dos pagamentos precisa bater exatamente com o total para
              baixar o pedido.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleFinalize}
            disabled={!matches || finalizing}
            className="w-full"
          >
            {finalizing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Finalizar e baixar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
