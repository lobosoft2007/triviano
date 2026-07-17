import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Bike } from "lucide-react";
import { toast } from "sonner";
import {
  listEntregadores,
  saveEntregador,
  deleteEntregador,
  type Entregador,
} from "@/lib/entregas";
import { empresaAdminConfigQueryOptions } from "@/lib/empresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconBtn } from "./SetoresCrud";
import { Field } from "./FornecedoresCrud";

interface FormState {
  id: string | null;
  nome: string;
  telefone: string;
  cpf: string;
  placa_veiculo: string;
  tipo_veiculo: string;
  ativo: boolean;
  comissao_percentual: string;
  comissao_fixa_por_entrega: string;
}

const EMPTY: FormState = {
  id: null,
  nome: "",
  telefone: "",
  cpf: "",
  placa_veiculo: "",
  tipo_veiculo: "moto",
  ativo: true,
  comissao_percentual: "0",
  comissao_fixa_por_entrega: "0",
};

const parseNum = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function EntregadoresCrud() {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaAdminConfigQueryOptions);
  const { data, isLoading } = useQuery({
    queryKey: ["entregadores"],
    queryFn: listEntregadores,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (e: Entregador) => {
    setForm({
      id: e.id,
      nome: e.nome,
      telefone: e.telefone,
      cpf: e.cpf,
      placa_veiculo: e.placa_veiculo,
      tipo_veiculo: e.tipo_veiculo || "moto",
      ativo: e.ativo,
      comissao_percentual: String(e.comissao_percentual).replace(".", ","),
      comissao_fixa_por_entrega: String(e.comissao_fixa_por_entrega).replace(".", ","),
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!empresa) return;
    if (!form.nome.trim()) {
      toast.error("Informe o nome do entregador.");
      return;
    }
    setSaving(true);
    try {
      await saveEntregador({
        id: form.id,
        empresa_id: empresa.id,
        nome: form.nome,
        telefone: form.telefone,
        cpf: form.cpf,
        placa_veiculo: form.placa_veiculo,
        tipo_veiculo: form.tipo_veiculo,
        ativo: form.ativo,
        comissao_percentual: parseNum(form.comissao_percentual),
        comissao_fixa_por_entrega: parseNum(form.comissao_fixa_por_entrega),
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["entregadores"] });
      toast.success("Entregador salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: Entregador) {
    if (!confirm(`Remover o entregador "${e.nome}"?`)) return;
    try {
      await deleteEntregador(e.id);
      await queryClient.invalidateQueries({ queryKey: ["entregadores"] });
      toast.success("Entregador removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Entregadores</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {data?.length ?? 0}
          </span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo entregador
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum entregador cadastrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Nome</th>
                <th className="px-4 py-2.5 font-semibold">Telefone</th>
                <th className="px-4 py-2.5 font-semibold">Veículo</th>
                <th className="px-4 py-2.5 font-semibold">Placa</th>
                <th className="px-4 py-2.5 font-semibold">Comissão</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data!.map((e, idx) => (
                <tr key={e.id} className={idx > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-medium">{e.nome}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {e.telefone || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">
                    {e.tipo_veiculo}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground uppercase">
                    {e.placa_veiculo || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {e.comissao_percentual > 0 && `${e.comissao_percentual}%`}
                    {e.comissao_percentual > 0 && e.comissao_fixa_por_entrega > 0 && " + "}
                    {e.comissao_fixa_por_entrega > 0 &&
                      `R$ ${e.comissao_fixa_por_entrega.toFixed(2)}/entrega`}
                    {e.comissao_percentual === 0 && e.comissao_fixa_por_entrega === 0 && "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        e.ativo
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {e.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <IconBtn label="Editar" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        label="Remover"
                        destructive
                        onClick={() => handleDelete(e)}
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
        <DialogContent hideClose className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <ModalActionBar
            title={form.id ? "Editar entregador" : "Novo entregador"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="Telefone (WhatsApp)">
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(21) 99999-9999"
              />
            </Field>
            <Field label="CPF">
              <Input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="Tipo de veículo">
              <Select
                value={form.tipo_veiculo}
                onValueChange={(v) => setForm({ ...form, tipo_veiculo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="bike">Bicicleta</SelectItem>
                  <SelectItem value="pe">A pé</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Placa do veículo">
              <Input
                value={form.placa_veiculo}
                onChange={(e) =>
                  setForm({ ...form, placa_veiculo: e.target.value.toUpperCase() })
                }
                placeholder="ABC-1234"
                className="uppercase"
              />
            </Field>
            <Field label="Comissão (% do valor do pedido)">
              <Input
                inputMode="decimal"
                value={form.comissao_percentual}
                onChange={(e) =>
                  setForm({ ...form, comissao_percentual: e.target.value })
                }
                placeholder="Ex.: 5"
              />
            </Field>
            <Field label="Comissão fixa por entrega (R$)">
              <Input
                inputMode="decimal"
                value={form.comissao_fixa_por_entrega}
                onChange={(e) =>
                  setForm({ ...form, comissao_fixa_por_entrega: e.target.value })
                }
                placeholder="Ex.: 5,00"
              />
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 sm:col-span-2">
              <Label className="cursor-pointer">Entregador ativo</Label>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
