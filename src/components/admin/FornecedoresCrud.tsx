import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  listFornecedores,
  saveFornecedor,
  deleteFornecedor,
  type Fornecedor,
} from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconBtn } from "./SetoresCrud";

interface FormState {
  id: string | null;
  fornecedor: string;
  endereco: string;
  contato: string;
  telefone: string;
  email: string;
  prazo: string;
  site: string;
  cnpj: string;
  i_estadual: string;
  ativo: boolean;
}

const EMPTY: FormState = {
  id: null,
  fornecedor: "",
  endereco: "",
  contato: "",
  telefone: "",
  email: "",
  prazo: "",
  site: "",
  cnpj: "",
  i_estadual: "",
  ativo: true,
};

export function FornecedoresCrud() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (f: Fornecedor) => {
    setForm({
      id: f.id,
      fornecedor: f.fornecedor,
      endereco: f.endereco,
      contato: f.contato,
      telefone: f.telefone,
      email: f.email,
      prazo: f.prazo === null ? "" : String(f.prazo),
      site: f.site,
      cnpj: f.cnpj,
      i_estadual: f.i_estadual,
      ativo: f.ativo,
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!form.fornecedor.trim()) {
      toast.error("Informe o nome do fornecedor.");
      return;
    }
    setSaving(true);
    try {
      await saveFornecedor({
        id: form.id,
        fornecedor: form.fornecedor,
        endereco: form.endereco,
        contato: form.contato,
        telefone: form.telefone,
        email: form.email,
        prazo: form.prazo.trim() === "" ? null : Number(form.prazo) || 0,
        site: form.site,
        cnpj: form.cnpj,
        i_estadual: form.i_estadual,
        ativo: form.ativo,
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["erp-fornecedores"] });
      toast.success("Fornecedor salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: Fornecedor) {
    if (!confirm(`Remover o fornecedor "${f.fornecedor}"?`)) return;
    try {
      await deleteFornecedor(f.id);
      await queryClient.invalidateQueries({ queryKey: ["erp-fornecedores"] });
      toast.success("Fornecedor removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Fornecedores</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {data?.length ?? 0}
          </span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo fornecedor
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum fornecedor cadastrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Fornecedor</th>
                <th className="px-4 py-2.5 font-semibold">Contato</th>
                <th className="px-4 py-2.5 font-semibold">Telefone</th>
                <th className="px-4 py-2.5 font-semibold">CNPJ</th>
                <th className="px-4 py-2.5 font-semibold">Prazo</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data!.map((f, idx) => (
                <tr key={f.id} className={idx > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-medium">{f.fornecedor}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {f.contato || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {f.telefone || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {f.cnpj || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {f.prazo === null ? "—" : `${f.prazo} d`}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        f.ativo
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {f.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <IconBtn label="Editar" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        label="Remover"
                        destructive
                        onClick={() => handleDelete(f)}
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar fornecedor" : "Novo fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fornecedor" className="sm:col-span-2">
              <Input
                value={form.fornecedor}
                onChange={(e) =>
                  setForm({ ...form, fornecedor: e.target.value })
                }
                placeholder="Razão social / nome"
              />
            </Field>
            <Field label="Endereço" className="sm:col-span-2">
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </Field>
            <Field label="Contato">
              <Input
                value={form.contato}
                onChange={(e) => setForm({ ...form, contato: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Site">
              <Input
                value={form.site}
                onChange={(e) => setForm({ ...form, site: e.target.value })}
              />
            </Field>
            <Field label="CNPJ">
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
            </Field>
            <Field label="Inscrição estadual">
              <Input
                value={form.i_estadual}
                onChange={(e) =>
                  setForm({ ...form, i_estadual: e.target.value })
                }
              />
            </Field>
            <Field label="Prazo de entrega (dias)">
              <Input
                inputMode="numeric"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
              />
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 sm:col-span-2">
              <Label className="cursor-pointer">Fornecedor ativo</Label>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
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

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
