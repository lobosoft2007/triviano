import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart";

export type TipoPromocao = "Combo" | "Pack";

/**
 * A resolved, active promotional rule ready for the cart engine.
 * - `Combo`: needs ≥1 item of EACH tied category present in the cart.
 * - `Pack`: needs the summed quantity of items in a SINGLE category to reach
 *   `quantidadeRequerida`.
 * `categorySlugs` holds only the non-null categories tied to the rule.
 */
export interface ActiveComboRule {
  id: string;
  nome_combo: string;
  valor_desconto: number;
  tipo_promocao: TipoPromocao;
  quantidade_requerida: number;
  categorySlugs: string[];
}

/** Fetches active promotional rules and resolves their category slugs. */
export async function fetchActiveCombos(): Promise<ActiveComboRule[]> {
  const { data, error } = await supabase
    .from("regras_combos")
    .select(
      `id, nome_combo, valor_desconto, tipo_promocao, quantidade_requerida,
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
      tipo_promocao: (r.tipo_promocao as TipoPromocao) ?? "Combo",
      quantidade_requerida: Math.max(1, Number(r.quantidade_requerida ?? 1)),
      categorySlugs: slugs,
    };
  });
}

/** A promotional rule that is currently satisfied by the cart contents. */
export interface AppliedCombo {
  id: string;
  nome_combo: string;
  valor_desconto: number;
  tipo_promocao: TipoPromocao;
}

/** Total quantity of cart items grouped by their category slug. */
function quantityByCategory(items: CartItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const i of items) {
    map.set(i.categorySlug, (map.get(i.categorySlug) ?? 0) + i.quantity);
  }
  return map;
}

/**
 * Returns every active rule currently satisfied by the cart.
 * - Combo: at least one item per tied category.
 * - Pack: summed quantity in the single tied category ≥ quantidade_requerida.
 * Multiple rules can apply at once.
 */
export function matchedCombos(
  items: CartItem[],
  combos: ActiveComboRule[],
): AppliedCombo[] {
  const qtyByCat = quantityByCategory(items);
  const out: AppliedCombo[] = [];

  for (const c of combos) {
    if (c.categorySlugs.length === 0 || c.valor_desconto <= 0) continue;

    let satisfied = false;
    if (c.tipo_promocao === "Pack") {
      const slug = c.categorySlugs[0];
      satisfied = (qtyByCat.get(slug) ?? 0) >= c.quantidade_requerida;
    } else {
      satisfied = c.categorySlugs.every((s) => (qtyByCat.get(s) ?? 0) > 0);
    }

    if (satisfied) {
      out.push({
        id: c.id,
        nome_combo: c.nome_combo,
        valor_desconto: c.valor_desconto,
        tipo_promocao: c.tipo_promocao,
      });
    }
  }
  return out;
}

/** Total discount from all simultaneously-satisfied promotional rules. */
export function comboDiscountFromRules(
  items: CartItem[],
  combos: ActiveComboRule[],
): number {
  return matchedCombos(items, combos).reduce(
    (sum, c) => sum + c.valor_desconto,
    0,
  );
}
