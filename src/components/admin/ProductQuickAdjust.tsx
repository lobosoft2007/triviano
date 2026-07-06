import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { quickAdjustProduct } from "@/lib/erp";

const parseNum = (s: string) => {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const toInput = (n: number) =>
  n ? String(n).replace(".", ",") : "";

/**
 * Inline quick-adjust on the product card.
 * - Manipulado items: only the stock balance.
 * - Revenda items: stock balance + purchase cost (custo de compra), which
 *   re-triggers the resale-price suggestion on save.
 */
export function ProductQuickAdjust({
  id,
  manipulado,
  saldoEstoque,
  custoCompra,
  onSaved,
}: {
  id: string;
  manipulado: boolean;
  saldoEstoque: number;
  custoCompra: number;
  onSaved: () => void | Promise<void>;
}) {
  const [saldo, setSaldo] = useState(toInput(saldoEstoque));
  const [custo, setCusto] = useState(toInput(custoCompra));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSaldo(toInput(saldoEstoque));
    setCusto(toInput(custoCompra));
  }, [saldoEstoque, custoCompra]);

  const save = async () => {
    setSaving(true);
    try {
      await quickAdjustProduct({
        id,
        manipulado,
        saldo_estoque: parseNum(saldo),
        custo_compra: manipulado ? undefined : parseNum(custo),
      });
      toast.success("Ajuste salvo.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar ajuste.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1.5 flex items-end gap-1.5">
      <div className="flex-1 space-y-0.5">
        <span className="text-[10px] font-medium text-muted-foreground">
          Estoque
        </span>
        <Input
          className="h-7 text-xs"
          inputMode="decimal"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          placeholder="0"
        />
      </div>
      {!manipulado && (
        <div className="flex-1 space-y-0.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            Custo compra
          </span>
          <Input
            className="h-7 text-xs"
            inputMode="decimal"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
            placeholder="0,00"
          />
        </div>
      )}
      <button
        type="button"
        aria-label="Salvar ajuste rápido"
        onClick={save}
        disabled={saving}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
