import { useMemo, useState } from "react";
import { Coins, Banknote } from "lucide-react";
import { formatBRL } from "@/lib/caixa";

/* ------------------------------------------------------------------ */
/* Denominations                                                       */
/* ------------------------------------------------------------------ */

interface Denom {
  value: number;
  key: string;
  label: string;
}

const MOEDAS: Denom[] = [
  { value: 0.05, key: "moedas_5c", label: "R$ 0,05" },
  { value: 0.1, key: "moedas_10c", label: "R$ 0,10" },
  { value: 0.25, key: "moedas_25c", label: "R$ 0,25" },
  { value: 0.5, key: "moedas_50c", label: "R$ 0,50" },
  { value: 1.0, key: "moedas_1", label: "R$ 1,00" },
];

const CEDULAS: Denom[] = [
  { value: 2.0, key: "notas_2", label: "R$ 2,00" },
  { value: 5.0, key: "notas_5", label: "R$ 5,00" },
  { value: 10.0, key: "notas_10", label: "R$ 10,00" },
  { value: 20.0, key: "notas_20", label: "R$ 20,00" },
  { value: 50.0, key: "notas_50", label: "R$ 50,00" },
  { value: 100.0, key: "notas_100", label: "R$ 100,00" },
  { value: 200.0, key: "notas_200", label: "R$ 200,00" },
];

const ALL: Denom[] = [...MOEDAS, ...CEDULAS];

export type MoneyCount = Record<string, number>;

export function computeTotal(counts: MoneyCount): number {
  return ALL.reduce(
    (sum, d) => sum + (counts[d.key] ?? 0) * d.value,
    0,
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function MoneyCounter({
  value,
  onChange,
}: {
  value: MoneyCount;
  onChange: (counts: MoneyCount, total: number) => void;
}) {
  const total = useMemo(() => computeTotal(value), [value]);

  function setQty(key: string, raw: string) {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    const next = { ...value, [key]: n };
    if (n === 0) delete next[key];
    onChange(next, computeTotal(next));
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-t-2xl bg-border sm:grid-cols-2">
        <DenomColumn
          title="Moedas"
          icon={<Coins className="h-4 w-4" />}
          denoms={MOEDAS}
          value={value}
          onQty={setQty}
        />
        <DenomColumn
          title="Cédulas (Notas)"
          icon={<Banknote className="h-4 w-4" />}
          denoms={CEDULAS}
          value={value}
          onQty={setQty}
        />
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between rounded-b-2xl bg-primary/10 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Valor total apurado (R$)
        </span>
        <span className="font-display text-2xl font-bold tabular-nums text-primary">
          {formatBRL(total)}
        </span>
      </div>
    </div>
  );
}

function DenomColumn({
  title,
  icon,
  denoms,
  value,
  onQty,
}: {
  title: string;
  icon: React.ReactNode;
  denoms: Denom[];
  value: MoneyCount;
  onQty: (key: string, raw: string) => void;
}) {
  return (
    <div className="bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-border">
        {denoms.map((d) => {
          const qty = value[d.key] ?? 0;
          const subtotal = qty * d.value;
          return (
            <div
              key={d.key}
              className="grid grid-cols-[64px_1fr_auto] items-center gap-2 px-3 py-1.5"
            >
              <span className="text-sm font-medium tabular-nums text-foreground">
                {d.label}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={qty === 0 ? "" : qty}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => onQty(d.key, e.target.value)}
                placeholder="0"
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">
                {subtotal > 0 ? formatBRL(subtotal) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
