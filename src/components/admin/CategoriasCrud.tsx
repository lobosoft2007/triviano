import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Tags, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { CategoriaHorariosDialog } from "@/components/admin/CategoriaHorariosDialog";

import { toast } from "sonner";
import { listAdminCategories, saveCategory, deleteCategory, moveCategory, type AdminCategory } from "@/lib/erp";
import { listLinhasProducao, listEtapasCategoria, saveEtapasCategoria, type EtapaPreparo } from "@/lib/tempos-admin";
import { EtapasPreparoEditor } from "@/components/admin/EtapasPreparoEditor";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  linha_producao_id: string | null;
}

const EMPTY: FormState = {
  id: null,
  name: "",
  cor_fonte: "text-white",
  tamanho_fonte: "text-base",
  allows_half: false,
  min_items: 0,
  linha_producao_id: null,
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
  const [etapas, setEtapas] = useState<EtapaPreparo[]>([]);
  const [loadingEtapas, setLoadingEtapas] = useState(false);

  const { data: linhas } = useQuery({
    queryKey: ["admin-linhas-producao"],
    queryFn: listLinhasProducao,
  });

  const openNew = () => {
    setForm(EMPTY);
    setEtapas([]);
    setOpen(true);
  };
  const openEdit = async (c: AdminCategory) => {
    setForm({
      id: c.id,
      name: c.name,
      cor_fonte: c.cor_fonte,
      tamanho_fonte: c.tamanho_fonte,
      allows_half: c.allows_half,
      min_items: c.min_items,
      linha_producao_id: c.linha_producao_id,
    });
    setEtapas([]);
    setOpen(true);
    setLoadingEtapas(true);
    try {
      const rows = await listEtapasCategoria(c.id);
      setEtapas(rows);
    } catch {
      /* silencia — editor mostra vazio */
    } finally {
      setLoadingEtapas(false);
    }
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
        linha_producao_id: form.linha_producao_id,
      });

      // Etapas: a categoria precisa existir (id) para persistir. Em criação
      // seguimos sem etapas nesta rodada — o operador cadastra na próxima edição.
      if (form.id) {
        await saveEtapasCategoria(form.id, etapas);
      }

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
      toast.error(`"${c.name}" possui ${c.product_count} produto(s) vinculado(s). Remova-os antes de excluir.`);
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
          <h2 className="font-display text-lg font-bold">Categorias do Cardápio</h2>
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
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
      )}

      <div className="space-y-2">
        {data?.map((c, idx) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
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
              <p className={`truncate font-display font-bold ${c.tamanho_fonte} ${c.cor_fonte}`}>{c.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.product_count} produto(s) · {COR_OPTIONS.find((o) => o.value === c.cor_fonte)?.label ?? c.cor_fonte}{" "}
                · {TAMANHO_OPTIONS.find((o) => o.value === c.tamanho_fonte)?.label ?? c.tamanho_fonte}
                {c.allows_half && " · Meio a meio"}
                {c.min_items > 0 && ` · Mín ${c.min_items}`}
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
        <DialogContent hideClose className="max-w-md max-h-[90dvh] overflow-y-auto">
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
              <Select value={form.cor_fonte} onValueChange={(v) => setForm({ ...form, cor_fonte: v })}>
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
              <Select value={form.tamanho_fonte} onValueChange={(v) => setForm({ ...form, tamanho_fonte: v })}>
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

            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Permite produto meio a meio</span>
                  <span className="block text-xs text-muted-foreground">
                    Habilita o checkbox de segundo sabor no PWA. Cobra 50% de cada sabor.
                  </span>
                </span>
                <Switch
                  checked={form.allows_half}
                  onCheckedChange={(v) => setForm({ ...form, allows_half: v === true })}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-min-items">Mínimo de itens no carrinho</Label>
              <Input
                id="cat-min-items"
                type="number"
                min={0}
                step={1}
                value={form.min_items}
                onChange={(e) =>
                  setForm({
                    ...form,
                    min_items: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">Use 0 para desativar. Ex.: Pastéis exige mínimo de 3.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Linha de produção</Label>
              <Select
                value={form.linha_producao_id ?? "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    linha_producao_id: v === "__none__" ? null : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem linha (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem linha (padrão)</SelectItem>
                  {(linhas ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Estação da cozinha que prepara esta categoria (Pizza, Burger…). Categorias em linhas diferentes preparam
                em paralelo.
              </p>
            </div>

            {form.id ? (
              loadingEtapas ? (
                <p className="text-xs text-muted-foreground">Carregando etapas…</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Estas etapas somam o tempo de preparo desta categoria dentro da linha de produção escolhida acima.
                  </p>
                  <EtapasPreparoEditor etapas={etapas} onChange={setEtapas} />
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground">Salve a categoria para configurar as etapas de preparo.</p>
            )}

            {/* Preview */}
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Prévia</p>
              <p className={`font-display font-bold ${form.tamanho_fonte} ${form.cor_fonte}`}>
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
