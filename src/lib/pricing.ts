import type { CartItem } from "@/lib/cart";

/** Combo: 1 Burger + 1 Acompanhamento/Petisco grants R$7 off a beverage. */
export const COMBO_DISCOUNT_PER_PAIR = 7;

export interface MinRule {
  slug: string;
  min: number;
  name: string;
}

/** Minimum-quantity rules per category. */
export const MIN_ORDER_RULES: MinRule[] = [
  { slug: "pasteis", min: 3, name: "Pastéis" },
];

function qtyByRole(items: CartItem[], role: CartItem["comboRole"]): number {
  return items
    .filter((i) => i.comboRole === role)
    .reduce((sum, i) => sum + i.quantity, 0);
}

function totalByRole(items: CartItem[], role: CartItem["comboRole"]): number {
  return items
    .filter((i) => i.comboRole === role)
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

/**
 * Combo discount: for each Burger + Side pair, apply R$7 off beverages,
 * capped at the total beverage value (never negative).
 */
export function comboDiscount(items: CartItem[]): number {
  const burgers = qtyByRole(items, "burger");
  const sides = qtyByRole(items, "side");
  const pairs = Math.min(burgers, sides);
  if (pairs <= 0) return 0;
  const beverageTotal = totalByRole(items, "beverage");
  if (beverageTotal <= 0) return 0;
  const raw = pairs * COMBO_DISCOUNT_PER_PAIR;
  return Math.min(raw, beverageTotal);
}

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
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}
