import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const NONE = "__none__";

export interface RelRow {
  label: string;
  preco: string;
}

export interface ProductDetailForm {
  manipulado: boolean;
  setor_id: string;
  fornecedor_id: string;
  price_options: RelRow[];
  addons: RelRow[];
  free_addons: RelRow[];
  ncm: string;
  ean: string;
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
};

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

export function ProductDetailFields({
  value,
  onChange,
  setores,
  fornecedores,
}: {
  value: ProductDetailForm;
  onChange: (v: ProductDetailForm) => void;
  setores: { id: string; setor: string }[];
  fornecedores: { id: string; fornecedor: string }[];
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
        <Switch
          checked={value.manipulado}
          onCheckedChange={(v) => patch({ manipulado: v })}
        />
      </div>

      {/* Setor / Fornecedor for revenda items */}
      {!value.manipulado && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select
              value={value.fornecedor_id}
              onValueChange={(v) => patch({ fornecedor_id: v })}
            >
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
            <Select
              value={value.setor_id}
              onValueChange={(v) => patch({ setor_id: v })}
            >
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

      <RelListEditor
        title="Tamanhos / opções de preço"
        labelPlaceholder="Ex.: Grande"
        rows={value.price_options}
        onChange={(rows) => patch({ price_options: rows })}
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
    </div>
  );
}
