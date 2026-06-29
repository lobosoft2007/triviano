import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingBag, LogOut, Loader2, ClipboardList, Settings } from "lucide-react";
import { menuQueryOptions } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { CartSheet } from "@/components/CartSheet";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MenuPage,
});

function MenuPage() {
  const { data, isLoading, isError } = useQuery(menuQueryOptions);
  const { totalItems, totalPrice } = useCart();
  const { signOut, user } = useAuth();
  const [active, setActive] = useState<string | null>(null);

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

  const scrollTo = (slug: string) => {
    setActive(slug);
    document
      .getElementById(`cat-${slug}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="text-xs text-muted-foreground">Cardápio</p>
              <h1 className="font-display text-xl font-bold leading-tight">
                Sabor Express
              </h1>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Link
                  to="/admin"
                  aria-label="Administração do cardápio"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <Settings className="h-5 w-5" />
                </Link>
              )}
              <Link
                to="/orders"
                aria-label="Meus pedidos"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              >
                <ClipboardList className="h-5 w-5" />
              </Link>
              <button
                aria-label="Sair"
                onClick={() => signOut()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Category nav */}
          {data && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
              {data.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollTo(cat.slug)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active === cat.slug
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="px-5 py-5">
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          )}

          {isError && (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Não foi possível carregar o cardápio. Tente novamente.
            </p>
          )}

          {data &&
            data.categories.map((cat) => {
              const products = data.products.filter(
                (p) => p.category_id === cat.id,
              );
              if (products.length === 0) return null;
              return (
                <section
                  key={cat.id}
                  id={`cat-${cat.slug}`}
                  className="mb-7 scroll-mt-32"
                >
                  <h2 className="mb-3 font-display text-lg font-bold">
                    {cat.name}
                  </h2>
                  <div className="space-y-3">
                    {products.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        category={cat}
                        siblings={products}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
        </main>
      </div>

      {/* Floating cart bar */}
      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                <span className="font-display text-base font-bold">
                  {formatBRL(totalPrice)}
                </span>
              </button>
            </CartSheet>
          </div>
        </div>
      )}
    </div>
  );
}
