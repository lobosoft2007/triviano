import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ShoppingBag,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  LogIn,
  ClipboardList,
  Settings,
  Wallet,
  User,
} from "lucide-react";
import { menuQueryOptions, type Category, type Product } from "@/lib/menu";
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

const heroImg = "/images/hero.jpg";

export const Route = createFileRoute("/")({
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
  const { data, isLoading, isError } = useQuery(menuQueryOptions);
  const { data: empresa } = useQuery(empresaQueryOptions);
  const { totalItems, totalPrice } = useCart();
  const { user, signOut } = useAuth();

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
                {isAdmin && (
                  <Link
                    to="/caixa"
                    aria-label="Painel do caixa"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <Wallet className="h-5 w-5" />
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin"
                    aria-label="Administração do cardápio"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
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
                  onClick={() => signOut()}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                aria-label="Entrar"
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
              >
                <LogIn className="h-4 w-4" />
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

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

        {data &&
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

      {/* Floating cart bar — opaque black, above everything */}
      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-md">
            <CartSheet>
              <button className="flex w-full items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-float transition-transform active:scale-[0.99]">
                <span className="flex items-center gap-2">
                  <span className="relative">
                    <ShoppingBag className="h-5 w-5" />
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {totalItems}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">Ver carrinho</span>
                </span>
                <span className="font-display text-base font-bold">{formatBRL(totalPrice)}</span>
              </button>
            </CartSheet>
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
  return (
    <div className="flex h-auto w-36 shrink-0 snap-start flex-col items-center gap-2 sm:w-44">
      {/* Name — top */}
      <h3 className="line-clamp-2 w-full text-center font-display text-sm font-bold leading-tight text-foreground">
        {product.name}
      </h3>

      {/* Square product image — clean, clickable */}
      <button
        type="button"
        aria-label={`Ver detalhes de ${product.name}`}
        onClick={() => onOpen(product)}
        className="aspect-square w-full overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 transition-transform duration-200 hover:scale-[1.02] hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <ProductImage
          src={product.image_url}
          alt={product.name}
          categorySlug={category.slug}
          width={352}
          height={352}
          className="h-full w-full object-cover"
        />
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
      <DialogContent className="max-w-sm overflow-hidden rounded-2xl border-border bg-card p-0">
        <button
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>

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

          <button
            onClick={handleChoose}
            className="mt-1 flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3.5 font-display text-base font-bold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            Escolher
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
