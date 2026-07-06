import { supabase } from "@/integrations/supabase/client";
import { fetchMenu } from "@/lib/menu";

/**
 * A flattened, PDV-friendly product row for the counter (Balcão) module.
 * Each product exposes its default price option so a single click / barcode
 * scan can drop it into the cart with no extra prompts.
 */
export interface BalcaoProduct {
  id: string;
  name: string;
  price: number;
  /** Default price-option label (size) used when quick-adding. */
  size: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  image_url: string;
  /** EAN / barcode (from ficha técnica dados_fiscais), when cadastrado. */
  ean: string;
  esgotado: boolean;
}

/** A category with how many available products it holds (for the PDV filter row). */
export interface BalcaoCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface BalcaoData {
  categories: BalcaoCategory[];
  products: BalcaoProduct[];
}

/**
 * Loads every available product with a resolved default price and (best-effort)
 * its EAN barcode, plus the categories that actually have products — ready for
 * the counter category filter, grid and barcode search.
 */
export async function fetchBalcaoData(): Promise<BalcaoData> {
  const { categories, products } = await fetchMenu();
  const catById = new Map(categories.map((c) => [c.id, c]));

  // Best-effort EAN lookup — never block the PDV if the read is denied.
  const eanById = new Map<string, string>();
  try {
    const { data } = await supabase
      .from("fichas_tecnicas")
      .select("product_id, dados_fiscais");
    for (const row of data ?? []) {
      const fiscais = (row.dados_fiscais ?? {}) as Record<string, unknown>;
      const ean = String(fiscais.ean ?? "").trim();
      if (ean) eanById.set(row.product_id as string, ean);
    }
  } catch {
    /* EAN is optional; name search still works. */
  }

  return products
    .map((p) => {
      const cat = catById.get(p.category_id);
      const defaultOption = p.price_options[0];
      return {
        id: p.id,
        name: p.name,
        price: defaultOption ? defaultOption.preco : p.price,
        size: defaultOption ? defaultOption.tamanho : "Padrão",
        categoryId: p.category_id,
        categoryName: cat?.name ?? "Outros",
        categorySlug: cat?.slug ?? "",
        image_url: p.image_url,
        ean: eanById.get(p.id) ?? "",
        esgotado: p.esgotado,
      } as BalcaoProduct;
    })
    .sort(
      (a, b) =>
        a.categoryName.localeCompare(b.categoryName) ||
        a.name.localeCompare(b.name),
    );
}

/** Reads the server-computed total for a freshly created order. */
export async function fetchOrderTotal(orderId: string): Promise<number> {
  const { data, error } = await supabase
    .from("orders")
    .select("total")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return Number(data.total ?? 0);
}
