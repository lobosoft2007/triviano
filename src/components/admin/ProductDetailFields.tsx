import { useMemo, useState } from "react";
import { Plus, X, ChefHat, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FichaTecnicaEditor, computeFichaCMV, type FichaRow } from "@/components/admin/FichaTecnicaEditor";
import { formatBRL } from "@/lib/format";
import type { Insumo, Subproduto } from "@/lib/erp";

export const NONE = "__none__";

export interface RelRow {
  label: string;
  preco: string;
}

/** A price option (variação) can carry its own ficha técnica. */
export interface PriceOptionRow extends RelRow {
  /** Stable id used to link ficha lines to this variation. */
  id: string;
  ficha: FichaRow[];
}

export interface ProductDetailForm {
  manipulado: boolean;
  setor_id: string;
  fornecedor_id: string;
  price_options: PriceOptionRow[];
  addons: RelRow[];
  free_addons: RelRow[];
  ncm: string;
  ean: string;
  ficha: FichaRow[];
}

export const EMPTY_DETAIL: ProductDetailForm = {
  manipulado: true,
  setor_id: NONE,
  fornecedor_id: NONE,
  price_options: [],
  addons: [],
  free_addons: [],
  ncm: "",
  ean: "",
  ficha: [],
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

function RelListEditor({
  title,
  labelPlaceholder,
  rows,
  onChange,
}: {
  title: string;
  labelPlaceholder: string;
  rows: RelRow[];
  onChange: (rows: RelRow[]) => void;
}) {
  const add = () => onChange([...rows, { label: "", preco: "" }]);
  const update = (idx: number, patch: Partial<RelRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-sm font-semibold">{title}</Label>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                className="h-9 flex-1"
                value={r.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder={labelPlaceholder}
              />
              <Input
                className="h-9 w-24"
                inputMode="decimal"
                value={r.preco}
                onChange={(e) => update(idx, { preco: e.target.value })}
                placeholder="0,00"
              />
              <button
                type="button"
                aria-label="Remover"
                onClick={() => remove(idx)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small icon-only action button with a floating tooltip. */
function IconBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PriceOptionsEditor({
  rows,
  onChange,
  baseFicha,
  insumos,
  subprodutos,
}: {
  rows: PriceOptionRow[];
  onChange: (rows: PriceOptionRow[]) => void;
  baseFicha: FichaRow[];
  insumos: Insumo[];
  subprodutos: Subproduto[];
}) {
  const [editing, setEditing] = useState<number | null>(null);

  const add = () => onChange([...rows, { id: newId(), label: "", preco: "", ficha: [] }]);
  const update = (idx: number, patch: Partial<PriceOptionRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

  const baseCMV = useMemo(() => computeFichaCMV(baseFicha, insumos, subprodutos), [baseFicha, insumos, subprodutos]);

  const active = editing !== null ? rows[editing] : null;
  const variationCMV = active ? computeFichaCMV(active.ficha, insumos, subprodutos) : 0;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Tamanhos / opções de preço
        </Label>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => {
            const count = r.ficha.filter((f) => f.ref_id).length;
            return (
              <div key={r.id} className="flex items-center gap-2">
                <Input
                  className="h-9 flex-1"
                  value={r.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder="Ex.: Grande"
                />
                <Input
                  className="h-9 w-24"
                  inputMode="decimal"
                  value={r.preco}
                  onChange={(e) => update(idx, { preco: e.target.value })}
                  placeholder="0,00"
                />
                <IconBtn
                  onClick={() => setEditing(idx)}
                  title="Configurar Ficha Técnica da Variação"
                  active={count > 0}
                >
                  <ChefHat className="h-4 w-4" />
                  {count > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </IconBtn>
                <button
                  type="button"
                  aria-label="Remover"
                  onClick={() => remove(idx)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent hideClose className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <ModalActionBar
            title={
              <span className="flex items-center justify-center gap-2">
                <ChefHat className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">
                  Ficha Técnica da Variação
                  {active?.label ? ` · ${active.label}` : ""}
                </span>
              </span>
            }
            onBack={() => setEditing(null)}
            onSave={() => setEditing(null)}
            saveLabel="Concluir"
          />

          {active && editing !== null && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Insumos e subprodutos específicos desta variação. Somam-se à ficha base do produto no cálculo do CMV.
              </p>

              <FichaTecnicaEditor
                value={active.ficha}
                onChange={(f) => update(editing, { ficha: f })}
                insumos={insumos}
                subprodutos={subprodutos}
              />

              {/* Combined CMV: base + this variation */}
              <div className="space-y-1.5 rounded-xl border border-border bg-secondary p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>CMV base do produto</span>
                  <span className="tabular-nums">{formatBRL(baseCMV)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>CMV desta variação</span>
                  <span className="tabular-nums">{formatBRL(variationCMV)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-primary" />
                    CMV total ({active.label || "variação"})
                  </span>
                  <span className="tabular-nums text-primary">{formatBRL(baseCMV + variationCMV)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProductDetailFields({
  value,
  onChange,
  setores,
  fornecedores,
  insumos,
  subprodutos,
}: {
  value: ProductDetailForm;
  onChange: (v: ProductDetailForm) => void;
  setores: { id: string; setor: string }[];
  fornecedores: { id: string; fornecedor: string }[];
  insumos: Insumo[];
  subprodutos: Subproduto[];
}) {
  const patch = (p: Partial<ProductDetailForm>) => onChange({ ...value, ...p });

  return (
    <div className="space-y-4 border-t border-border pt-4">
      {/* Manipulado */}
      <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
        <div>
          <Label className="cursor-pointer">Manipulado (preparado na casa)</Label>
          <p className="text-xs text-muted-foreground">
            Ligado: custo vem da ficha técnica. Desligado: produto de revenda.
          </p>
        </div>
        <Switch checked={value.manipulado} onCheckedChange={(v) => patch({ manipulado: v })} />
      </div>

      {/* Setor / Fornecedor for revenda items */}
      {!value.manipulado && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select value={value.fornecedor_id} onValueChange={(v) => patch({ fornecedor_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.fornecedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={value.setor_id} onValueChange={(v) => patch({ setor_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {setores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.setor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Dados fiscais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="prod-ncm">NCM</Label>
          <Input
            id="prod-ncm"
            value={value.ncm}
            onChange={(e) => patch({ ncm: e.target.value })}
            placeholder="0000.00.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prod-ean">EAN / GTIN</Label>
          <Input
            id="prod-ean"
            value={value.ean}
            onChange={(e) => patch({ ean: e.target.value })}
            placeholder="789..."
          />
        </div>
      </div>

      <PriceOptionsEditor
        rows={value.price_options}
        onChange={(rows) => patch({ price_options: rows })}
        baseFicha={value.ficha}
        insumos={insumos}
        subprodutos={subprodutos}
      />
      <RelListEditor
        title="Adicionais pagos"
        labelPlaceholder="Ex.: Bacon extra"
        rows={value.addons}
        onChange={(rows) => patch({ addons: rows })}
      />
      <RelListEditor
        title="Adicionais grátis (excedente cobrado pelo preço informado)"
        labelPlaceholder="Ex.: Granola"
        rows={value.free_addons}
        onChange={(rows) => patch({ free_addons: rows })}
      />

      <FichaTecnicaEditor
        value={value.ficha}
        onChange={(rows) => patch({ ficha: rows })}
        insumos={insumos}
        subprodutos={subprodutos}
      />
    </div>
  );
}
