import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  listSetores,
  saveSetor,
  deleteSetor,
  type Setor,
} from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";

interface FormState {
  id: string | null;
  setor: string;
  ordem_exibicao: string;
}

const EMPTY: FormState = { id: null, setor: "", ordem_exibicao: "0" };

export function SetoresCrud() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["erp-setores"],
    queryFn: listSetores,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setForm({ ...EMPTY, ordem_exibicao: String((data?.length ?? 0) + 1) });
    setOpen(true);
  };
  const openEdit = (s: Setor) => {
    setForm({
      id: s.id,
      setor: s.setor,
      ordem_exibicao: String(s.ordem_exibicao),
    });
    setOpen(true);
  };

  async function handleSave() {
    if (!form.setor.trim()) {
      toast.error("Informe o nome do setor.");
      return;
    }
    setSaving(true);
    try {
      await saveSetor({
        id: form.id,
        setor: form.setor,
        ordem_exibicao: Number(form.ordem_exibicao) || 0,
      });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["erp-setores"] });
      toast.success("Setor salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Setor) {
    if (!confirm(`Remover o setor "${s.setor}"?`)) return;
    try {
      await deleteSetor(s.id);
      await queryClient.invalidateQueries({ queryKey: ["erp-setores"] });
      toast.success("Setor removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Setores</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {data?.length ?? 0}
          </span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo setor
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
          Nenhum setor cadastrado.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Setor</th>
                <th className="w-28 px-4 py-2.5 font-semibold">Ordem</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data!.map((s, idx) => (
                <tr key={s.id} className={idx > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-medium">{s.setor}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {s.ordem_exibicao}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-w-sm">
          <ModalActionBar
            title={form.id ? "Editar setor" : "Novo setor"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setor-nome">Nome do setor</Label>
              <Input
                id="setor-nome"
                value={form.setor}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
                placeholder="Ex.: Cozinha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setor-ordem">Ordem de exibição</Label>
              <Input
                id="setor-ordem"
                inputMode="numeric"
                value={form.ordem_exibicao}
                onChange={(e) =>
                  setForm({ ...form, ordem_exibicao: e.target.value })
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function IconBtn({
  children,
  label,
  destructive,
  ...props
}: {
  children: React.ReactNode;
  label: string;
  destructive?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-secondary"
      } ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
