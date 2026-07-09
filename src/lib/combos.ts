import { supabase } from "@/integrations/supabase/client";
import { currentHost } from "@/lib/empresa";
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
  frase_promocional: string | null;
  categorySlugs: string[];
}

/** Fetches active promotional rules and resolves their category slugs. */
export async function fetchActiveCombos(): Promise<ActiveComboRule[]> {
  // Tenant isolation: combos are read through a SECURITY DEFINER RPC that
  // resolves the current establishment from the access host and returns ONLY
  // that tenant's active rules. The regras_combos table itself is no longer
  // publicly readable, so a cart can never apply another company's discount.
  const { data, error } = await supabase.rpc("get_public_combos_by_host", {
    p_host: currentHost(),
  });
  if (error) throw error;

  return (data ?? []).map((r) => {
    const slugs = [r.slug1, r.slug2, r.slug3].filter(
      (s): s is string => Boolean(s),
    );
    return {
      id: r.id,
      nome_combo: r.nome_combo,
      valor_desconto: Number(r.valor_desconto ?? 0),
      tipo_promocao: (r.tipo_promocao as TipoPromocao) ?? "Combo",
      quantidade_requerida: Math.max(1, Number(r.quantidade_requerida ?? 1)),
      frase_promocional: r.frase_promocional ?? null,
      categorySlugs: slugs,
    };
  });
}

/**
 * A promotional rule that ended up applied to the cart.
 * `valor_desconto` is ALWAYS the final monetary discount (in R$) granted by this
 * rule — for Packs it is already resolved from the configured percentage, and it
 * aggregates every time the rule was applied (`vezes`).
 * `percentual` is the raw percentage for Packs (null for Combos), for display.
 */
export interface AppliedCombo {
  id: string;
  nome_combo: string;
  valor_desconto: number;
  tipo_promocao: TipoPromocao;
  percentual: number | null;
  /** How many times this rule was applied (identical combos can stack). */
  vezes: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A single promotion "instance" that could be formed with the units currently
 * available in the pool.
 */
interface Candidate {
  /** Monetary discount (R$) this instance would grant right now. */
  discount: number;
  /** Removes the exact units this instance consumes from the live pool. */
  consume: () => void;
}

/**
 * Builds a pool of individual unit prices per category slug (each cart unit is
 * expanded into its own entry), sorted ascending so combos can take the
 * cheapest units and packs the most valuable ones.
 */
function buildPricePool(items: CartItem[]): Map<string, number[]> {
  const pool = new Map<string, number[]>();
  for (const i of items) {
    const slug = i.categorySlug ?? "";
    if (!slug) continue;
    const arr = pool.get(slug) ?? [];
    const unitPrice = Number.isFinite(Number(i.unitPrice)) ? Number(i.unitPrice) : 0;
    const quantity = Math.max(0, Math.floor(Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 0));
    for (let n = 0; n < quantity; n++) arr.push(unitPrice);
    pool.set(slug, arr);
  }
  for (const arr of pool.values()) arr.sort((a, b) => a - b);
  return pool;
}

/** Best combo instance formable now: 1 unit from each tied category. */
function comboCandidate(
  rule: ActiveComboRule,
  pool: Map<string, number[]>,
): Candidate | null {
  for (const slug of rule.categorySlugs) {
    if ((pool.get(slug)?.length ?? 0) < 1) return null;
  }
  return {
    discount: rule.valor_desconto,
    // Consume the cheapest available unit per category, leaving the pricier
    // ones for potential percentage-based packs.
    consume: () => {
      for (const slug of rule.categorySlugs) pool.get(slug)!.shift();
    },
  };
}

/** Best pack instance formable now: N units of the single tied category. */
function packCandidate(
  rule: ActiveComboRule,
  pool: Map<string, number[]>,
): Candidate | null {
  const slug = rule.categorySlugs[0];
  const arr = pool.get(slug);
  const n = rule.quantidade_requerida;
  if (!arr || arr.length < n) return null;

  // Consume the most expensive units to maximise the percentage discount.
  const value = arr.slice(arr.length - n).reduce((a, b) => a + b, 0);
  const percentual = Math.min(100, Math.max(0, rule.valor_desconto));
  const discount = round2(value * (percentual / 100));
  if (discount <= 0) return null;

  return {
    discount,
    consume: () => {
      for (let k = 0; k < n; k++) arr.pop();
    },
  };
}

/**
 * Resolves which promotions apply to the cart with conflict protection.
 *
 * Every unit of every product can back at most ONE promotion instance. On each
 * pass the engine simulates the best instance of every active rule against the
 * remaining units and commits only the single most valuable one (in R$),
 * consuming its units. Repeating until nothing else pays out yields:
 * - "Maior vantagem": when a Combo and a Pack fight over the same items, only
 *   the one granting the larger R$ discount is applied; the loser is voided
 *   because its items are gone.
 * - Item isolation: units already spent on one promotion cannot be reused by
 *   another; identical combos may still stack when there are enough distinct
 *   repeated items to back each one.
 */
export function matchedCombos(
  items: CartItem[],
  combos: ActiveComboRule[],
): AppliedCombo[] {
  const pool = buildPricePool(items);
  const rules = combos.filter(
    (c) => c.categorySlugs.length > 0 && c.valor_desconto > 0,
  );
  const applied = new Map<string, AppliedCombo>();

  // Greedy: on each round, commit the single highest-value promotion instance
  // still formable from the remaining unit pool.
  // Bounded by total units to guarantee termination.
  const maxRounds = items.reduce((s, i) => s + i.quantity, 0) + 1;
  for (let round = 0; round < maxRounds; round++) {
    let best: { rule: ActiveComboRule; cand: Candidate } | null = null;

    for (const rule of rules) {
      const cand =
        rule.tipo_promocao === "Pack"
          ? packCandidate(rule, pool)
          : comboCandidate(rule, pool);
      if (cand && cand.discount > (best?.cand.discount ?? 0)) {
        best = { rule, cand };
      }
    }

    if (!best || best.cand.discount <= 0) break;

    best.cand.consume();
    const rec = applied.get(best.rule.id);
    if (rec) {
      rec.valor_desconto = round2(rec.valor_desconto + best.cand.discount);
      rec.vezes += 1;
    } else {
      applied.set(best.rule.id, {
        id: best.rule.id,
        nome_combo: best.rule.nome_combo,
        valor_desconto: round2(best.cand.discount),
        tipo_promocao: best.rule.tipo_promocao,
        percentual:
          best.rule.tipo_promocao === "Pack"
            ? Math.min(100, Math.max(0, best.rule.valor_desconto))
            : null,
        vezes: 1,
      });
    }
  }

  return Array.from(applied.values());
}

/** Total discount from every promotion the engine applied to the cart. */
export function comboDiscountFromRules(
  items: CartItem[],
  combos: ActiveComboRule[],
): number {
  return matchedCombos(items, combos).reduce(
    (sum, c) => sum + c.valor_desconto,
    0,
  );
}
