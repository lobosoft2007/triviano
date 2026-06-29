import { useMemo, useState } from "react";
import { Plus, Minus, Check } from "lucide-react";
import type { Category, Product } from "@/lib/menu";
import { useCart, type CartAddon, type NewCartItem } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  category: Category;
  /** Other products in the same category, for half-and-half selection. */
  siblings: Product[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ProductCustomizer({
  open,
  onOpenChange,
  product,
  category,
  siblings,
}: Props) {
  const { addLine } = useCart();
  const options = product.price_options.length
    ? product.price_options
    : [{ tamanho: "Padrão", preco: product.price }];

  const [sizeIdx, setSizeIdx] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<CartAddon[]>([]);
  const [half, setHalf] = useState(false);
  const [secondId, setSecondId] = useState<string>("");
  const [qty, setQty] = useState(1);

  const size = options[sizeIdx] ?? options[0];
  const second = siblings.find((s) => s.id === secondId) ?? null;

  const unitPrice = useMemo(() => {
    let base = size.preco;
    if (category.allows_half && half && second) {
      const firstPrice = size.preco;
      const secondPrice = second.price_options[0]?.preco ?? second.price;
      base = round2((firstPrice + secondPrice) / 2);
    }
    const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
    return round2(base + addonsTotal);
  }, [size, category.allows_half, half, second, selectedAddons]);

  function toggleAddon(addon: CartAddon) {
    setSelectedAddons((prev) =>
      prev.find((a) => a.name === addon.name)
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon],
    );
  }

  function reset() {
    setSizeIdx(0);
    setSelectedAddons([]);
    setHalf(false);
    setSecondId("");
    setQty(1);
  }

  function handleAdd() {
    if (category.allows_half && half && !second) return;

    let displayName = product.name;
    if (category.allows_half && half && second) {
      displayName = `½ ${product.name} / ½ ${second.name}`;
    } else if (options.length > 1) {
      displayName = `${product.name} (${size.tamanho})`;
    }

    const line: NewCartItem = {
      productId: product.id,
      productName: product.name,
      categorySlug: category.slug,
      comboRole: category.combo_role,
      name: displayName,
      size: size.tamanho,
      addons: selectedAddons,
      secondFlavor: half && second ? second.name : "",
      unitPrice,
      image_url: product.image_url,
    };
    addLine(line, qty);
    reset();
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-3xl p-0"
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-lg leading-tight">
            {product.name}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{product.description}</p>
        </SheetHeader>

        <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Sizes */}
          {options.length > 1 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold">Escolha o tamanho</h4>
              <div className="space-y-2">
                {options.map((op, idx) => (
                  <button
                    key={op.tamanho}
                    onClick={() => setSizeIdx(idx)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                      sizeIdx === idx
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="font-medium">{op.tamanho}</span>
                    <span className="font-semibold text-primary">
                      {formatBRL(op.preco)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Half and half */}
          {category.allows_half && (
            <section>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <span className="text-sm font-semibold">
                  Pizza meio a meio
                  <span className="block text-xs font-normal text-muted-foreground">
                    Cobra 50% de cada sabor
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={half}
                  onChange={(e) => {
                    setHalf(e.target.checked);
                    if (!e.target.checked) setSecondId("");
                  }}
                  className="h-5 w-5 accent-primary"
                />
              </label>

              {half && (
                <div className="mt-3 space-y-2">
                  <h4 className="text-sm font-semibold">Segundo sabor</h4>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {siblings
                      .filter((s) => s.id !== product.id)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSecondId(s.id)}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                            secondId === s.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {s.name}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatBRL(s.price_options[0]?.preco ?? s.price)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Add-ons */}
          {product.addons.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold">Adicionais</h4>
              <div className="space-y-2">
                {product.addons.map((a) => {
                  const checked = !!selectedAddons.find(
                    (x) => x.name === a.nome,
                  );
                  return (
                    <button
                      key={a.nome}
                      onClick={() =>
                        toggleAddon({ name: a.nome, price: a.preco })
                      }
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                        {a.nome}
                      </span>
                      <span className="font-semibold text-primary">
                        + {formatBRL(a.preco)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quantity */}
          <section className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Quantidade</h4>
            <div className="flex items-center gap-3">
              <button
                aria-label="Diminuir quantidade"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-base font-semibold tabular-nums">
                {qty}
              </span>
              <button
                aria-label="Aumentar quantidade"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>

        <div className="border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            className="h-13 w-full gap-2 rounded-2xl py-3.5 text-base"
            disabled={category.allows_half && half && !second}
            onClick={handleAdd}
          >
            Adicionar • {formatBRL(unitPrice * qty)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
