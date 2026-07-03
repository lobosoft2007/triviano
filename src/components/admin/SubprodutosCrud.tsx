import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Boxes, X } from "lucide-react";
import { toast } from "sonner";
import {
  listSubprodutos,
  saveSubproduto,
  deleteSubproduto,
  listInsumos,
  parseNumberInput,
  type Subproduto,
  type ComposicaoLinha,
} from "@/lib/erp";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { IconBtn } from "./SetoresCrud";
import { Field } from "./FornecedoresCrud";

interface CompForm {
  insumo_id: string;
  quantidade: string;
}

interface FormState {
  id: string | null;
  nome: string;
  rendimento_porcoes: string;
  modo_preparo: string;
  composicao: CompForm[];
}

const EMPTY: FormState = {
  id: null,
  nome: "",
  rendimento_porcoes: "1",
  modo_preparo: "",
  composicao: [],
};

export function SubprodutosCrud() {
  const queryClient = useQueryClient();
  const { data: subprodutos, isLoading } = useQuery({
    queryKey: ["erp-subprodutos"],
    queryFn: listSubprodutos,
  });
  const { data: insumos } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const insumoCost = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of insumos ?? []) m.set(i.id, i.custo_unitario);
    return m;
  }, [insumos]);
  const insumoName = (id: string) =>
    insumos?.find((i) => i.id === id)?.nome ?? "?";

  const totalCost = form.composicao.reduce(
    (sum, c) =>
      sum + parseNumberInput(c.quantidade) * (insumoCost.get(c.insumo_id) ?? 0),
    0,
  );
  const rendimento = parseNumberInput(form.rendimento_porcoes) || 1;
  const unitCost = totalCost / rendimento;

  const subTotalCost = (s: Subproduto) =>
    s.composicao.reduce(
      (sum, c) => sum + c.quantidade * (insumoCost.get(c.insumo_id) ?? 0),
      0,
    );

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (s: Subproduto) => {
    setForm({
      id: s.id,
      nome: s.nome,
      rendimento_porcoes: String(s.rendimento_porcoes),
      modo_preparo: s.modo_preparo,
      composicao: s.composicao.map((c) => ({
        insumo_id: c.insumo_id,
        quantidade: String(c.quantidade).replace(".", ","),
      })),
    });
    setOpen(true);
  };

  const addLinha = () => {
    const first = insumos?.[0]?.id ?? "";
    setForm((f) => ({
      ...f,
      composicao: [...f.composicao, { insumo_id: first, quantidade: "1" }],
    }));
  };
  const updateLinha = (idx: number, patch: Partial<CompForm>) => {
    setForm((f) => ({
      ...f,
      composicao: f.composicao.map((c, i) =>
        i === idx ? { ...c, ...patch } : c,
      ),
    }));
  };
  const removeLinha = (idx: number) => {
    setForm((f) => ({
      ...f,
      composicao: f.composicao.filter((_, i) => i !== idx),
    }));
  };

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do subproduto.");
      return;
    }
    setSaving(true);
    try {
      const composicao: ComposicaoLinha[] = form.composicao
        .filter((c) => c.insumo_id)
        .map((c) => ({
          insumo_id: c.insumo_id,
          quantidade: parseNumberInput(c.quantidade),
        }));
      await saveSubproduto({
        id: form.id,
        nome: form.nome,
        rendimento_porcoes: rendimento,
        modo_preparo: form.modo_preparo,
        composicao,
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["erp-subprodutos"] });
      toast.success("Subproduto salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Subproduto) {
    if (!confirm(`Remover o subproduto "${s.nome}"?`)) return;
    try {
      await deleteSubproduto(s.id);
      await queryClient.invalidateQueries({ queryKey: ["erp-subprodutos"] });
      toast.success("Subproduto removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Subprodutos</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {subprodutos?.length ?? 0}
          </span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo subproduto
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (subprodutos?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum subproduto cadastrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Subproduto</th>
                <th className="px-4 py-2.5 font-semibold">Itens</th>
                <th className="px-4 py-2.5 font-semibold">Rende</th>
                <th className="px-4 py-2.5 font-semibold">Custo total</th>
                <th className="px-4 py-2.5 font-semibold">Custo/porção</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {subprodutos!.map((s, idx) => {
                const tc = subTotalCost(s);
                return (
                  <tr key={s.id} className={idx > 0 ? "border-t border-border" : ""}>
                    <td className="px-4 py-2.5 font-medium">{s.nome}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.composicao.length}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {s.rendimento_porcoes}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">
                      {formatBRL(tc)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-primary">
                      {formatBRL(tc / (s.rendimento_porcoes || 1))}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <IconBtn label="Editar" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label="Remover"
                          destructive
                          onClick={() => handleDelete(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <ModalActionBar
            title={form.id ? "Editar subproduto" : "Novo subproduto"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Nome" className="sm:col-span-2">
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Massa de pizza"
                />
              </Field>
              <Field label="Rendimento (porções)">
                <Input
                  inputMode="decimal"
                  value={form.rendimento_porcoes}
                  onChange={(e) =>
                    setForm({ ...form, rendimento_porcoes: e.target.value })
                  }
                />
              </Field>
            </div>

            {/* Composição */}
            <div className="rounded-2xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">Composição</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addLinha}
                  disabled={!insumos?.length}
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar insumo
                </Button>
              </div>

              {!insumos?.length && (
                <p className="text-xs text-muted-foreground">
                  Cadastre insumos antes de montar a composição.
                </p>
              )}

              {form.composicao.length === 0 && insumos?.length ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum insumo adicionado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.composicao.map((c, idx) => {
                    const lineCost =
                      parseNumberInput(c.quantidade) *
                      (insumoCost.get(c.insumo_id) ?? 0);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={c.insumo_id}
                            onValueChange={(v) =>
                              updateLinha(idx, { insumo_id: v })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Insumo" />
                            </SelectTrigger>
                            <SelectContent>
                              {insumos?.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.nome} ({i.unidade_medida})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          className="h-9 w-20"
                          inputMode="decimal"
                          value={c.quantidade}
                          onChange={(e) =>
                            updateLinha(idx, { quantidade: e.target.value })
                          }
                          placeholder="Qtd"
                        />
                        <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-primary">
                          {formatBRL(lineCost)}
                        </span>
                        <IconBtn
                          label="Remover linha"
                          destructive
                          onClick={() => removeLinha(idx)}
                        >
                          <X className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Custo total: <strong>{formatBRL(totalCost)}</strong>
                </span>
                <span className="font-semibold text-primary">
                  Custo/porção: {formatBRL(unitCost)}
                </span>
              </div>
            </div>

            <Field label="Modo de preparo">
              <Textarea
                value={form.modo_preparo}
                onChange={(e) =>
                  setForm({ ...form, modo_preparo: e.target.value })
                }
                rows={2}
                placeholder="Instruções de preparo..."
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
