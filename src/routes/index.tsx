import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ACCESS_DENIED_MSG } from "@/lib/permissions";
import { useScope } from "@/hooks/useScope";
import { useMesaSession } from "@/hooks/useMesaSession";
import { useAtendimento } from "@/hooks/useAtendimento";
import { MesaScannerDialog } from "@/components/MesaScannerDialog";
import {
  ShoppingBag,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowLeft,
  LogOut,
  ChefHat,
  QrCode,
  ClipboardList,
  Settings,
  Wallet,
  User,
  ReceiptText,
  Clock,
} from "lucide-react";
import { menuQueryOptions, type Category, type Product, type NextOpening } from "@/lib/menu";

import { empresaQueryOptions } from "@/lib/empresa";
import { useCart, type NewCartItem } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { CartSheet } from "@/components/CartSheet";
import { NotificationBell } from "@/components/NotificationBell";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const heroImg = "/images/hero.jpg";

export const Route = createFileRoute("/")({
  // Muro de Autenticação (v1.6.0): o cardápio nunca abre para quem não tem
  // sessão. `ssr: false` porque a sessão do Supabase vive no localStorage e o
  // servidor não a enxerga — checar no cliente evita loop de redirect no F5.
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      try {
        sessionStorage.setItem("post_login_redirect", "/");
      } catch {
        /* ignore storage errors */
      }
      throw redirect({ to: "/auth" });
    }
  },
  validateSearch: (s: Record<string, unknown>): { denied?: string } => ({
    denied: typeof s.denied === "string" ? s.denied : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Clube 23 — Delivery de fast food" },
      {
        name: "description",
        content:
          "Peça pratos, lanches, sobremesas e bebidas com entrega rápida no Clube 23. Cardápio variado em fileiras e pedido em poucos toques.",
      },
      { property: "og:title", content: "Clube 23 — Delivery de Comida" },
      {
        property: "og:description",
        content: "Cardápio variado com entrega rápida. Peça em poucos toques.",
      },
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  component: HomePage,
});

interface Selection {
  product: Product;
  category: Category;
  siblings: Product[];
}

function HomePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(menuQueryOptions);
  const { data: empresa } = useQuery(empresaQueryOptions);
  const { session: mesa } = useMesaSession();
  const { status } = useAtendimento();
  const isMesa = status === "MESA" && !!mesa;
  const { totalItems, totalPrice } = useCart();
  const { user, signOut } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);

  // Logout com "Muro de Autenticação" instantâneo (v1.7.1): limpa o cache de
  // dados protegidos e redireciona já para /auth (history REPLACE), ocultando
  // o cardápio imediatamente sem esperar a próxima navegação.
  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };


  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  // Escopo de subdomínio: PDV e Gerência não usam o cardápio como landing.
  const navigate = useNavigate();
  const { scope, hydrated } = useScope();
  const search = Route.useSearch();
  const deniedShown = useRef(false);

  // Feedback quando o usuário foi redirecionado por falta de permissão (Camada 1).
  useEffect(() => {
    if (search.denied && !deniedShown.current) {
      deniedShown.current = true;
      toast.error(ACCESS_DENIED_MSG);
    }
  }, [search.denied]);

  useEffect(() => {
    if (!hydrated) return;
    // Não brigar com o guard de porta: se caímos aqui por acesso negado,
    // permanecemos na home do cliente em vez de reencaminhar por escopo.
    if (search.denied) return;
    if (scope === "pdv") navigate({ to: "/caixa", replace: true });
    else if (scope === "gerencia") navigate({ to: "/admin", replace: true });
  }, [hydrated, scope, navigate, search.denied]);


  // No universo de vendas (delivery) o cliente fica fixo na sacola/cardápio:
  // atalhos de fuga para retaguarda/caixa só aparecem fora do delivery.
  const showBackofficeShortcuts = scope !== "delivery";

  // Product currently shown in the details modal.
  const [detail, setDetail] = useState<Selection | null>(null);
  // Product routed to the customization sheet after "Escolher".
  const [customize, setCustomize] = useState<Selection | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Barra Superior Corporativa — fixa, opaca, acima de tudo */}
      <header className="fixed inset-x-0 top-0 z-50 h-20 border-b border-border/60 bg-background">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            <h1 className="font-display text-xl font-bold leading-tight text-white">{empresa?.nome_fantasia ?? ""}</h1>
          </div>

          <div className="flex items-center gap-1">
            {user ? (
              <>
                {isAdmin && showBackofficeShortcuts && (
                  <Link
                    to="/caixa"
                    aria-label="Painel do caixa"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <Wallet className="h-5 w-5" />
                  </Link>
                )}
                {isAdmin && showBackofficeShortcuts && (
                  <Link
                    to="/admin"
                    aria-label="Administração do cardápio"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
                {/* Ícone QR — muda o contexto para MESA silenciosamente (v1.6.0) */}
                <button
                  aria-label="Ler QR-Code da mesa"
                  onClick={() => setScannerOpen(true)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary ${
                    isMesa ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <QrCode className="h-5 w-5" />
                </button>
                <NotificationBell />
                <Link
                  to="/orders"
                  aria-label="Meus pedidos"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <ClipboardList className="h-5 w-5" />
                </Link>
                <Link
                  to="/perfil"
                  aria-label="Meus dados"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <User className="h-5 w-5" />
                </Link>
                <button
                  aria-label="Sair"
                  onClick={handleSignOut}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <MesaScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} />


      {/* Central scrolling panel — clamped between both bars, lower z-index */}
      <main className="relative z-10 mx-auto max-w-6xl pt-20 pb-28">
        {isLoading && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <p className="py-24 text-center text-sm text-muted-foreground">
            Não foi possível carregar o cardápio. Tente novamente.
          </p>
        )}

        {data?.isClosed && <StoreClosedBanner nextOpening={data.nextOpening} />}

        {data && !data.isClosed &&
          data.categories.map((cat) => {
            const products = data.products.filter((p) => p.category_id === cat.id);
            if (products.length === 0) return null;
            return (
              <CategoryRow
                key={cat.id}
                category={cat}
                products={products}
                onOpen={(product) => setDetail({ product, category: cat, siblings: products })}
              />
            );
          })}

      </main>

      {/* Details modal */}
      <DetailModal
        selection={detail}
        onClose={() => setDetail(null)}
        onChoose={(sel) => {
          setDetail(null);
          setCustomize(sel);
        }}
      />

      {/* Customization sheet (reuses existing PWA flow) */}
      {customize && (
        <ProductCustomizer
          open={!!customize}
          onOpenChange={(o) => {
            if (!o) setCustomize(null);
          }}
          product={customize.product}
          category={customize.category}
          siblings={customize.siblings}
        />
      )}

      {/* Floating bars — carrinho e/ou acesso à comanda da mesa */}
      {(totalItems > 0 || mesa) && (
        <div className="fixed inset-x-0 bottom-0 z-50 space-y-2 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-md space-y-2">
            {mesa && (
              <Link
                to="/minha-comanda"
                className="flex w-full items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 px-5 py-3 text-primary shadow-card transition-transform active:scale-[0.99]"
              >
                <span className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5" />
                  <span className="text-sm font-semibold">
                    Minha comanda · Mesa {mesa.numero || "—"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5" />
              </Link>
            )}
            {totalItems > 0 && (
              <CartSheet>
                <button className="flex w-full items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-float transition-transform active:scale-[0.99]">
                  <span className="flex items-center gap-2">
                    <span className="relative">
                      {isMesa ? (
                        <ChefHat className="h-5 w-5" />
                      ) : (
                        <ShoppingBag className="h-5 w-5" />
                      )}
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                        {totalItems}
                      </span>
                    </span>
                    <span className="text-sm font-semibold">
                      {isMesa ? "Enviar pedido" : "Ver carrinho"}
                    </span>
                  </span>
                  <span className="font-display text-base font-bold">{formatBRL(totalPrice)}</span>
                </button>
              </CartSheet>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  products,
  onOpen,
}: {
  category: Category;
  products: Product[];
  onOpen: (product: Product) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="group relative mb-5">
      <h2
        className={`mb-3 px-4 font-display font-bold uppercase tracking-wide sm:px-6 ${category.tamanho_fonte} ${category.cor_fonte}`}
      >
        {category.name}
      </h2>

      <div className="relative">
        {/* Desktop arrows */}
        <button
          aria-label={`Voltar em ${category.name}`}
          onClick={() => scrollBy(-1)}
          className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/70 p-2 text-foreground opacity-0 ring-1 ring-border backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 md:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          aria-label={`Avançar em ${category.name}`}
          onClick={() => scrollBy(1)}
          className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/70 p-2 text-foreground opacity-0 ring-1 ring-border backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 md:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-scroll scroll-smooth px-4 pb-2 sm:px-6"
        >
          {products.map((p) => (
            <NetflixCard key={p.id} product={p} category={category} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NetflixCard({
  product,
  category,
  onOpen,
}: {
  product: Product;
  category: Category;
  onOpen: (product: Product) => void;
}) {
  const esgotado = product.esgotado;
  return (
    <div className="flex h-auto w-36 shrink-0 snap-start flex-col items-center gap-2 sm:w-44">
      {/* Name — top */}
      <h3 className="line-clamp-2 w-full text-center font-display text-sm font-bold leading-tight text-foreground">
        {product.name}
      </h3>

      {/* Square product image — clean, clickable */}
      <button
        type="button"
        aria-label={
          esgotado
            ? `${product.name} esgotado`
            : `Ver detalhes de ${product.name}`
        }
        onClick={() => !esgotado && onOpen(product)}
        disabled={esgotado}
        className="relative aspect-square w-full overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 transition-transform duration-200 hover:scale-[1.02] hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:ring-border/70"
      >
        <ProductImage
          src={product.image_url}
          alt={product.name}
          categorySlug={category.slug}
          width={352}
          height={352}
          className={`h-full w-full object-cover ${esgotado ? "grayscale" : ""}`}
        />
        {esgotado && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-destructive-foreground">
              Esgotado
            </span>
          </span>
        )}
      </button>

      {/* Price — bottom */}
      <p className="w-full text-center font-display text-base font-bold text-primary">
        {product.price_options.length > 1 && (
          <span className="mr-1 text-[10px] font-normal text-muted-foreground">a partir de</span>
        )}
        {formatBRL(product.price)}
      </p>
    </div>
  );
}

function DetailModal({
  selection,
  onClose,
  onChoose,
}: {
  selection: Selection | null;
  onClose: () => void;
  onChoose: (sel: Selection) => void;
}) {
  const { addLine } = useCart();

  if (!selection) return null;
  const { product, category } = selection;

  const needsCustomization =
    product.price_options.length > 1 ||
    product.addons.length > 0 ||
    category.allows_half ||
    product.free_addon_limit > 0 ||
    (product.removable_ingredients?.length ?? 0) > 0;

  function handleChoose() {
    if (!selection) return;
    if (needsCustomization) {
      onChoose(selection);
      return;
    }
    // Simple product: add straight to cart, preserving existing flow.
    const options = product.price_options.length
      ? product.price_options
      : [{ tamanho: "Padrão", preco: product.price }];
    const line: NewCartItem = {
      productId: product.id,
      productName: product.name,
      categorySlug: category.slug,
      comboRole: category.combo_role,
      name: product.name,
      size: options[0].tamanho,
      addons: [],
      secondFlavor: "",
      remocoes: [],
      unitPrice: options[0].preco,
      image_url: product.image_url,
    };
    addLine(line);
    onClose();
  }

  return (
    <Dialog open={!!selection} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose className="max-w-sm overflow-hidden rounded-2xl border-border bg-card p-0">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background px-3 py-2.5">
          <Button
            type="button"
            variant="back"
            onClick={onClose}
            className="gap-1.5 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleChoose}
            className="gap-1.5 font-semibold"
          >
            Escolher
          </Button>
        </div>

        <div className="relative aspect-[4/3] w-full">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            categorySlug={category.slug}
            width={640}
            height={480}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>

        <div className="space-y-3 px-5 pb-5 pt-1">
          <DialogTitle className="font-display text-xl font-bold leading-tight">{product.name}</DialogTitle>

          {product.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="font-display text-lg font-bold text-primary">
              {product.price_options.length > 1 && (
                <span className="mr-1 text-xs font-normal text-muted-foreground">a partir de</span>
              )}
              {formatBRL(product.price)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
