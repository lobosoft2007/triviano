import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import {
  listInsumos,
  saveInsumo,
  deleteInsumo,
  listSetores,
  listFornecedores,
  parseNumberInput,
  type Insumo,
} from "@/lib/erp";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconBtn } from "./SetoresCrud";
import { Field } from "./FornecedoresCrud";

const NONE = "__none__";

interface FormState {
  id: string | null;
  nome: string;
  unidade_medida: string;
  custo_unitario: string;
  estocavel: boolean;
  fornecedor_id: string;
  setor_id: string;
  estoque_minimo: string;
  estoque_maximo: string;
}

const EMPTY: FormState = {
  id: null,
  nome: "",
  unidade_medida: "un",
  custo_unitario: "",
  estocavel: true,
  fornecedor_id: NONE,
  setor_id: NONE,
  estoque_minimo: "0",
  estoque_maximo: "0",
};

export function InsumosCrud() {
  const queryClient = useQueryClient();
  const { data: insumos, isLoading } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
  });
  const { data: setores } = useQuery({
    queryKey: ["erp-setores"],
    queryFn: listSetores,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const setorName = (id: string | null) =>
    setores?.find((s) => s.id === id)?.setor ?? "—";
  const fornName = (id: string | null) =>
    fornecedores?.find((f) => f.id === id)?.fornecedor ?? "—";

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (i: Insumo) => {
    setForm({
      id: i.id,
      nome: i.nome,
      unidade_medida: i.unidade_medida,
      custo_unitario: String(i.custo_unitario).replace(".", ","),
      estocavel: i.estocavel,
      fornecedor_id: i.fornecedor_id ?? NONE,
      setor_id: i.setor_id ?? NONE,
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do insumo.");
      return;
    }
    setSaving(true);
    try {
      await saveInsumo({
        id: form.id,
        nome: form.nome,
        unidade_medida: form.unidade_medida,
        custo_unitario: parseNumberInput(form.custo_unitario),
        estocavel: form.estocavel,
        fornecedor_id: form.fornecedor_id === NONE ? null : form.fornecedor_id,
        setor_id: form.setor_id === NONE ? null : form.setor_id,
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["erp-insumos"] });
      toast.success("Insumo salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(i: Insumo) {
    if (!confirm(`Remover o insumo "${i.nome}"?`)) return;
    try {
      await deleteInsumo(i.id);
      await queryClient.invalidateQueries({ queryKey: ["erp-insumos"] });
      toast.success("Insumo removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Insumos</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {insumos?.length ?? 0}
          </span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo insumo
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (insumos?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum insumo cadastrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Insumo</th>
                <th className="px-4 py-2.5 font-semibold">Un.</th>
                <th className="px-4 py-2.5 font-semibold">Custo</th>
                <th className="px-4 py-2.5 font-semibold">Fornecedor</th>
                <th className="px-4 py-2.5 font-semibold">Setor</th>
                <th className="px-4 py-2.5 font-semibold">Estoque</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {insumos!.map((i, idx) => (
                <tr key={i.id} className={idx > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-medium">{i.nome}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {i.unidade_medida}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-primary">
                    {formatBRL(i.custo_unitario)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {fornName(i.fornecedor_id)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {setorName(i.setor_id)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        i.estocavel
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {i.estocavel ? "Estocável" : "Não estocável"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <IconBtn label="Editar" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        label="Remover"
                        destructive
                        onClick={() => handleDelete(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar insumo" : "Novo insumo"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Bacon em fatias"
              />
            </Field>
            <Field label="Unidade de medida">
              <Input
                value={form.unidade_medida}
                onChange={(e) =>
                  setForm({ ...form, unidade_medida: e.target.value })
                }
                placeholder="kg, un, L..."
              />
            </Field>
            <Field label="Custo unitário (R$)">
              <Input
                inputMode="decimal"
                value={form.custo_unitario}
                onChange={(e) =>
                  setForm({ ...form, custo_unitario: e.target.value })
                }
                placeholder="0,00"
              />
            </Field>
            <Field label="Fornecedor">
              <Select
                value={form.fornecedor_id}
                onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {fornecedores?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.fornecedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Setor">
              <Select
                value={form.setor_id}
                onValueChange={(v) => setForm({ ...form, setor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {setores?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 sm:col-span-2">
              <div>
                <Label className="cursor-pointer">Item estocável</Label>
                <p className="text-xs text-muted-foreground">
                  Desligue para mão de obra, gás, energia, impostos.
                </p>
              </div>
              <Switch
                checked={form.estocavel}
                onCheckedChange={(v) => setForm({ ...form, estocavel: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
