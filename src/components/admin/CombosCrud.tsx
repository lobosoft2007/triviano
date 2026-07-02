import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Layers3,
  Package,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  listCombos,
  saveCombo,
  deleteCombo,
  listAdminCategories,
  parseNumberInput,
  type ComboRule,
  type TipoPromocao,
} from "@/lib/erp";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

interface FormState {
  id: string | null;
  nome_combo: string;
  tipo_promocao: TipoPromocao;
  quantidade_requerida: number;
  id_categoria_1: string;
  id_categoria_2: string;
  id_categoria_3: string;
  valor_desconto: string;
  ativo: boolean;
  frase_promocional: string;
}

const EMPTY: FormState = {
  id: null,
  nome_combo: "",
  tipo_promocao: "Combo",
  quantidade_requerida: 1,
  id_categoria_1: NONE,
  id_categoria_2: NONE,
  id_categoria_3: NONE,
  valor_desconto: "",
  ativo: true,
  frase_promocional: "",
};

const COMBOS_QK = ["admin-combos"];

export function CombosCrud() {
  const queryClient = useQueryClient();
  const { data: combos, isLoading } = useQuery({
    queryKey: COMBOS_QK,
    queryFn: listCombos,
  });
  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: listAdminCategories,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const catName = (id: string | null) =>
    categories?.find((c) => c.id === id)?.name ?? null;

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (c: ComboRule) => {
    setForm({
      id: c.id,
      nome_combo: c.nome_combo,
      tipo_promocao: c.tipo_promocao,
      quantidade_requerida: c.quantidade_requerida,
      id_categoria_1: c.id_categoria_1 ?? NONE,
      id_categoria_2: c.id_categoria_2 ?? NONE,
      id_categoria_3: c.id_categoria_3 ?? NONE,
      valor_desconto: String(c.valor_desconto).replace(".", ","),
      ativo: c.ativo,
      frase_promocional: c.frase_promocional ?? "",
    });
    setOpen(true);
  };

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: COMBOS_QK }),
      queryClient.invalidateQueries({ queryKey: ["active-combos"] }),
    ]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveCombo({
        id: form.id,
        nome_combo: form.nome_combo,
        tipo_promocao: form.tipo_promocao,
        quantidade_requerida: form.quantidade_requerida,
        id_categoria_1:
          form.id_categoria_1 === NONE ? null : form.id_categoria_1,
        id_categoria_2:
          form.id_categoria_2 === NONE ? null : form.id_categoria_2,
        id_categoria_3:
          form.id_categoria_3 === NONE ? null : form.id_categoria_3,
        valor_desconto: parseNumberInput(form.valor_desconto),
        ativo: form.ativo,
        frase_promocional: form.frase_promocional,
      });
      setOpen(false);
      await invalidate();
      toast.success("Campanha salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ComboRule) {
    if (!confirm(`Remover a campanha "${c.nome_combo}"?`)) return;
    try {
      await deleteCombo(c.id);
      await invalidate();
      toast.success("Campanha removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  const catSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    withNone = true,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a categoria" />
        </SelectTrigger>
        <SelectContent>
          {withNone && <SelectItem value={NONE}>— Nenhuma —</SelectItem>}
          {categories?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const isPack = form.tipo_promocao === "Pack";

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Gerenciador de Campanhas
          </h2>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova campanha
        </Button>
      </header>

      <p className="mb-4 text-sm text-muted-foreground">
        <strong>Combo:</strong> ao menos 1 item de cada categoria vinculada
        libera o desconto. <strong>Pack:</strong> atingir a quantidade exigida de
        uma mesma categoria libera o desconto. Várias campanhas podem ser
        aplicadas ao mesmo tempo.
      </p>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {combos && combos.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma campanha cadastrada.
        </p>
      )}

      <div className="space-y-2">
        {combos?.map((c) => {
          const pack = c.tipo_promocao === "Pack";
          const cats = [c.id_categoria_1, c.id_categoria_2, c.id_categoria_3]
            .map(catName)
            .filter(Boolean) as string[];
          const detail = pack
            ? `${c.quantidade_requerida}x ${cats[0] ?? "categoria"}`
            : cats.length
              ? cats.join(" + ")
              : "Sem categorias";
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                  c.ativo
                    ? "bg-success/12 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {c.ativo ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{c.nome_combo}</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      pack
                        ? "bg-primary/12 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {pack ? (
                      <Package className="h-3 w-3" />
                    ) : (
                      <Layers3 className="h-3 w-3" />
                    )}
                    {c.tipo_promocao}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {detail}
                </p>
              </div>

              <span className="whitespace-nowrap font-display font-bold text-primary">
                {pack
                  ? `− ${String(c.valor_desconto).replace(".", ",")}%`
                  : `− ${formatBRL(c.valor_desconto)}`}
              </span>

              <button
                aria-label={`Editar ${c.nome_combo}`}
                onClick={() => openEdit(c)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                aria-label={`Remover ${c.nome_combo}`}
                onClick={() => handleDelete(c)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar campanha" : "Nova campanha"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type toggle */}
            <div className="space-y-1.5">
              <Label>Tipo de promoção</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["Combo", "Pack"] as TipoPromocao[]).map((t) => {
                  const active = form.tipo_promocao === t;
                  const Icon = t === "Pack" ? Package : Layers3;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tipo_promocao: t })}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {t}
                      <span className="text-[10px] font-normal">
                        {t === "Pack"
                          ? "Nº de itens de 1 categoria"
                          : "1 item de cada categoria"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="combo-name">Nome da campanha</Label>
              <Input
                id="combo-name"
                value={form.nome_combo}
                onChange={(e) =>
                  setForm({ ...form, nome_combo: e.target.value })
                }
                placeholder={isPack ? "Ex: Pack 3 Pastéis" : "Ex: Combo Família"}
              />
            </div>

            {isPack ? (
              <>
                {catSelect(
                  form.id_categoria_1 === NONE ? "" : form.id_categoria_1,
                  (v) => setForm({ ...form, id_categoria_1: v }),
                  "Categoria do pack",
                  false,
                )}
                <div className="space-y-1.5">
                  <Label>Quantidade necessária</Label>
                  <Select
                    value={String(form.quantidade_requerida)}
                    onValueChange={(v) =>
                      setForm({ ...form, quantidade_requerida: Number(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "produto" : "produtos"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {catSelect(
                  form.id_categoria_1,
                  (v) => setForm({ ...form, id_categoria_1: v }),
                  "Categoria 1",
                )}
                {catSelect(
                  form.id_categoria_2,
                  (v) => setForm({ ...form, id_categoria_2: v }),
                  "Categoria 2",
                )}
                {catSelect(
                  form.id_categoria_3,
                  (v) => setForm({ ...form, id_categoria_3: v }),
                  "Categoria 3 (opcional)",
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="combo-desc">Valor do desconto (R$)</Label>
              <Input
                id="combo-desc"
                inputMode="decimal"
                value={form.valor_desconto}
                onChange={(e) =>
                  setForm({ ...form, valor_desconto: e.target.value })
                }
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="combo-frase">
                Frase Promocional / Texto de Divulgação
              </Label>
              <Textarea
                id="combo-frase"
                rows={3}
                value={form.frase_promocional}
                onChange={(e) =>
                  setForm({ ...form, frase_promocional: e.target.value })
                }
                placeholder="Ex: Aproveite o Pack Casal: leve 2 burgers clássicos e economize R$ 10,00!"
              />
              <p className="text-xs text-muted-foreground">
                Usada para banners e pop-ups promocionais na tela do cliente.
              </p>
            </div>


            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Campanha ativa</p>
                <p className="text-xs text-muted-foreground">
                  Só campanhas ativas aplicam desconto no carrinho.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
