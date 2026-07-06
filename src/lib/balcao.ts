import { supabase } from "@/integrations/supabase/client";
import { fetchMenu, type Category, type Product } from "@/lib/menu";

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
  /**
   * true when the product has sizes/flavors or paid/free add-ons and must open
   * the customization modal (same as the customer app) before entering the cart.
   */
  needsCustomization: boolean;
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
  /** Full menu products (keyed lookups) so the PDV can open the app modal. */
  menuProducts: Product[];
  /** Full menu categories so the PDV modal knows half-and-half / combo rules. */
  menuCategories: Category[];
}

/**
 * A product must be customized (open the modal) when it offers more than one
 * size/flavor, paid add-ons, free toppings (açaí), removable ingredients or is
 * a half-and-half category. Otherwise it is a direct-sale item (e.g. a can of
 * soda) and drops straight into the cupom.
 */
export function productNeedsCustomization(
  product: Product,
  category: Category | undefined,
): boolean {
  return (
    product.price_options.length > 1 ||
    product.addons.length > 0 ||
    product.free_addons.length > 0 ||
    product.removable_ingredients.length > 0 ||
    !!category?.allows_half
  );
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

  const mapped = products
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

  // Only surface categories that actually have available products.
  const countByCat = new Map<string, number>();
  for (const p of mapped) {
    countByCat.set(p.categoryId, (countByCat.get(p.categoryId) ?? 0) + 1);
  }
  const balcaoCategories: BalcaoCategory[] = categories
    .filter((c) => countByCat.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: countByCat.get(c.id) ?? 0,
    }));

  return { categories: balcaoCategories, products: mapped };
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
