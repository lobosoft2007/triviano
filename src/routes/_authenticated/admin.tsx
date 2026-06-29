import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  ImagePlus,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { resolveImageUrls, uploadMenuImage } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
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

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

interface AdminCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface AdminProduct {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string; // raw stored value (path or external URL)
  display_url: string; // resolved displayable URL
  available: boolean;
}

async function fetchAdminMenu() {
  const [catRes, prodRes] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("products")
      .select("id, category_id, name, description, price, image_url, available")
      .order("sort_order"),
  ]);
  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;

  const raw = (prodRes.data ?? []).map((p) => ({
    id: p.id,
    category_id: p.category_id,
    name: p.name,
    description: p.description ?? "",
    price: Number(p.price),
    image_url: p.image_url ?? "",
    available: p.available,
  }));
  const urlMap = await resolveImageUrls(raw.map((p) => p.image_url));

  return {
    categories: (catRes.data ?? []) as AdminCategory[],
    products: raw.map((p) => ({
      ...p,
      display_url: urlMap[p.image_url] ?? p.image_url,
    })) as AdminProduct[],
  };
}

function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

interface FormState {
  id: string | null;
  category_id: string;
  name: string;
  description: string;
  price: string;
  available: boolean;
  image_url: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  category_id: "",
  name: "",
  description: "",
  price: "",
  available: true,
  image_url: "",
};

function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: fetchAdminMenu,
    enabled: isAdmin === true,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, category_id: data?.categories[0]?.id ?? "" });
    setFile(null);
    setPreview("");
    setOpen(true);
  };

  const openEdit = (p: AdminProduct) => {
    setForm({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      price: String(p.price),
      available: p.available,
      image_url: p.image_url,
    });
    setFile(null);
    setPreview(p.display_url);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category_id) {
      toast.error("Preencha o nome e a categoria.");
      return;
    }
    const price = Number(form.price.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      toast.error("Informe um preço válido.");
      return;
    }

    setSaving(true);
    try {
      let imageRef = form.image_url;
      if (file) {
        imageRef = await uploadMenuImage(file);
      }

      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        available: form.available,
        image_url: imageRef,
      };

      if (form.id) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Item atualizado!");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Item adicionado!");
      }

      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível salvar o item.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: AdminProduct) => {
    if (!confirm(`Remover "${p.name}" do cardápio?`)) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
      toast.success("Item removido.");
      await queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível remover.",
      );
    }
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <div>
          <h1 className="font-display text-lg font-bold">Acesso restrito</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta área é exclusiva para administradores.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/menu">Voltar ao cardápio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to="/menu"
                aria-label="Voltar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="text-xs text-muted-foreground">Administração</p>
                <h1 className="font-display text-xl font-bold leading-tight">
                  Cardápio
                </h1>
              </div>
            </div>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          </div>
        </header>

        <main className="px-5 py-5">
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          )}

          {data &&
            data.categories.map((cat) => {
              const products = data.products.filter(
                (p) => p.category_id === cat.id,
              );
              if (products.length === 0) return null;
              return (
                <section key={cat.id} className="mb-7">
                  <h2 className="mb-3 font-display text-base font-bold">
                    {cat.name}
                  </h2>
                  <div className="space-y-2.5">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-card"
                      >
                        <img
                          src={p.display_url || "/icons/icon-192.png"}
                          alt={p.name}
                          loading="lazy"
                          className="h-14 w-14 flex-shrink-0 rounded-xl bg-secondary object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {p.name}
                            {!p.available && (
                              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                oculto
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-primary">
                            {formatBRL(p.price)}
                          </p>
                        </div>
                        <button
                          aria-label={`Editar ${p.name}`}
                          onClick={() => openEdit(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Remover ${p.name}`}
                          onClick={() => handleDelete(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar item" : "Novo item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3 text-left transition-colors hover:bg-secondary"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Pré-visualização"
                    className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  {file
                    ? file.name
                    : preview
                      ? "Toque para trocar a imagem"
                      : "Selecionar imagem do dispositivo"}
                </span>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-name">Nome</Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: X-Bacon"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-desc">Descrição</Label>
              <Textarea
                id="prod-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Ingredientes, detalhes..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-price">Preço (R$)</Label>
                <Input
                  id="prod-price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
              <Label htmlFor="prod-available" className="cursor-pointer">
                Disponível no cardápio
              </Label>
              <Switch
                id="prod-available"
                checked={form.available}
                onCheckedChange={(v) => setForm({ ...form, available: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Salvar alterações" : "Adicionar item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
