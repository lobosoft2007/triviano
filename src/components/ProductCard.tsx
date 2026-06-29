import { useState } from "react";
import { Plus, Minus, Settings2 } from "lucide-react";
import type { Category, Product } from "@/lib/menu";
import { useCart, makeLineId, type NewCartItem } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { ProductCustomizer } from "@/components/ProductCustomizer";

export function ProductCard({
  product,
  category,
  siblings,
}: {
  product: Product;
  category: Category;
  siblings: Product[];
}) {
  const { items, addLine, increment, decrement } = useCart();
  const [open, setOpen] = useState(false);

  const options = product.price_options.length
    ? product.price_options
    : [{ tamanho: "Padrão", preco: product.price }];

  const needsCustomization =
    options.length > 1 || product.addons.length > 0 || category.allows_half;

  // Simple line (single size, no add-ons) for quick add / stepper.
  const simpleLine: NewCartItem = {
    productId: product.id,
    productName: product.name,
    categorySlug: category.slug,
    comboRole: category.combo_role,
    name: product.name,
    size: options[0].tamanho,
    addons: [],
    secondFlavor: "",
    unitPrice: options[0].preco,
    image_url: product.image_url,
  };
  const simpleLineId = makeLineId(simpleLine);
  const inCart = items.find((i) => i.lineId === simpleLineId);

  return (
    <div className="flex gap-3 rounded-2xl bg-card p-3 shadow-card">
      <img
        src={product.image_url}
        alt={product.name}
        loading="lazy"
        width={768}
        height={768}
        className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-base font-semibold leading-tight">
          {product.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-base font-bold text-primary">
            {options.length > 1 && (
              <span className="mr-1 text-xs font-normal text-muted-foreground">
                a partir de
              </span>
            )}
            {formatBRL(product.price)}
          </span>

          {needsCustomization ? (
            <button
              aria-label={`Personalizar ${product.name}`}
              onClick={() => setOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              <Settings2 className="h-4 w-4" />
              Escolher
            </button>
          ) : inCart ? (
            <div className="flex items-center gap-2.5">
              <button
                aria-label={`Remover um ${product.name}`}
                onClick={() => decrement(simpleLineId)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors active:bg-border"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-sm font-semibold tabular-nums">
                {inCart.quantity}
              </span>
              <button
                aria-label={`Adicionar um ${product.name}`}
                onClick={() => increment(simpleLineId)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors active:bg-primary/80"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              aria-label={`Adicionar ${product.name} ao carrinho`}
              onClick={() => addLine(simpleLine)}
              className="flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>

      {needsCustomization && (
        <ProductCustomizer
          open={open}
          onOpenChange={setOpen}
          product={product}
          category={category}
          siblings={siblings}
        />
      )}
    </div>
  );
}
