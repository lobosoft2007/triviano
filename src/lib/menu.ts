import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/lib/storage";
import { currentHost } from "@/lib/empresa";

/**
 * Resolve o empresa_id do endereço atual (domínio próprio ou subdomínio).
 * Usa a mesma função de branding, que já cai na 1ª empresa ativa quando o host
 * não casa (preview/dev) — garantindo que o cardápio sempre fique escopado a
 * UMA empresa, nunca misturando tenants.
 */
async function resolveTenantEmpresaId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_public_branding_by_host", {
    p_host: currentHost(),
  });
  if (error) return null;
  return (data ?? [])[0]?.id ?? null;
}

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
  /** Dynamic label for the variation axis (e.g. "Escolha sabor"). */
  eixo_variacao: string;
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
  /**
   * true when a controlled ingredient (or a tracked resale item) can't cover a
   * single unit right now. Used to show an "Esgotado" state and block ordering.
   */
  esgotado: boolean;
}




/** One time-window a category is open on a given weekday (0=Sun..6=Sat). */
export interface CategoryHorario {
  categoria_id: string;
  dia_semana: number;
  hora_inicio: string; // "HH:MM:SS"
  hora_fim: string;
}

export interface NextOpening {
  dia_semana: number;
  hora_inicio: string;
  categoria_nome: string;
  quando: string; // ISO timestamp
}

export interface Menu {
  categories: Category[];
  products: Product[];
  /** All categories of the current tenant, including those closed right now. */
  allCategories: Category[];
  /** Per-category schedule rows (empty list for a category = always open). */
  horarios: CategoryHorario[];
  /** True when there isn't a single category open right now. */
  isClosed: boolean;
  /** Next opening slot in the current tenant (only set when isClosed). */
  nextOpening: NextOpening | null;
}

function currentDowAndMinutes(): { dow: number; minutes: number } {
  // Timezone alinhado ao motor SQL (America/Sao_Paulo). Usa Intl para converter
  // sem depender do fuso do dispositivo do cliente.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dow = dowMap[parts.weekday ?? "Sun"] ?? 0;
  const hh = parseInt(parts.hour ?? "0", 10);
  const mm = parseInt(parts.minute ?? "0", 10);
  return { dow, minutes: hh * 60 + (isNaN(mm) ? 0 : mm) };
}

function toMinutes(hhmmss: string): number {
  const [h = "0", m = "0"] = hhmmss.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** True when the category has no schedule OR any window contains now. */
export function isCategoriaAbertaAgora(
  categoriaId: string,
  horarios: CategoryHorario[],
): boolean {
  const rows = horarios.filter((h) => h.categoria_id === categoriaId);
  if (rows.length === 0) return true;
  const { dow, minutes } = currentDowAndMinutes();
  return rows.some(
    (r) =>
      r.dia_semana === dow &&
      toMinutes(r.hora_inicio) <= minutes &&
      toMinutes(r.hora_fim) > minutes,
  );
}

export async function fetchMenu(): Promise<Menu> {
  // Multi-tenant: descobre a empresa do endereço atual e escopa o cardápio.
  const empresaId = await resolveTenantEmpresaId();

  let catQuery = supabase.from("categories").select("*").order("sort_order");
  // Client menu reads ONLY the safe public view (no cost/stock/supplier
  // columns). The raw products table is admin-only via RLS.
  let prodQuery = supabase
    .from("view_products_public")
    .select(
      "id, category_id, name, description, price, image_url, available, sort_order, free_addon_limit, eixo_variacao, empresa_id",
    )
    .eq("available", true)
    .order("sort_order");
  if (empresaId) {
    catQuery = catQuery.eq("empresa_id", empresaId);
    prodQuery = prodQuery.eq("empresa_id", empresaId);
  }

  const horariosQuery = empresaId
    ? supabase
        .from("category_horarios" as never)
        .select("categoria_id, dia_semana, hora_inicio, hora_fim")
        .eq("empresa_id", empresaId)
    : supabase
        .from("category_horarios" as never)
        .select("categoria_id, dia_semana, hora_inicio, hora_fim");

  const [catRes, prodRes, ingRes, poRes, addRes, freeRes, availRes, horRes] =
    await Promise.all([
      catQuery,
      prodQuery,
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
      // Preventive stock signal (no cost/stock values exposed, only a flag).
      supabase.rpc("get_menu_availability"),
      horariosQuery,
    ]);

  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;
  if (ingRes.error) throw ingRes.error;
  if (poRes.error) throw poRes.error;
  if (addRes.error) throw addRes.error;
  if (freeRes.error) throw freeRes.error;
  // Availability is non-critical: if it fails, treat everything as in stock.
  const esgotadoSet = new Set<string>(
    (availRes.data ?? [])
      .filter((r) => r.esgotado)
      .map((r) => r.id),
  );

  const horarios: CategoryHorario[] = (
    (horRes.data ?? []) as unknown as CategoryHorario[]
  ).map((h) => ({
    categoria_id: h.categoria_id,
    dia_semana: Number(h.dia_semana),
    hora_inicio: String(h.hora_inicio),
    hora_fim: String(h.hora_fim),
  }));

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
    list.push({ tamanho: String(row.tamanho ?? "Padrão"), preco: Number(row.preco ?? 0) });
    priceOptionsMap.set(row.produto_id, list);
  }

  // Relational paid add-ons per product.
  const addonsMap = new Map<string, Addon[]>();
  for (const row of addRes.data ?? []) {
    const list = addonsMap.get(row.produto_id) ?? [];
    list.push({ nome: String(row.nome ?? ""), preco: Number(row.preco ?? 0) });
    addonsMap.set(row.produto_id, list);
  }

  // Relational free add-ons (with their overflow price) per product.
  const freeAddonsMap = new Map<string, FreeAddon[]>();
  const freeAddonPriceMap = new Map<string, number>();
  for (const row of freeRes.data ?? []) {
    const list = freeAddonsMap.get(row.produto_id) ?? [];
    list.push({ nome: String(row.nome) });
    freeAddonsMap.set(row.produto_id, list);
    if (!freeAddonPriceMap.has(row.produto_id)) {
      freeAddonPriceMap.set(row.produto_id, Number(row.preco ?? 0));
    }
  }

  const allCategories = (catRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sort_order: c.sort_order,
    min_items: (c as { min_items?: number }).min_items ?? 0,
    allows_half: (c as { allows_half?: boolean }).allows_half ?? false,
    combo_role: ((c as { combo_role?: string }).combo_role ?? "") as ComboRole,
    cor_fonte: (c as { cor_fonte?: string }).cor_fonte ?? "text-white",
    tamanho_fonte:
      (c as { tamanho_fonte?: string }).tamanho_fonte ?? "text-base",
  })) as Category[];

  // Filtra categorias fechadas neste instante (sem horário = sempre aberta).
  const openCategories = allCategories.filter((c) =>
    isCategoriaAbertaAgora(c.id, horarios),
  );

  const rawProducts = (prodRes.data ?? []).map((p) => {
    const pid = p.id ?? "";
    return {
      id: pid,
      category_id: p.category_id ?? "",
      name: p.name ?? "",
      description: p.description ?? "",
      price: Number(p.price ?? 0),
      image_url: p.image_url ?? "",
      available: p.available ?? true,
      sort_order: p.sort_order ?? 0,
      eixo_variacao:
        (p as { eixo_variacao?: string | null }).eixo_variacao ?? "Tamanho",
      price_options: priceOptionsMap.get(pid) ?? [],
      addons: addonsMap.get(pid) ?? [],
      free_addons: freeAddonsMap.get(pid) ?? [],
      free_addon_limit: Number(p.free_addon_limit ?? 0),
      free_addon_price: freeAddonPriceMap.get(pid) ?? 0,
      removable_ingredients: removableMap.get(pid) ?? [],
      manipulado: true,
      setor_id: null,
      fornecedor_id: null,
      custo_anterior: null,
      esgotado: esgotadoSet.has(pid),
    };
  }) as Product[];

  const urlMap = await resolveImageUrls(rawProducts.map((p) => p.image_url));
  const products = rawProducts.map((p) => ({
    ...p,
    image_url: urlMap[p.image_url] ?? p.image_url,
  }));

  const openIds = new Set(openCategories.map((c) => c.id));
  const openProducts = products.filter((p) => openIds.has(p.category_id));

  const isClosed = openCategories.length === 0 && allCategories.length > 0;
  let nextOpening: NextOpening | null = null;
  if (isClosed && empresaId) {
    const { data: nextRows } = await supabase.rpc("get_next_opening" as never, {
      p_empresa_id: empresaId,
    } as never);
    const row = ((nextRows ?? []) as unknown as NextOpening[])[0];
    nextOpening = row ?? null;
  }

  return {
    categories: openCategories,
    products: openProducts,
    allCategories,
    horarios,
    isClosed,
    nextOpening,
  };
}

/**
 * Fresh snapshot of out-of-stock product ids. Used at checkout to catch the
 * race where an item sells out between browsing and confirming the order.
 * Best-effort: on failure returns an empty set (never blocks checkout).
 */
export async function fetchEsgotadoIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_menu_availability");
  if (error) return new Set<string>();
  return new Set(
    (data ?? []).filter((r) => r.esgotado).map((r) => r.id),
  );
}

export const menuQueryOptions = {
  queryKey: ["menu"],
  queryFn: fetchMenu,
  staleTime: 1000 * 60 * 5,
};

