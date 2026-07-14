import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Copy,
  ImagePlus,
  Trash2,
  ShieldAlert,
  Package,
  Boxes,
  UtensilsCrossed,
  Layers,
  Layers3,
  Megaphone,
  Truck,
  TrendingUp,
  PackagePlus,
  ShoppingCart,
  Tags,
  Building2,
  Palette,
  Crown,
  Users,
  Wallet,
  ClipboardCheck,
  UserCog,
  ShieldCheck,
  CreditCard,
  Armchair,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { resolveImageUrls, uploadMenuImage } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
import {
  fetchProductDetail,
  saveProductDetail,
  cloneProduct,
  listSetores,
  listFornecedores,
  listInsumos,
  listSubprodutos,
  parseNumberInput,
  type ProductDetail,
} from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalActionBar } from "@/components/ui/modal-action-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SetoresCrud } from "@/components/admin/SetoresCrud";
import { FornecedoresCrud } from "@/components/admin/FornecedoresCrud";
import { InsumosCrud } from "@/components/admin/InsumosCrud";
import { SubprodutosCrud } from "@/components/admin/SubprodutosCrud";
import { TesourariaView } from "@/components/admin/TesourariaView";
import { EntradaEstoqueView } from "@/components/admin/EntradaEstoqueView";
import { AjusteRapidoView } from "@/components/admin/AjusteRapidoView";
import { SugestaoComprasView } from "@/components/admin/SugestaoComprasView";

import { CategoriasCrud } from "@/components/admin/CategoriasCrud";
import { PermissoesTab } from "@/components/admin/PermissoesTab";
import { FuncionariosTab } from "@/components/admin/FuncionariosTab";
import { usePermissions, ACCESS_DENIED_MSG, type PermissionFlag } from "@/lib/permissions";
import { CombosCrud } from "@/components/admin/CombosCrud";
import { EmpresaConfigTab } from "@/components/admin/EmpresaConfigTab";
import { MesasQrTab } from "@/components/admin/MesasQrTab";
import { PaymentConfigTab } from "@/components/admin/PaymentConfigTab";
import { IdentidadeVisualTab } from "@/components/admin/IdentidadeVisualTab";
import {
  ProductDetailFields,
  EMPTY_DETAIL,
  NONE,
  type ProductDetailForm,
} from "@/components/admin/ProductDetailFields";

import { useIsSuperAdmin } from "@/lib/superadmin";
import { ClientesView } from "@/components/admin/ClientesView";
import { ContaCorrenteTab } from "@/components/caixa/ContaCorrenteTab";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { tab?: AdminTab; denied?: string } => ({
    tab: typeof s.tab === "string" ? (s.tab as AdminTab) : undefined,
    denied: typeof s.denied === "string" ? s.denied : undefined,
  }),
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
  image_url: string;
  display_url: string;
  available: boolean;
  free_addon_limit: number;
  manipulado: boolean;
  eixo_variacao: string;
  saldo_estoque: number;
  estoque_minimo: number;
  estoque_maximo: number;
  custo_total: number;
  disponivel: boolean;
  margem_revenda: number;
  custo_compra: number;
  preco_ideal_revenda: number;
}

async function fetchAdminMenu() {
  const [catRes, prodRes] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").order("sort_order"),
    // Admin reads cost/stock via SECURITY DEFINER RPC (admin-only); the raw
    // products table hides these columns from customers.
    supabase.rpc("admin_get_products"),
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
    free_addon_limit: Number(p.free_addon_limit ?? 0),
    manipulado: Boolean((p as { manipulado?: boolean }).manipulado ?? true),
    eixo_variacao: (p as { eixo_variacao?: string }).eixo_variacao ?? "Tamanho",
    saldo_estoque: Number(p.saldo_estoque ?? 0),
    estoque_minimo: Number(p.estoque_minimo ?? 0),
    estoque_maximo: Number(p.estoque_maximo ?? 0),
    custo_total: Number((p as { custo_total?: number }).custo_total ?? 0),
    disponivel: Boolean((p as { disponivel?: boolean }).disponivel),
    margem_revenda: Number((p as { margem_revenda?: number }).margem_revenda ?? 100),
    custo_compra: Number((p as { custo_compra?: number }).custo_compra ?? 0),
    preco_ideal_revenda: Number(
      (p as { preco_ideal_revenda?: number }).preco_ideal_revenda ?? 0,
    ),
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


interface FormState {
  id: string | null;
  category_id: string;
  name: string;
  description: string;
  price: string;
  available: boolean;
  image_url: string;
  free_addon_limit: string;
  eixo_variacao: string;
  saldo_estoque: string;
  estoque_minimo: string;
  estoque_maximo: string;
}


const EMPTY_FORM: FormState = {
  id: null,
  category_id: "",
  name: "",
  description: "",
  price: "",
  available: true,
  image_url: "",
  free_addon_limit: "0",
  eixo_variacao: "Tamanho",
  saldo_estoque: "0",
  estoque_minimo: "0",
  estoque_maximo: "0",
};

type AdminTab =
  | "cardapio"
  | "categorias"
  | "combos"
  | "empresa"
  | "identidade"
  | "pagamentos"
  | "clientes"
  | "conta"
  | "financeiro"
  | "estoque"
  | "ajustes"
  | "compras"
  | "insumos"
  | "subprodutos"
  | "setores"
  | "fornecedores"
  | "funcionarios"
  | "permissoes"
  | "mesas";


const TABS: { key: AdminTab; label: string; icon: typeof Package }[] = [
  { key: "cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { key: "categorias", label: "Categorias do Cardápio", icon: Tags },
  { key: "combos", label: "Campanhas", icon: Megaphone },
  { key: "empresa", label: "Configurações da Empresa", icon: Building2 },
  { key: "identidade", label: "Identidade Visual", icon: Palette },
  { key: "pagamentos", label: "Pagamentos", icon: CreditCard },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "conta", label: "Conta Corrente", icon: Wallet },
  { key: "financeiro", label: "Financeiro", icon: TrendingUp },
  { key: "estoque", label: "Entrada Estoque", icon: PackagePlus },
  { key: "ajustes", label: "Ajuste Rápido", icon: ClipboardCheck },
  { key: "compras", label: "Sugestão de Compras", icon: ShoppingCart },

  { key: "insumos", label: "Insumos", icon: Package },
  { key: "subprodutos", label: "Subprodutos", icon: Boxes },
  { key: "setores", label: "Setores", icon: Layers },
  { key: "fornecedores", label: "Fornecedores", icon: Truck },
  { key: "funcionarios", label: "Funcionários", icon: UserCog },
  { key: "permissoes", label: "Permissões", icon: ShieldCheck },
  { key: "mesas", label: "Mesas (QR-Codes)", icon: Armchair },
];

// Recurso da matriz de permissões exigido por cada aba ("master" = só o admin dono).
const TAB_FLAG: Record<AdminTab, PermissionFlag | "master"> = {
  cardapio: "acesso_cadastro_produtos",
  categorias: "acesso_cadastro_produtos",
  combos: "acesso_cadastro_produtos",
  empresa: "master",
  identidade: "master",
  pagamentos: "master",
  clientes: "master",
  conta: "acesso_financeiro",
  financeiro: "acesso_financeiro",
  estoque: "acesso_entrada_estoque",
  ajustes: "acesso_entrada_estoque",
  compras: "acesso_entrada_estoque",
  insumos: "acesso_entrada_estoque",
  subprodutos: "acesso_entrada_estoque",
  setores: "master",
  fornecedores: "master",
  funcionarios: "master",
  permissoes: "master",
  mesas: "master",
};




function detailToForm(d: ProductDetail): ProductDetailForm {
  return {
    manipulado: d.manipulado,
    setor_id: d.setor_id ?? NONE,
    fornecedor_id: d.fornecedor_id ?? NONE,
    margem_revenda: String(d.margem_revenda ?? 100).replace(".", ","),
    custo_compra: d.custo_compra ? String(d.custo_compra).replace(".", ",") : "",
    ncm: d.ncm,
    ean: d.ean,
    price_options: d.price_options.map((o) => ({
      id: o.id ?? crypto.randomUUID(),
      label: o.tamanho,
      preco: String(o.preco).replace(".", ","),
      ficha: (o.ficha ?? []).map((f) => ({
        tipo: f.tipo,
        ref_id: f.ref_id,
        nome: f.nome,
        quantidade: f.quantidade
          ? String(f.quantidade).replace(".", ",")
          : "",
        permitir_exclusao: f.permitir_exclusao,
      })),
    })),
    addons: d.addons.map((a) => ({
      label: a.nome,
      preco: String(a.preco).replace(".", ","),
    })),
    free_addons: d.free_addons.map((a) => ({
      label: a.nome,
      preco: String(a.preco).replace(".", ","),
    })),
    ficha: d.ficha.map((f) => ({
      tipo: f.tipo,
      ref_id: f.ref_id,
      nome: f.nome,
      quantidade: f.quantidade ? String(f.quantidade).replace(".", ",") : "",
      permitir_exclusao: f.permitir_exclusao,
    })),
  };
}

function formToDetail(d: ProductDetailForm): ProductDetail {
  return {
    manipulado: d.manipulado,
    setor_id: d.setor_id === NONE ? null : d.setor_id,
    fornecedor_id: d.fornecedor_id === NONE ? null : d.fornecedor_id,
    margem_revenda: parseNumberInput(d.margem_revenda),
    custo_compra: parseNumberInput(d.custo_compra),
    ncm: d.ncm,
    ean: d.ean,
    price_options: d.price_options.map((o) => ({
      id: o.id,
      tamanho: o.label,
      preco: parseNumberInput(o.preco),
      ficha: o.ficha
        .filter((f) => f.ref_id)
        .map((f) => ({
          tipo: f.tipo,
          ref_id: f.ref_id,
          nome: f.nome,
          quantidade: parseNumberInput(f.quantidade),
          permitir_exclusao: f.permitir_exclusao,
        })),
    })),
    addons: d.addons.map((a) => ({
      nome: a.label,
      preco: parseNumberInput(a.preco),
    })),
    free_addons: d.free_addons.map((a) => ({
      nome: a.label,
      preco: parseNumberInput(a.preco),
    })),
    ficha: d.ficha
      .filter((f) => f.ref_id)
      .map((f) => ({
        tipo: f.tipo,
        ref_id: f.ref_id,
        nome: f.nome,
        quantidade: parseNumberInput(f.quantidade),
        permitir_exclusao: f.permitir_exclusao,
      })),
  };
}

/** Round action button with a floating hint (tooltip). */
function IconBtn({
  icon,
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 " +
            (variant === "destructive"
              ? "text-destructive hover:bg-destructive/10"
              : "text-muted-foreground hover:bg-secondary")
          }
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function AdminPage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleLock = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    try {
      sessionStorage.setItem("post_login_redirect", "/admin");
    } catch {
      /* ignore storage errors */
    }
    navigate({ to: "/auth", replace: true });
  };

  const { data: perms, isLoading: roleLoading } = usePermissions();
  const userRole =
    (user as { role?: string } | null)?.role ??
    (user?.app_metadata as { role?: string } | undefined)?.role;
  const isMaster =
    userRole === "admin" || perms?.is_admin === true || perms?.is_manager === true;
  const tabAllowed = (key: AdminTab): boolean => {
    if (userRole === "admin") return true;
    if (isMaster) return true;
    const flag = TAB_FLAG[key];
    return flag !== "master" && Boolean(perms?.[flag]);
  };
  const canEnterAdmin = TABS.some((t) => tabAllowed(t.key));
  // Enables data queries below; funcionários only reach permitted tabs.
  const isAdmin = userRole === "admin" || canEnterAdmin;
  const { data: isSuperAdmin } = useIsSuperAdmin(user?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: fetchAdminMenu,
    enabled: isAdmin === true,
  });

  const search = Route.useSearch();
  const [tab, setTab] = useState<AdminTab>(search.tab ?? "cardapio");
  const deniedShown = useRef(false);

  // Feedback for a blocked surface redirect (Camada 1) or a forbidden
  // deep-link tab (Camada 2). Fires the access-denied toast once.
  useEffect(() => {
    if (!perms) return;
    const requestedForbidden = search.tab && !tabAllowed(search.tab);
    if ((search.denied || requestedForbidden) && !deniedShown.current) {
      deniedShown.current = true;
      toast.error(ACCESS_DENIED_MSG);
    }
    // If the active tab is not permitted for this staff level, jump to the
    // first allowed one (silently — default fallbacks are not "denied").
    if (!tabAllowed(tab)) {
      const first = TABS.find((t) => tabAllowed(t.key));
      if (first) setTab(first.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms, tab, search.tab, search.denied]);


  const { data: setores } = useQuery({
    queryKey: ["erp-setores"],
    queryFn: listSetores,
    enabled: isAdmin === true,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["erp-fornecedores"],
    queryFn: listFornecedores,
    enabled: isAdmin === true,
  });
  const { data: insumos } = useQuery({
    queryKey: ["erp-insumos"],
    queryFn: listInsumos,
    enabled: isAdmin === true,
  });
  const { data: subprodutos } = useQuery({
    queryKey: ["erp-subprodutos"],
    queryFn: listSubprodutos,
    enabled: isAdmin === true,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [detail, setDetail] = useState<ProductDetailForm>(EMPTY_DETAIL);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, category_id: data?.categories[0]?.id ?? "" });
    setDetail(EMPTY_DETAIL);
    setFile(null);
    setPreview("");
    setOpen(true);
  };

  const openEdit = async (p: AdminProduct) => {
    setForm({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      price: String(p.price),
      available: p.available,
      image_url: p.image_url,
      free_addon_limit: String(p.free_addon_limit),
      eixo_variacao: p.eixo_variacao || "Tamanho",
      saldo_estoque: String(p.saldo_estoque).replace(".", ","),
      estoque_minimo: String(p.estoque_minimo).replace(".", ","),
      estoque_maximo: String(p.estoque_maximo).replace(".", ","),
    });
    setFile(null);
    setPreview(p.display_url);
    setDetail(EMPTY_DETAIL);
    setOpen(true);
    setLoadingDetail(true);
    try {
      const d = await fetchProductDetail(p.id);
      setDetail(detailToForm(d));
    } catch {
      toast.error("Não foi possível carregar os detalhes do item.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category_id) {
      toast.error("Preencha o nome e a categoria.");
      return;
    }
    const price = parseNumberInput(form.price);
    if (price < 0) {
      toast.error("Informe um preço válido.");
      return;
    }

    setSaving(true);
    try {
      let imageRef = form.image_url;
      if (file) {
        const optimized = await compressImage(file);
        imageRef = await uploadMenuImage(optimized);
      }

      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        available: form.available,
        image_url: imageRef,
        free_addon_limit: Math.max(0, Math.trunc(Number(form.free_addon_limit) || 0)),
        eixo_variacao: form.eixo_variacao.trim() || "Tamanho",
        saldo_estoque: parseNumberInput(form.saldo_estoque),
        estoque_minimo: parseNumberInput(form.estoque_minimo),
        estoque_maximo: parseNumberInput(form.estoque_maximo),
      };

      let productId = form.id;
      if (productId) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = inserted.id;
      }

      await saveProductDetail(productId!, formToDetail(detail));

      toast.success(form.id ? "Item atualizado!" : "Item adicionado!");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o item.");
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
      toast.error(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  };

  const handleClone = async (p: AdminProduct) => {
    if (cloningId) return;
    setCloningId(p.id);
    try {
      await cloneProduct(p.id);
      toast.success("Produto clonado com sucesso!");
      await queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível duplicar o produto.");
    } finally {
      setCloningId(null);
    }
  };

  if (userRole !== "admin" && roleLoading) {
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
          <p className="mt-1 text-sm text-muted-foreground">Seu nível de acesso não permite abrir a Retaguarda. Fale com o administrador da empresa.</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden">
      <AdminSidebar
        activeTab={tab}
        isSuperAdmin={!!isSuperAdmin}
        tabAllowed={tabAllowed}
        onSelectTab={setTab}
        onLock={handleLock}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AppShell className="h-full">
          {/* Slim header */}
          <ShellHeader className="border-b border-border bg-background/95 backdrop-blur-md">
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <SidebarTrigger className="shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Retaguarda</p>
                <h1 className="truncate font-display text-xl font-bold leading-tight">
                  {TABS.find((t) => t.key === tab)?.label ?? "Gerenciador"}
                </h1>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {isSuperAdmin && (
                  <Button asChild size="sm" variant="secondary" className="gap-1.5">
                    <Link to="/superadmin">
                      <Crown className="h-4 w-4 text-primary" /> Painel Master
                    </Link>
                  </Button>
                )}
                {tab === "cardapio" && (
                  <Button size="sm" onClick={openNew}>
                    <Plus className="mr-1 h-4 w-4" /> Novo produto
                  </Button>
                )}
              </div>
            </div>
          </ShellHeader>

        <ShellBody className="w-full px-4 py-5 lg:px-8">
          {tab === "financeiro" && <TesourariaView />}
          {tab === "estoque" && <EntradaEstoqueView />}
          {tab === "ajustes" && <AjusteRapidoView />}
          {tab === "compras" && <SugestaoComprasView />}
          {tab === "categorias" && <CategoriasCrud />}
          {tab === "combos" && <CombosCrud />}
          {tab === "empresa" && <EmpresaConfigTab />}
          {tab === "identidade" && <IdentidadeVisualTab />}
          {tab === "pagamentos" && <PaymentConfigTab />}
          {tab === "clientes" && <ClientesView canBlock />}
          {tab === "conta" && <ContaCorrenteTab mode="admin" />}
          {tab === "insumos" && <InsumosCrud />}
          {tab === "subprodutos" && <SubprodutosCrud />}
          {tab === "setores" && <SetoresCrud />}
          {tab === "fornecedores" && <FornecedoresCrud />}
          {tab === "funcionarios" && <FuncionariosTab />}
          {tab === "permissoes" && <PermissoesTab />}

          {tab === "cardapio" && (
            <>
              {isLoading && (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              )}

              {data &&
                data.categories.map((cat) => {
                  const products = data.products.filter((p) => p.category_id === cat.id);
                  if (products.length === 0) return null;
                  return (
                    <section key={cat.id} className="mb-7">
                      <h2 className="mb-3 font-display text-base font-bold">{cat.name}</h2>
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {products.map((p) => {
                          const isCloning = cloningId === p.id;
                          return (
                          <div
                            key={p.id}
                            className={
                              "flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-card transition-all duration-500 animate-in fade-in-0 slide-in-from-top-1 " +
                              (isCloning ? "pointer-events-none opacity-50" : "")
                            }
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
                                <span
                                  className={`ml-2 font-medium ${
                                    !p.available || !p.disponivel
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }`}
                                >
                                  [CMV {formatBRL(p.custo_total)} - {!p.available || !p.disponivel ? "Bloqueado" : "Liberado"}]
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Sugestão: {formatBRL(p.preco_ideal_revenda)}
                                <span className="ml-1">({p.margem_revenda}%)</span>
                              </p>
                            </div>

                            <IconBtn
                              label="Editar produto"
                              onClick={() => openEdit(p)}
                              icon={<Pencil className="h-4 w-4" />}
                            />
                            <IconBtn
                              label="Duplicar produto (Cópia rápida em segundo plano)"
                              onClick={() => handleClone(p)}
                              disabled={isCloning || cloningId !== null}
                              icon={
                                isCloning ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )
                              }
                            />
                            <IconBtn
                              label="Remover produto"
                              onClick={() => handleDelete(p)}
                              disabled={isCloning}
                              variant="destructive"
                              icon={<Trash2 className="h-4 w-4" />}
                            />
                          </div>
                          );
                        })}
                      </div>

                    </section>
                  );
                })}
            </>
          )}
        </ShellBody>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <ModalActionBar
            title={form.id ? "Editar produto" : "Novo produto"}
            onBack={() => setOpen(false)}
            onSave={handleSave}
            saving={saving}
            saveDisabled={loadingDetail}
            saveLabel="Salvar"
          />

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
                  {file ? file.name : preview ? "Clique para trocar a imagem" : "Selecionar imagem do dispositivo"}
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
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ingredientes, detalhes..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-price">Preço revenda (R$)</Label>
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
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
                <Label htmlFor="prod-available" className="cursor-pointer">
                  Disponível
                </Label>
                <Switch
                  id="prod-available"
                  checked={form.available}
                  onCheckedChange={(v) => setForm({ ...form, available: v })}
                />
              </div>
              {detail.manipulado && (
                <div className="space-y-2">
                  <Label htmlFor="prod-free-limit">Adicionais grátis</Label>
                  <Input
                    id="prod-free-limit"
                    inputMode="numeric"
                    value={form.free_addon_limit}
                    onChange={(e) => setForm({ ...form, free_addon_limit: e.target.value })}
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {detail.manipulado && (
              <div className="space-y-2">
                <Label htmlFor="prod-eixo">Rótulo do eixo de variação</Label>
                <Input
                  id="prod-eixo"
                  value={form.eixo_variacao}
                  onChange={(e) => setForm({ ...form, eixo_variacao: e.target.value })}
                  placeholder="Ex.: Escolha sabor, Escolha tamanho, Escolha cor"
                />
                <p className="text-xs text-muted-foreground">
                  Texto exibido acima das opções de variação no app (sem artigos).
                </p>
              </div>
            )}


            {!detail.manipulado && (
              <div className="rounded-xl border border-border p-3">
                <Label className="text-sm font-semibold">Controle de estoque (item de revenda)</Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Usado na baixa automática por venda e na sugestão de compras.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-saldo" className="text-xs">
                      Saldo atual
                    </Label>
                    <Input
                      id="prod-saldo"
                      inputMode="decimal"
                      value={form.saldo_estoque}
                      readOnly
                      className="cursor-not-allowed bg-secondary text-muted-foreground"
                      title="Somente leitura. Ajuste o estoque por Entrada de Estoque ou Ajustes para manter a auditoria."
                      placeholder="0"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Somente leitura — use Entrada de Estoque/Ajustes.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-min" className="text-xs">
                      Mínimo
                    </Label>
                    <Input
                      id="prod-min"
                      inputMode="decimal"
                      value={form.estoque_minimo}
                      onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-max" className="text-xs">
                      Máximo
                    </Label>
                    <Input
                      id="prod-max"
                      inputMode="decimal"
                      value={form.estoque_maximo}
                      onChange={(e) => setForm({ ...form, estoque_maximo: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {loadingDetail ? (
              <div className="flex justify-center border-t border-border py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <ProductDetailFields
                value={detail}
                onChange={setDetail}
                setores={setores ?? []}
                fornecedores={fornecedores ?? []}
                insumos={insumos ?? []}
                subprodutos={subprodutos ?? []}
                eixoVariacao={form.eixo_variacao}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
