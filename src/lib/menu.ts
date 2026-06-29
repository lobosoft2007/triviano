import { supabase } from "@/integrations/supabase/client";

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
}

function normOptions(value: unknown): PriceOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((o) => ({
      tamanho: String((o as PriceOption).tamanho ?? ""),
      preco: Number((o as PriceOption).preco ?? 0),
    }))
    .filter((o) => o.tamanho);
}

function normAddons(value: unknown): Addon[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a) => ({
      nome: String((a as Addon).nome ?? ""),
      preco: Number((a as Addon).preco ?? 0),
    }))
    .filter((a) => a.nome);
}

export async function fetchMenu(): Promise<{
  categories: Category[];
  products: Product[];
}> {
  const [catRes, prodRes] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("products")
      .select("*")
      .eq("available", true)
      .order("sort_order"),
  ]);

  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;

  return {
    categories: (catRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sort_order: c.sort_order,
      min_items: (c as { min_items?: number }).min_items ?? 0,
      allows_half: (c as { allows_half?: boolean }).allows_half ?? false,
      combo_role: ((c as { combo_role?: string }).combo_role ?? "") as ComboRole,
    })) as Category[],
    products: (prodRes.data ?? []).map((p) => ({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      image_url: p.image_url,
      available: p.available,
      sort_order: p.sort_order,
      price_options: normOptions((p as { price_options?: unknown }).price_options),
      addons: normAddons((p as { addons?: unknown }).addons),
    })) as Product[],
  };
}

export const menuQueryOptions = {
  queryKey: ["menu"],
  queryFn: fetchMenu,
  staleTime: 1000 * 60 * 5,
};
