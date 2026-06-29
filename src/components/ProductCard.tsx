import { Plus, Minus } from "lucide-react";
import type { Product } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const { items, addItem, increment, decrement } = useCart();
  const inCart = items.find((i) => i.id === product.id);

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
            {formatBRL(product.price)}
          </span>

          {inCart ? (
            <div className="flex items-center gap-2.5">
              <button
                aria-label={`Remover um ${product.name}`}
                onClick={() => decrement(product.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors active:bg-border"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-sm font-semibold tabular-nums">
                {inCart.quantity}
              </span>
              <button
                aria-label={`Adicionar um ${product.name}`}
                onClick={() => increment(product.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors active:bg-primary/80"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              aria-label={`Adicionar ${product.name} ao carrinho`}
              onClick={() =>
                addItem({
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image_url: product.image_url,
                })
              }
              className="flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
