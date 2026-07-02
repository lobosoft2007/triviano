import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart";

/**
 * A resolved, active combo rule ready for the cart engine.
 * `categorySlugs` holds only the non-null categories tied to the rule.
 */
export interface ActiveComboRule {
  id: string;
  nome_combo: string;
  valor_desconto: number;
  categorySlugs: string[];
}

/** Fetches active combo rules and resolves their category slugs. */
export async function fetchActiveCombos(): Promise<ActiveComboRule[]> {
  const { data, error } = await supabase
    .from("regras_combos")
    .select(
      `id, nome_combo, valor_desconto,
       c1:categories!regras_combos_id_categoria_1_fkey(slug),
       c2:categories!regras_combos_id_categoria_2_fkey(slug),
       c3:categories!regras_combos_id_categoria_3_fkey(slug)`,
    )
    .eq("ativo", true);
  if (error) throw error;

  return (data ?? []).map((r) => {
    const slugs = [
      (r.c1 as { slug: string } | null)?.slug,
      (r.c2 as { slug: string } | null)?.slug,
      (r.c3 as { slug: string } | null)?.slug,
    ].filter((s): s is string => Boolean(s));
    return {
      id: r.id,
      nome_combo: r.nome_combo,
      valor_desconto: Number(r.valor_desconto ?? 0),
      categorySlugs: slugs,
    };
  });
}

/** A combo rule that is currently satisfied by the cart contents. */
export interface AppliedCombo {
  id: string;
  nome_combo: string;
  valor_desconto: number;
}

/**
 * Returns every active combo whose categories are ALL present in the cart
 * (at least one item per tied category). Multiple combos can apply at once.
 */
export function matchedCombos(
  items: CartItem[],
  combos: ActiveComboRule[],
): AppliedCombo[] {
  const present = new Set(items.map((i) => i.categorySlug));
  const out: AppliedCombo[] = [];
  for (const c of combos) {
    if (c.categorySlugs.length === 0 || c.valor_desconto <= 0) continue;
    if (c.categorySlugs.every((s) => present.has(s))) {
      out.push({
        id: c.id,
        nome_combo: c.nome_combo,
        valor_desconto: c.valor_desconto,
      });
    }
  }
  return out;
}

/** Total discount from all simultaneously-satisfied combo rules. */
export function comboDiscountFromRules(
  items: CartItem[],
  combos: ActiveComboRule[],
): number {
  return matchedCombos(items, combos).reduce(
    (sum, c) => sum + c.valor_desconto,
    0,
  );
}
