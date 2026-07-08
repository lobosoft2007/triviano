import { useState, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  AlertCircle,
  BadgePercent,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ProductImage";

export function CartSheet({ children }: { children: React.ReactNode }) {
  const {
    items,
    totalItems,
    subtotal,
    discount,
    appliedCombos,
    totalPrice,
    shortfalls,
    increment,
    decrement,
    removeItem,
  } = useCart();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleCheckoutClick(event: MouseEvent<HTMLAnchorElement>) {
    // Always drive navigation through the client router. A plain <a href> full
    // reload was fragile inside the Sheet portal (coordinate-dependent clicks,
    // stale PWA shell) and kept "swallowing" the transition. Client-side
    // navigation also keeps the cart + auth in memory, so /checkout can never
    // bounce back to "/" on a transient empty/hydrating state.
    event.preventDefault();
    try {
      const sessionUser = user ?? null;
      const sessionLoading = Boolean(loading);

      const safeItems = Array.isArray(items)
        ? items.filter((item) => item && typeof item === "object")
        : [];

      // [AUDITORIA] O carrinho é anônimo (persistido em localStorage) e NÃO
      // carrega userId próprio — por isso `cart.userId` é sempre undefined hoje.
      const cartUserId = (items as unknown as { userId?: string }).userId;
      console.log("[AUDITORIA] UserID Logado no Supabase:", sessionUser?.id);
      console.log("[AUDITORIA] UserID vinculado ao Carrinho:", cartUserId);
      console.log("[AUDITORIA] Itens no Carrinho:", items);
      console.log("[AUDITORIA] O Carrinho possui UserID? ", !!cartUserId);



      if (safeItems.length === 0) {
        toast.error("Adicione ao menos um item antes de finalizar.");
        return;
      }
      if (sessionLoading) {
        toast.info("Carregando sua sessão. Tente novamente em instantes.");
        return;
      }

      if (!sessionUser) {
        // Remember where the customer wanted to go so login returns them here.
        try {
          sessionStorage.setItem("post_login_redirect", "/checkout");
        } catch {
          /* ignore storage errors */
        }
        toast.error("Faça login para finalizar o pedido.");
        console.log("[CHECKOUT] Redirecionando para autenticação");
        setOpen(false);
        navigate({ to: "/auth" });
        return;
      }

      console.log("[CHECKOUT] Redirecionando para pagamento");
      setOpen(false);
      navigate({ to: "/checkout" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("ERRO CRÍTICO NO CARRINHO:", error);
      toast.error(`ERRO CRÍTICO NO CARRINHO: ${message}`);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85dvh] max-w-md flex-col rounded-t-3xl p-0"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-xl">
            Seu carrinho {totalItems > 0 && `(${totalItems})`}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Revise os itens do seu pedido antes de finalizar a compra.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <ShoppingBag className="h-8 w-8" />
            </span>
            <p className="text-sm text-muted-foreground">
              Seu carrinho está vazio.
              <br />
              Adicione itens do cardápio.
            </p>
          </div>
        ) : (
          <>
            <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-card"
                >
                  <ProductImage
                    src={item.image_url}
                    alt={item.name}
                    categorySlug={item.categorySlug}
                    width={768}
                    height={768}
                    className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    {(item.addons.length > 0 ||
                      (item.size && item.size !== "Padrão" && !item.secondFlavor && item.name === item.productName)) && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.addons
                          .map(
                            (a) =>
                              `+ ${a.name}${(a.quantity ?? 1) > 1 ? ` ×${a.quantity}` : ""}`,
                          )
                          .join(", ")}
                      </p>
                    )}
                    {item.remocoes.length > 0 && (
                      <p className="truncate text-[11px] font-semibold text-destructive">
                        {item.remocoes.map((r) => `Sem ${r}`).join(", ")}
                      </p>
                    )}
                    <p className="text-sm font-bold text-primary">
                      {formatBRL((item.unitPrice ?? 0) * (item.quantity ?? 1))}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        aria-label="Diminuir"
                        onClick={() => decrement(item.lineId)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-4 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        aria-label="Aumentar"
                        onClick={() => increment(item.lineId)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    aria-label={`Remover ${item.name}`}
                    onClick={() => removeItem(item.lineId)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {shortfalls.map((s) => (
                <div
                  key={s.slug}
                  className="mb-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Pedido mínimo de {s.required} unidades em {s.name}. Adicione
                    mais {s.missing}.
                  </span>
                </div>
              ))}

              {appliedCombos.map((c) => (
                <div
                  key={c.id}
                  className="mb-2 flex items-center justify-between text-sm text-success"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <BadgePercent className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      Desconto aplicado: {c.nome_combo}
                      {c.vezes > 1 ? ` (${c.vezes}x)` : ""}
                      {c.percentual != null
                        ? ` · ${String(c.percentual).replace(".", ",")}%`
                        : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    − {formatBRL(c.valor_desconto)}
                  </span>
                </div>
              ))}


              {discount > 0 && appliedCombos.length === 0 && (
                <div className="mb-2 flex items-center justify-between text-sm text-success">
                  <span className="flex items-center gap-1.5">
                    <BadgePercent className="h-4 w-4" />
                    Desconto combo
                  </span>
                  <span className="font-semibold tabular-nums">
                    − {formatBRL(discount)}
                  </span>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-xl font-bold">
                  {formatBRL(totalPrice)}
                </span>
              </div>
              <Button asChild size="lg" className="h-13 w-full gap-2 rounded-2xl py-3.5 text-base">
                <a
                  href={user ? "/checkout" : "/auth"}
                  aria-disabled={items.length === 0}
                  onClick={handleCheckoutClick}
                >
                  Finalizar pedido
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
