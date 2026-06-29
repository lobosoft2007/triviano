import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
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
    categories: (catRes.data ?? []) as Category[],
    products: (prodRes.data ?? []).map((p) => ({
      ...p,
      price: Number(p.price),
    })) as Product[],
  };
}

export const menuQueryOptions = {
  queryKey: ["menu"],
  queryFn: fetchMenu,
  staleTime: 1000 * 60 * 5,
};
