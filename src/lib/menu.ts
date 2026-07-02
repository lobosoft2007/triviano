import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/lib/storage";

export interface PriceOption {
  tamanho: string;
  preco: number;
}

export interface Addon {
  nome: string;
  preco: number;
}

export type ComboRole = "burger" | "side" | "beverage" | "";

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  min_items: number;
  allows_half: boolean;
  combo_role: ComboRole;
  /** Tailwind text-color class applied to the category title (e.g. text-white). */
  cor_fonte: string;
  /** Tailwind font-size class applied to the category title (e.g. text-base). */
  tamanho_fonte: string;
}

export interface FreeAddon {
  nome: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  available: boolean;
  sort_order: number;
  price_options: PriceOption[];
  addons: Addon[];
  /** Traditional toppings eligible for the free allowance (e.g. Açaí). */
  free_addons: FreeAddon[];
  /** How many units of free_addons are free in total. */
  free_addon_limit: number;
  /** Price charged per unit of free_addons beyond the limit. */
  free_addon_price: number;
  /** Ingredient names the customer may opt to remove (permitir_exclusao = true). */
  removable_ingredients: string[];
  /**
   * true = prepared in-house (custo_total = sum of recipe insumos/subprodutos);
   * false = bought ready (custo_total = direct acquisition cost / price).
   */
  manipulado: boolean;
  setor_id: string | null;
  fornecedor_id: string | null;
  custo_anterior: number | null;
}




export async function fetchMenu(): Promise<{
  categories: Category[];
  products: Product[];
}> {
  const [catRes, prodRes, ingRes, poRes, addRes, freeRes] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("products")
      .select("*")
      .eq("available", true)
      .order("sort_order"),
    supabase
      .from("ingredientes_produto")
      .select("product_id, nome, permitir_exclusao, sort_order")
      .eq("permitir_exclusao", true)
      .order("sort_order"),
    supabase
      .from("produtos_price_options")
      .select("produto_id, tamanho, preco, sort_order")
      .order("sort_order"),
    supabase
      .from("produtos_addons")
      .select("produto_id, nome, preco, sort_order")
      .order("sort_order"),
    supabase
      .from("produtos_free_addons")
      .select("produto_id, nome, preco, sort_order")
      .order("sort_order"),
  ]);

  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;
  if (ingRes.error) throw ingRes.error;
  if (poRes.error) throw poRes.error;
  if (addRes.error) throw addRes.error;
  if (freeRes.error) throw freeRes.error;

  // Map product_id -> list of removable ingredient names.
  const removableMap = new Map<string, string[]>();
  for (const row of ingRes.data ?? []) {
    const list = removableMap.get(row.product_id) ?? [];
    if (row.nome && !list.includes(row.nome)) list.push(row.nome);
    removableMap.set(row.product_id, list);
  }

  // Relational price options per product.
  const priceOptionsMap = new Map<string, PriceOption[]>();
  for (const row of poRes.data ?? []) {
    const list = priceOptionsMap.get(row.produto_id) ?? [];
    list.push({ tamanho: String(row.tamanho), preco: Number(row.preco) });
    priceOptionsMap.set(row.produto_id, list);
  }

  // Relational paid add-ons per product.
  const addonsMap = new Map<string, Addon[]>();
  for (const row of addRes.data ?? []) {
    const list = addonsMap.get(row.produto_id) ?? [];
    list.push({ nome: String(row.nome), preco: Number(row.preco) });
    addonsMap.set(row.produto_id, list);
  }

  // Relational free add-ons (with their overflow price) per product.
  const freeAddonsMap = new Map<string, FreeAddon[]>();
  const freeAddonPriceMap = new Map<string, number>();
  for (const row of freeRes.data ?? []) {
    const list = freeAddonsMap.get(row.produto_id) ?? [];
    list.push({ nome: String(row.nome) });
    freeAddonsMap.set(row.produto_id, list);
    // All free-addon rows of a product share the same overflow price.
    if (!freeAddonPriceMap.has(row.produto_id)) {
      freeAddonPriceMap.set(row.produto_id, Number(row.preco));
    }
  }

  const result = {
    categories: (catRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sort_order: c.sort_order,
      min_items: (c as { min_items?: number }).min_items ?? 0,
      allows_half: (c as { allows_half?: boolean }).allows_half ?? false,
      combo_role: ((c as { combo_role?: string }).combo_role ?? "") as ComboRole,
    })) as Category[],
    products: [] as Product[],
  };

  const rawProducts = (prodRes.data ?? []).map((p) => ({
    id: p.id,
    category_id: p.category_id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    image_url: p.image_url,
    available: p.available,
    sort_order: p.sort_order,
    price_options: priceOptionsMap.get(p.id) ?? [],
    addons: addonsMap.get(p.id) ?? [],
    free_addons: freeAddonsMap.get(p.id) ?? [],
    free_addon_limit: Number((p as { free_addon_limit?: number }).free_addon_limit ?? 0),
    free_addon_price: freeAddonPriceMap.get(p.id) ?? 0,
    removable_ingredients: removableMap.get(p.id) ?? [],
    manipulado: (p as { manipulado?: boolean }).manipulado ?? true,
    setor_id: (p as { setor_id?: string | null }).setor_id ?? null,
    fornecedor_id: (p as { fornecedor_id?: string | null }).fornecedor_id ?? null,
    custo_anterior:
      (p as { custo_anterior?: number | null }).custo_anterior ?? null,
  })) as Product[];


  const urlMap = await resolveImageUrls(rawProducts.map((p) => p.image_url));
  result.products = rawProducts.map((p) => ({
    ...p,
    image_url: urlMap[p.image_url] ?? p.image_url,
  }));

  return result;
}


export const menuQueryOptions = {
  queryKey: ["menu"],
  queryFn: fetchMenu,
  staleTime: 1000 * 60 * 5,
};
