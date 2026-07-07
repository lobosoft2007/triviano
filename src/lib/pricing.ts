import type { CartItem } from "@/lib/cart";

/*
 * NOTE: The old static combo rule (fixed "1 Burger + 1 Side = R$7 off a
 * beverage") was removed. Combo discounts are now driven by the dynamic,
 * rules-based engine in `src/lib/combos.ts`, backed by the `regras_combos`
 * table and managed from the admin panel.
 */

export interface MinRule {
  slug: string;
  min: number;
  name: string;
}

/** Minimum-quantity rules per category. */
export const MIN_ORDER_RULES: MinRule[] = [
  { slug: "pasteis", min: 3, name: "Pastéis" },
];



export interface MinShortfall {
  slug: string;
  name: string;
  required: number;
  current: number;
  missing: number;
}

/**
 * Returns categories that have items in the cart but below their minimum
 * required quantity (e.g. Pastéis require at least 3 units).
 */
export function minOrderShortfalls(
  items: CartItem[],
  rules: MinRule[] = MIN_ORDER_RULES,
): MinShortfall[] {
  const out: MinShortfall[] = [];
  for (const rule of rules) {
    const current = items
      .filter((i) => i.categorySlug === rule.slug)
      .reduce((sum, i) => sum + i.quantity, 0);
    if (current > 0 && current < rule.min) {
      out.push({
        slug: rule.slug,
        name: rule.name,
        required: rule.min,
        current,
        missing: rule.min - current,
      });
    }
  }
  return out;
}

export function subtotalOf(items: CartItem[]): number {
  return items.reduce((sum, i) => {
    const unitPrice = Number.isFinite(Number(i.unitPrice)) ? Number(i.unitPrice) : 0;
    const quantity = Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 0;
    return sum + unitPrice * quantity;
  }, 0);
}
