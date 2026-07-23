import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Tags,
  ArrowUp,
  ArrowDown,
  Clock,
} from "lucide-react";
import { CategoriaHorariosDialog } from "@/components/admin/CategoriaHorariosDialog";

import { toast } from "sonner";
import {
  listAdminCategories,
  saveCategory,
  deleteCategory,
  moveCategory,
  type AdminCategory,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Tailwind font-color options offered to the operator. */
const COR_OPTIONS: { value: string; label: string }[] = [
  { value: "text-white", label: "Branco" },
  { value: "text-green-500", label: "Verde Esmeralda" },
  { value: "text-gray-400", label: "Cinza" },
  { value: "text-yellow-400", label: "Amarelo Destaque" },
];

/** Tailwind font-size options offered to the operator. */
const TAMANHO_OPTIONS: { value: string; label: string }[] = [
  { value: "text-sm", label: "Pequeno" },
  { value: "text-base", label: "Padrão" },
  { value: "text-lg", label: "Médio" },
  { value: "text-xl", label: "Grande" },
];

interface FormState {
  id: string | null;
  name: string;
  cor_fonte: string;
  tamanho_fonte: string;
  allows_half: boolean;
  min_items: number;
}

const EMPTY: FormState = {
  id: null,
  name: "",
  cor_fonte: "text-white",
  tamanho_fonte: "text-base",
  allows_half: false,
  min_items: 0,
};


const QK = ["admin-categories"];

export function CategoriasCrud() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: listAdminCategories,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [horariosFor, setHorariosFor] = useState<AdminCategory | null>(null);


  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (c: AdminCategory) => {
    setForm({
      id: c.id,
      name: c.name,
      cor_fonte: c.cor_fonte,
      tamanho_fonte: c.tamanho_fonte,
      allows_half: c.allows_half,
      min_items: c.min_items,
    });
    setOpen(true);
  };


  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QK }),
      queryClient.invalidateQueries({ queryKey: ["menu"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-menu"] }),
    ]);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    setSaving(true);
    try {
      await saveCategory({
        id: form.id,
        name: form.name,
        cor_fonte: form.cor_fonte,
        tamanho_fonte: form.tamanho_fonte,
        allows_half: form.allows_half,
        min_items: form.min_items,
      });

      setOpen(false);
      await invalidate();
      toast.success("Categoria salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: AdminCategory) {
    if (c.product_count > 0) {
      toast.error(
        `"${c.name}" possui ${c.product_count} produto(s) vinculado(s). Remova-os antes de excluir.`,
      );
      return;
    }
    if (!confirm(`Remover a categoria "${c.name}"?`)) return;
    try {
      await deleteCategory(c.id);
      await invalidate();
      toast.success("Categoria removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  async function handleMove(c: AdminCategory, direction: "up" | "down") {
    if (!data) return;
    setMovingId(c.id);
    try {
      await moveCategory(data, c.id, direction);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reordenar.");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Categorias do Cardápio
          </h2>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova categoria
        </Button>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {data && data.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma categoria cadastrada.
        </p>
      )}

      <div className="space-y-2">
        {data?.map((c, idx) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
          >
            <div className="flex flex-col">
              <button
                aria-label={`Subir ${c.name}`}
                disabled={idx === 0 || movingId !== null}
                onClick={() => handleMove(c, "up")}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                aria-label={`Baixar ${c.name}`}
                disabled={idx === data.length - 1 || movingId !== null}
                onClick={() => handleMove(c, "down")}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              {/* Live preview of how the title renders on the storefront. */}
              <p
                className={`truncate font-display font-bold ${c.tamanho_fonte} ${c.cor_fonte}`}
              >
                {c.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.product_count} produto(s) ·{" "}
                {COR_OPTIONS.find((o) => o.value === c.cor_fonte)?.label ??
                  c.cor_fonte}{" "}
                ·{" "}
                {TAMANHO_OPTIONS.find((o) => o.value === c.tamanho_fonte)
                  ?.label ?? c.tamanho_fonte}
              </p>
            </div>

            <button
              aria-label={`Horários de ${c.name}`}
              onClick={() => setHorariosFor(c)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              title="Horários de funcionamento"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              aria-label={`Editar ${c.name}`}
              onClick={() => openEdit(c)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label={`Remover ${c.name}`}
              onClick={() => handleDelete(c)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>

          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-w-md">
          <ModalActionBar
            title={form.id ? "Editar categoria" : "Nova categoria"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Salvar"
          />

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nome da categoria</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Pizzas"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cor da fonte</Label>
              <Select
                value={form.cor_fonte}
                onValueChange={(v) => setForm({ ...form, cor_fonte: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tamanho da fonte</Label>
              <Select
                value={form.tamanho_fonte}
                onValueChange={(v) => setForm({ ...form, tamanho_fonte: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAMANHO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                Prévia
              </p>
              <p
                className={`font-display font-bold ${form.tamanho_fonte} ${form.cor_fonte}`}
              >
                {form.name || "Nome da categoria"}
              </p>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {horariosFor && (
        <CategoriaHorariosDialog
          open={!!horariosFor}
          onOpenChange={(v) => !v && setHorariosFor(null)}
          categoriaId={horariosFor.id}
          categoriaNome={horariosFor.name}
          onSaved={() => invalidate()}
        />
      )}
    </section>

  );
}
