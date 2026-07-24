import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  listZonasEntrega,
  saveZonaEntrega,
  deleteZonaEntrega,
  type ZonaEntrega,
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
  tempo_entrega_min: string;
  ativo: boolean;
}
const EMPTY: FormState = { id: null, nome: "", tempo_entrega_min: "15", ativo: true };

export function ZonasEntregaCrud() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-zonas-entrega"],
    queryFn: listZonasEntrega,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(z: ZonaEntrega) {
    setForm({
      id: z.id,
      nome: z.nome,
      tempo_entrega_min: String(z.tempo_entrega_min),
      ativo: z.ativo,
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveZonaEntrega({
        id: form.id,
        nome: form.nome,
        tempo_entrega_min: Number(form.tempo_entrega_min) || 0,
        ativo: form.ativo,
      });
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["admin-zonas-entrega"] });
      toast.success("Zona salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(z: ZonaEntrega) {
    if (!confirm(`Remover a zona "${z.nome}"?`)) return;
    try {
      await deleteZonaEntrega(z.id);
      await qc.invalidateQueries({ queryKey: ["admin-zonas-entrega"] });
      toast.success("Zona removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Zonas de Entrega</h3>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova zona
        </Button>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        Tempo médio de entrega por zona. Pedidos sem zona informada usam o
        tempo padrão configurado em Empresa → Configurações.
      </p>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {data && data.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma zona cadastrada.
        </p>
      )}

      <div className="space-y-2">
        {data?.map((z) => (
          <div
            key={z.id}
            className="flex items-center gap-3 rounded-xl bg-background px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{z.nome}</p>
              <p className="text-[11px] text-muted-foreground">
                {z.tempo_entrega_min} min · {z.ativo ? "Ativa" : "Inativa"}
              </p>
            </div>
            <button
              onClick={() => openEdit(z)}
              aria-label="Editar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(z)}
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
            <DialogTitle>{form.id ? "Editar zona" : "Nova zona"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="zona-nome">Nome</Label>
              <Input
                id="zona-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Centro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zona-tempo">Tempo de entrega (min)</Label>
              <Input
                id="zona-tempo"
                type="number"
                min={0}
                value={form.tempo_entrega_min}
                onChange={(e) =>
                  setForm({ ...form, tempo_entrega_min: e.target.value })
                }
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
