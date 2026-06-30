import { supabase } from "@/integrations/supabase/client";

/**
 * Product cost (custo_total) calculation.
 *
 * Business rule:
 * - manipulado = true  → prepared in-house. custo_total is the sum of every
 *   item in its ficha técnica: direct insumos plus the unit cost of each
 *   subproduto (a subproduto's cost is its composição divided by its yield).
 * - manipulado = false → bought ready-to-sell. custo_total is the direct
 *   acquisition cost (custo_aquisicao, falling back to the sale price).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CostInputs {
  manipulado: boolean;
  /** Direct acquisition cost when not prepared in-house. */
  custoAquisicao: number;
  /** Insumo unit costs keyed by insumo id. */
  insumoCusto: Map<string, number>;
  /** Subproduto yield (rendimento_porcoes) keyed by subproduto id. */
  subprodutoRendimento: Map<string, number>;
  /** Subproduto composition: subproduto_id -> [{ insumo_id, quantidade }]. */
  composicao: Map<string, { insumo_id: string; quantidade: number }[]>;
  /** Recipe lines: { insumo_id?, subproduto_id?, quantidade }. */
  ficha: { insumo_id: string | null; subproduto_id: string | null; quantidade: number }[];
}

/** Unit cost of a subproduto = sum(insumo cost) / yield. */
export function subprodutoUnitCost(
  subprodutoId: string,
  inputs: Pick<CostInputs, "insumoCusto" | "subprodutoRendimento" | "composicao">,
): number {
  const parts = inputs.composicao.get(subprodutoId) ?? [];
  const total = parts.reduce(
    (sum, c) => sum + c.quantidade * (inputs.insumoCusto.get(c.insumo_id) ?? 0),
    0,
  );
  const yield_ = inputs.subprodutoRendimento.get(subprodutoId) || 1;
  return total / yield_;
}

/** Pure cost computation given all the resolved inputs. */
export function computeCustoTotal(inputs: CostInputs): number {
  if (!inputs.manipulado) return round2(inputs.custoAquisicao);

  const total = inputs.ficha.reduce((sum, line) => {
    if (line.insumo_id) {
      return sum + line.quantidade * (inputs.insumoCusto.get(line.insumo_id) ?? 0);
    }
    if (line.subproduto_id) {
      return sum + line.quantidade * subprodutoUnitCost(line.subproduto_id, inputs);
    }
    return sum;
  }, 0);

  return round2(total);
}

/**
 * Resolve the custo_total of a single product directly from the database.
 * Admin-only: relies on read access to insumos / subprodutos.
 */
export async function fetchProductCustoTotal(
  productId: string,
): Promise<number> {
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("price, manipulado")
    .eq("id", productId)
    .single();
  if (prodErr) throw prodErr;

  const manipulado = (product as { manipulado?: boolean }).manipulado ?? true;
  const custoAquisicao = Number(product.price);

  if (!manipulado) return round2(custoAquisicao);

  const [fichaRes, insumoRes, subRes, compRes] = await Promise.all([
    supabase
      .from("ingredientes_produto")
      .select("insumo_id, subproduto_id, quantidade")
      .eq("product_id", productId),
    supabase.from("insumos").select("id, custo_unitario"),
    supabase.from("subprodutos").select("id, rendimento_porcoes"),
    supabase.from("composicao_subproduto").select("subproduto_id, insumo_id, quantidade"),
  ]);
  if (fichaRes.error) throw fichaRes.error;
  if (insumoRes.error) throw insumoRes.error;
  if (subRes.error) throw subRes.error;
  if (compRes.error) throw compRes.error;

  const insumoCusto = new Map<string, number>(
    (insumoRes.data ?? []).map((i) => [i.id, Number(i.custo_unitario)]),
  );
  const subprodutoRendimento = new Map<string, number>(
    (subRes.data ?? []).map((s) => [s.id, Number(s.rendimento_porcoes)]),
  );
  const composicao = new Map<string, { insumo_id: string; quantidade: number }[]>();
  for (const c of compRes.data ?? []) {
    const list = composicao.get(c.subproduto_id) ?? [];
    list.push({ insumo_id: c.insumo_id, quantidade: Number(c.quantidade) });
    composicao.set(c.subproduto_id, list);
  }

  return computeCustoTotal({
    manipulado,
    custoAquisicao,
    insumoCusto,
    subprodutoRendimento,
    composicao,
    ficha: (fichaRes.data ?? []).map((f) => ({
      insumo_id: f.insumo_id,
      subproduto_id: f.subproduto_id,
      quantidade: Number(f.quantidade),
    })),
  });
}
