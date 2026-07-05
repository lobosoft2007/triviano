import { useMemo } from "react";
import { Plus, X, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/format";
import { subprodutoUnitCost } from "@/lib/cost";
import type { Insumo, Subproduto } from "@/lib/erp";

/** A single editable recipe line in the product form. */
export interface FichaRow {
  tipo: "insumo" | "subproduto";
  ref_id: string;
  nome: string;
  /** Text input value (comma decimals allowed). */
  quantidade: string;
  permitir_exclusao: boolean;
}

const parseQty = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pure CMV of a set of ficha rows using the current insumo/subproduto costs. */
export function computeFichaCMV(
  rows: FichaRow[],
  insumos: Insumo[],
  subprodutos: Subproduto[],
): number {
  const insumoCusto = new Map(insumos.map((i) => [i.id, i.custo_unitario]));
  const insumoFator = new Map(insumos.map((i) => [i.id, i.fator_conversao ?? 1]));
  const subprodutoRendimento = new Map(
    subprodutos.map((s) => [s.id, s.rendimento_porcoes]),
  );
  const composicao = new Map(subprodutos.map((s) => [s.id, s.composicao]));
  return rows.reduce((sum, r) => {
    if (!r.ref_id) return sum;
    const unit =
      r.tipo === "insumo"
        ? (insumoCusto.get(r.ref_id) ?? 0) * (insumoFator.get(r.ref_id) ?? 1)
        : subprodutoUnitCost(r.ref_id, {
            insumoCusto,
            insumoFator,
            subprodutoRendimento,
            composicao,
          });
    return sum + parseQty(r.quantidade) * unit;
  }, 0);
}

function encode(tipo: "insumo" | "subproduto", id: string) {
  return `${tipo}:${id}`;
}

export function FichaTecnicaEditor({
  value,
  onChange,
  insumos,
  subprodutos,
}: {
  value: FichaRow[];
  onChange: (rows: FichaRow[]) => void;
  insumos: Insumo[];
  subprodutos: Subproduto[];
}) {
  // Cost lookup maps (memoized).
  const maps = useMemo(() => {
    const insumoCusto = new Map<string, number>(
      insumos.map((i) => [i.id, i.custo_unitario]),
    );
    const insumoFator = new Map<string, number>(
      insumos.map((i) => [i.id, i.fator_conversao ?? 1]),
    );
    const insumoUnidadeConsumo = new Map<string, string>(
      insumos.map((i) => [i.id, i.unidade_medida || i.unidade_estoque]),
    );
    const insumoUnidadeEstoque = new Map<string, string>(
      insumos.map((i) => [i.id, i.unidade_estoque || i.unidade_medida]),
    );
    const subprodutoRendimento = new Map<string, number>(
      subprodutos.map((s) => [s.id, s.rendimento_porcoes]),
    );
    const composicao = new Map(
      subprodutos.map((s) => [s.id, s.composicao]),
    );
    return {
      insumoCusto,
      insumoFator,
      insumoUnidadeConsumo,
      insumoUnidadeEstoque,
      subprodutoRendimento,
      composicao,
    };
  }, [insumos, subprodutos]);

  // Raw cost per stock unit — used for the gray "R$ X/KG" reference label.
  const unitCostOf = (row: FichaRow): number => {
    if (!row.ref_id) return 0;
    if (row.tipo === "insumo") return maps.insumoCusto.get(row.ref_id) ?? 0;
    return subprodutoUnitCost(row.ref_id, maps);
  };

  // Proportional line cost: insumo quantity is in the recipe unit and must be
  // converted to the stock unit via fator_conversao (fallback 1). Subprodutos
  // are already priced per KG, matching the KG quantity entered.
  const lineCostOf = (row: FichaRow): number => {
    if (!row.ref_id) return 0;
    const qty = parseQty(row.quantidade);
    if (row.tipo === "insumo") {
      const custo = maps.insumoCusto.get(row.ref_id) ?? 0;
      const fator = maps.insumoFator.get(row.ref_id) ?? 1;
      return qty * fator * custo;
    }
    return qty * subprodutoUnitCost(row.ref_id, maps);
  };

  /** Unit shown next to the recipe quantity input (consumption unit). */
  const consumptionUnitLabelOf = (row: FichaRow): string => {
    if (row.tipo === "insumo") return maps.insumoUnidadeConsumo.get(row.ref_id) ?? "un";
    return "KG";
  };

  /** Unit shown in the gray reference-cost label (purchase/stock unit). */
  const stockUnitLabelOf = (row: FichaRow): string => {
    if (row.tipo === "insumo") {
      return (maps.insumoUnidadeEstoque.get(row.ref_id) ?? "un").toUpperCase();
    }
    return "KG";
  };

  const add = () =>
    onChange([
      ...value,
      { tipo: "insumo", ref_id: "", nome: "", quantidade: "", permitir_exclusao: false },
    ]);
  const update = (idx: number, patch: Partial<FichaRow>) =>
    onChange(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) =>
    onChange(value.filter((_, i) => i !== idx));

  const onSelect = (idx: number, encoded: string) => {
    const [tipo, id] = encoded.split(":") as ["insumo" | "subproduto", string];
    const nome =
      tipo === "insumo"
        ? insumos.find((i) => i.id === id)?.nome ?? ""
        : subprodutos.find((s) => s.id === id)?.nome ?? "";
    update(idx, { tipo, ref_id: id, nome });
  };

  const totalCMV = value.reduce((sum, r) => sum + lineCostOf(r), 0);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">
            Ficha Técnica / Composição da Receita
          </Label>
          <p className="text-xs text-muted-foreground">
            Insumos e subprodutos que compõem este prato.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar Ingrediente ou Subproduto
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum componente na receita.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* Header row (desktop dense layout) */}
          <div className="hidden grid-cols-[1fr_140px_120px_minmax(0,150px)_36px] items-center gap-2 border-b border-border bg-secondary px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Insumo / Subproduto</span>
            <span>Quantidade</span>
            <span>Remoção</span>
            <span className="text-right">Custo proporcional</span>
            <span />
          </div>

          <div className="divide-y divide-border">
            {value.map((row, idx) => {
              const unitCost = unitCostOf(row);
              const proportional = lineCostOf(row);
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 md:grid-cols-[1fr_140px_120px_minmax(0,150px)_36px]"
                >
                  {/* Item picker */}
                  <Select
                    value={row.ref_id ? encode(row.tipo, row.ref_id) : ""}
                    onValueChange={(v) => onSelect(idx, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o componente" />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Insumos</SelectLabel>
                          {insumos.map((i) => (
                            <SelectItem key={i.id} value={encode("insumo", i.id)}>
                              {i.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {subprodutos.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Subprodutos</SelectLabel>
                          {subprodutos.map((s) => (
                            <SelectItem
                              key={s.id}
                              value={encode("subproduto", s.id)}
                            >
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Quantity + unit */}
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="h-9"
                      inputMode="decimal"
                      value={row.quantidade}
                      onChange={(e) => update(idx, { quantidade: e.target.value })}
                      placeholder="0"
                    />
                    <span className="w-12 shrink-0 text-xs text-muted-foreground">
                      {unitLabelOf(row)}
                    </span>
                  </div>

                  {/* Permitir exclusão */}
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <Checkbox
                      checked={row.permitir_exclusao}
                      onCheckedChange={(c) =>
                        update(idx, { permitir_exclusao: c === true })
                      }
                    />
                    <span className="md:hidden">
                      Permitir que o cliente remova
                    </span>
                    <span className="hidden md:inline">Cliente remove</span>
                  </label>

                  {/* Proportional cost */}
                  <div className="text-right text-sm font-semibold tabular-nums">
                    {formatBRL(proportional)}
                    <span className="ml-1 hidden text-[10px] font-normal text-muted-foreground md:inline">
                      ({formatBRL(unitCost)}/{unitLabelOf(row)})
                    </span>
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    aria-label="Remover componente"
                    onClick={() => remove(idx)}
                    className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Total CMV */}
          <div className="flex items-center justify-between border-t border-border bg-secondary px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Calculator className="h-4 w-4 text-primary" />
              Custo de Produção Total (CMV)
            </span>
            <span className="text-base font-bold tabular-nums text-primary">
              {formatBRL(totalCMV)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
