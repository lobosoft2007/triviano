import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Layers3 } from "lucide-react";
import { toast } from "sonner";
import {
  listLinhasProducao,
  saveLinhaProducao,
  deleteLinhaProducao,
  type LinhaProducao,
} from "@/lib/tempos-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface FormState {
  id: string | null;
  nome: string;
  ativo: boolean;
}
const EMPTY: FormState = { id: null, nome: "", ativo: true };

export function LinhasProducaoCrud() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-linhas-producao"],
    queryFn: listLinhasProducao,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: ["admin-linhas-producao"] });
    await qc.invalidateQueries({ queryKey: ["admin-categories"] });
  }

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(l: LinhaProducao) {
    setForm({ id: l.id, nome: l.nome, ativo: l.ativo });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveLinhaProducao(form);
      setOpen(false);
      await invalidate();
      toast.success("Linha salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(l: LinhaProducao) {
    if (!confirm(`Remover a linha "${l.nome}"?`)) return;
    try {
      await deleteLinhaProducao(l.id);
      await invalidate();
      toast.success("Linha removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Linhas de Produção</h3>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova linha
        </Button>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        Estações paralelas da cozinha (ex.: Pizza, Burger, Bar, Açaí). Itens
        de linhas diferentes preparam ao mesmo tempo; itens da mesma linha
        formam fila.
      </p>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {data && data.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma linha cadastrada.
        </p>
      )}

      <div className="space-y-2">
        {data?.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-3 rounded-xl bg-background px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{l.nome}</p>
              <p className="text-[11px] text-muted-foreground">
                {l.ativo ? "Ativa" : "Inativa"}
              </p>
            </div>
            <button
              onClick={() => openEdit(l)}
              aria-label="Editar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(l)}
              aria-label="Remover"
              className="flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar linha" : "Nova linha de produção"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="linha-nome">Nome</Label>
              <Input
                id="linha-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Pizza"
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-sm font-semibold">Ativa</span>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v === true })}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
