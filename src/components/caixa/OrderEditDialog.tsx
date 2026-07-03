import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  saveOrderEdits,
  recalcOrderTotal,
  itemsSubtotal,
  type CaixaOrder,
} from "@/lib/caixa";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

interface EditableItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  size: string;
  removed: boolean;
}

export function OrderEditDialog({
  order,
  open,
  onOpenChange,
}: {
  order: CaixaOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<EditableItem[]>(() =>
    order.order_items.map((it) => ({
      id: it.id,
      product_name: it.product_name,
      unit_price: it.unit_price,
      quantity: it.quantity,
      size: it.size,
      removed: false,
    })),
  );
  const [obs, setObs] = useState(order.observacoes_operador);
  const [descMode, setDescMode] = useState<"R$" | "%">("R$");
  const [descValue, setDescValue] = useState(
    order.desconto_manual ? String(order.desconto_manual) : "",
  );
  const [saving, setSaving] = useState(false);

  const keptItems = items.filter((i) => !i.removed);
  const subtotal = useMemo(
    () => itemsSubtotal(keptItems.map((i) => ({ ...i } as never))),
    [keptItems],
  );

  const descManualReais = useMemo(() => {
    const raw = Number(descValue.replace(",", ".")) || 0;
    if (raw <= 0) return 0;
    return descMode === "%" ? (subtotal * raw) / 100 : raw;
  }, [descValue, descMode, subtotal]);

  const total = useMemo(
    () =>
      recalcOrderTotal(
        keptItems.map((i) => ({ ...i } as never)),
        order.discount,
        descManualReais,
      ),
    [keptItems, order.discount, descManualReais],
  );

  function setQty(id: string, delta: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i,
      ),
    );
  }
  function toggleRemove(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, removed: !i.removed } : i)),
    );
  }

  async function handleSave() {
    if (keptItems.length === 0) {
      toast.error("O pedido precisa ter ao menos 1 item.");
      return;
    }
    setSaving(true);
    try {
      await saveOrderEdits({
        orderId: order.id,
        items: keptItems.map((i) => ({ id: i.id, quantity: i.quantity })),
        removedItemIds: items.filter((i) => i.removed).map((i) => i.id),
        observacoesOperador: obs,
        descontoManual: descManualReais,
        total,
      });
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      toast.success("Pedido atualizado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-h-[90vh] max-w-lg overflow-y-auto">
        <ModalActionBar
          title={`Editar pedido #${order.id.slice(0, 6).toUpperCase()}`}
          onBack={() => onOpenChange(false)}
          onSave={handleSave}
          saving={saving}
          saveLabel="Salvar"
        />

        <div className="space-y-4">
          {/* Items */}
          <div className="space-y-2">
            <Label>Itens</Label>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`flex items-center gap-2 px-3 py-2 ${
                    it.removed ? "bg-destructive/5 opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        it.removed ? "line-through" : ""
                      }`}
                    >
                      {it.product_name}
                      {it.size ? ` (${it.size})` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(it.unit_price)} un ·{" "}
                      {formatBRL(it.unit_price * it.quantity)}
                    </p>
                  </div>
                  {!it.removed && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQty(it.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-secondary"
                        aria-label="Diminuir"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => setQty(it.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-secondary"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => toggleRemove(it.id)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md ${
                      it.removed
                        ? "text-primary hover:bg-primary/10"
                        : "text-destructive hover:bg-destructive/10"
                    }`}
                    aria-label={it.removed ? "Restaurar item" : "Excluir item"}
                    title={it.removed ? "Restaurar" : "Excluir"}
                  >
                    {it.removed ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Manual discount */}
          <div className="space-y-2">
            <Label htmlFor="desc-manual">Desconto manual</Label>
            <div className="flex gap-2">
              <div className="flex overflow-hidden rounded-lg border border-border">
                {(["R$", "%"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDescMode(m)}
                    className={`px-3 text-sm font-semibold ${
                      descMode === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Input
                id="desc-manual"
                inputMode="decimal"
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                placeholder="0,00"
                className="h-10 flex-1 rounded-lg"
              />
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="obs-operador">Observações gerais do operador</Label>
            <Textarea
              id="obs-operador"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: cliente pediu troco para R$100, entregar até 20h…"
              rows={3}
            />
          </div>

          {/* Totals */}
          <div className="space-y-1 rounded-xl bg-secondary px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatBRL(subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Desconto automático</span>
                <span className="tabular-nums">- {formatBRL(order.discount)}</span>
              </div>
            )}
            {descManualReais > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Desconto manual</span>
                <span className="tabular-nums">
                  - {formatBRL(descManualReais)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 font-display font-bold">
              <span>Total</span>
              <span className="tabular-nums text-primary">
                {formatBRL(total)}
              </span>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
