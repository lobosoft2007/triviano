import { supabase } from "@/integrations/supabase/client";
import type { CartItem, NewCartItem, CartAddon, CartComboRole } from "@/lib/cart";
import type { Json } from "@/integrations/supabase/types";
import { currentHost } from "@/lib/empresa";
import { resolveImageUrls } from "@/lib/storage";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  saldo_cashback: number;
  /** Whether this customer is allowed to charge orders to their store account. */
  fiado_autorizado: boolean;
  /** Credit ceiling for the store account (conta corrente). */
  limite_fiado: number;
  /** Current outstanding debt on the store account. */
  saldo_devedor_fiado: number;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, phone, address, saldo_cashback, fiado_autorizado, limite_fiado, saldo_devedor_fiado",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    saldo_cashback?: number;
    fiado_autorizado?: boolean;
    limite_fiado?: number;
    saldo_devedor_fiado?: number;
  };
  return {
    id: data.id,
    full_name: data.full_name ?? "",
    phone: data.phone ?? "",
    address: data.address ?? "",
    saldo_cashback: Number(row.saldo_cashback ?? 0),
    fiado_autorizado: !!row.fiado_autorizado,
    limite_fiado: Number(row.limite_fiado ?? 0),
    saldo_devedor_fiado: Number(row.saldo_devedor_fiado ?? 0),
  };
}

export interface PlaceOrderInput {
  userId: string;
  items: CartItem[];
  /**
   * @deprecated Kept for call-site compatibility. The order total is
   * recomputed server-side and this value is ignored.
   */
  total?: number;
  /**
   * @deprecated Kept for call-site compatibility. The discount is recomputed
   * server-side from the active combo rules and this value is ignored.
   */
  discount?: number;
  deliveryAddress: string;
  phone: string;
  notes: string;
  tipoAtendimento: "Delivery" | "Presencial";
  numeroMesa: number | null;
  /** Cashback the customer chose to redeem on this order. */
  cashbackUsed?: number;
  /**
   * When true, the customer chose an ONLINE payment (PIX/card via Mercado
   * Pago). The order is created hidden from the Caixa/KDS
   * (aguardando_pagamento = true) and only surfaces after the webhook
   * confirms payment. Never set this for cash/maquininha-on-delivery orders.
   */
  pagamentoOnline?: boolean;
}


export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  // The order total, per-item unit prices, combo discount and cashback
  // redemption are all computed and validated server-side inside the
  // `create_order` SECURITY DEFINER function. The client can no longer set
  // the price it pays — it only describes WHAT it is ordering.
  const itemsPayload = input.items.map((i) => ({
    product_id: i.productId,
    size: i.size,
    second_flavor: i.secondFlavor,
    addons: i.addons,
    remocoes: i.remocoes,
    quantity: i.quantity,
  }));

  const { data, error } = await supabase.rpc("create_order", {
    p_items: itemsPayload as unknown as Json,
    p_delivery_address: input.deliveryAddress,
    p_phone: input.phone,
    p_notes: input.notes,
    p_tipo_atendimento: input.tipoAtendimento,
    p_numero_mesa: (input.tipoAtendimento === "Presencial"
      ? input.numeroMesa
      : null) as unknown as number,
    p_cashback_used: input.cashbackUsed ?? 0,
    // Tenant do ambiente atual (host). O backend usa isto para marcar o pedido
    // com a empresa correta, isolando staging (Pizzaria Teste) de produção.
    p_host: currentHost(),
    // Pagamento online (PIX/cartão MP): nasce oculto do Caixa/KDS até o
    // webhook confirmar o pagamento (blindagem financeira da cozinha).
    p_pagamento_online: input.pagamentoOnline ?? false,
  });


  if (error) throw error;
  return data as string;
}

/**
 * Descarta qualquer rascunho de pedido ONLINE do próprio cliente que ainda
 * não foi pago (aguardando_pagamento = true e pago_online = false), antes de
 * registrar um novo pedido. Isto impede que idas e voltas entre carrinho e
 * checkout PIX acumulem "pedidos-fantasma" no banco — e nunca toca em pedidos
 * já pagos ou em pedidos presenciais já enviados à cozinha. Best-effort: se
 * falhar, não bloqueia o checkout.
 */
export async function discardUnpaidDrafts(): Promise<number> {
  const { data, error } = await supabase.rpc("discard_unpaid_drafts", {
    p_host: currentHost(),
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export interface OrderRow {
  id: string;
  status: string;
  /** Status da esteira (Recebido/Finalizado/Cancelado/...). Gate do "Repetir pedido". */
  status_pedido: string;
  total: number;
  discount: number;
  delivery_address: string;
  created_at: string;
  order_items: {
    id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    size: string;
    addons: { name: string; price: number; quantity?: number }[];
    second_flavor: string;
    remocoes: string[];
  }[];
}

export async function fetchOrders(empresaId?: string): Promise<OrderRow[]> {
  // Isolamento de histórico: mesmo um admin logado no PWA só vê os pedidos
  // feitos pelo seu próprio user_id nesta tela de "Meus pedidos". A policy
  // "Admins can view all orders" liberaria todos os pedidos da empresa, então
  // filtramos explicitamente pelo usuário atual aqui.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  let query = supabase
    .from("orders")
    .select(
      "id, status, status_pedido, total, discount, delivery_address, created_at, order_items(id, product_name, unit_price, quantity, size, addons, second_flavor, remocoes)",
    )
    .eq("user_id", userId)
    // Rascunhos de pagamento e pagamentos abandonados são totalmente
    // invisíveis para o cliente — só existem para relatórios de desistência.
    .not("status", "in", "(rascunho_pagamento,pagamento_abandonado)")
    .order("created_at", { ascending: false });
  // Isolamento por ambiente: mostra apenas os pedidos do tenant do host atual.
  // Em produção resolve para o restaurante real; no staging (Pizzaria Teste)
  // esconde os pedidos de produção e vice-versa.
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    status_pedido: (o as { status_pedido?: string }).status_pedido ?? "",
    total: Number(o.total),
    discount: Number((o as { discount?: number }).discount ?? 0),
    delivery_address: o.delivery_address,
    created_at: o.created_at,
    order_items: (o.order_items ?? []).map((it) => ({
      id: it.id,
      product_name: it.product_name,
      unit_price: Number(it.unit_price),
      quantity: it.quantity,
      size: (it as { size?: string }).size ?? "",
      addons: Array.isArray((it as { addons?: unknown }).addons)
        ? ((it as unknown as {
            addons: { name: string; price: number; quantity?: number }[];
          }).addons)
        : [],
      second_flavor: (it as { second_flavor?: string }).second_flavor ?? "",
      remocoes: Array.isArray((it as { remocoes?: unknown }).remocoes)
        ? ((it as unknown as { remocoes: string[] }).remocoes)
        : [],
    })),
  })) as OrderRow[];
}

/**
 * Status de pedido que podem ser repetidos ("Repetir pedido"). Rascunhos e
 * pagamentos abandonados NUNCA são repetíveis — e a própria RPC `repeat_order`
 * revalida isso no backend. Esta lista só controla a exibição do botão.
 */
export const REORDERABLE_STATUSES = new Set<string>([
  "pending",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
  "canceled",
]);

export function isReorderable(status: string): boolean {
  return REORDERABLE_STATUSES.has(status);
}

interface RepeatOrderItemRaw {
  product_id: string;
  product_name: string;
  display_name: string;
  category_slug: string;
  combo_role: string;
  size: string;
  second_flavor: string;
  addons: { name: string; price: number; quantity?: number }[];
  remocoes: string[];
  unit_price: number;
  image_url: string;
  quantity: number;
}

interface RepeatOrderResponse {
  eligible: boolean;
  total_items: number;
  available_items: number;
  skipped_items: number;
  items: RepeatOrderItemRaw[];
}

export interface RepeatOrderResult {
  eligible: boolean;
  totalItems: number;
  availableItems: number;
  skippedItems: number;
  /** Linhas prontas para irem ao carrinho (imagens já resolvidas). */
  lines: { line: NewCartItem; quantity: number }[];
}

/**
 * Repete um pedido anterior: a RPC `repeat_order` (backend) valida quais itens
 * ainda existem no cardápio e recalcula os preços ATUAIS reutilizando a mesma
 * lógica do `create_order`. Aqui apenas resolvemos as imagens e montamos as
 * linhas do carrinho — NÃO cria pedido nem vai ao checkout.
 */
export async function repeatOrder(orderId: string): Promise<RepeatOrderResult> {
  const { data, error } = await supabase.rpc("repeat_order", {
    p_order_id: orderId,
    p_host: currentHost(),
  });
  if (error) throw error;

  const resp = (data ?? {}) as unknown as RepeatOrderResponse;
  const rawItems = Array.isArray(resp.items) ? resp.items : [];

  // Resolve os caminhos de imagem do Storage em URLs assinadas (mesmo padrão
  // do cardápio), para o carrinho exibir a foto corretamente.
  const urlMap = await resolveImageUrls(rawItems.map((i) => i.image_url));

  const lines = rawItems.map((i) => {
    const comboRole = (["burger", "side", "beverage"].includes(i.combo_role)
      ? i.combo_role
      : "") as CartComboRole;
    const addons: CartAddon[] = (i.addons ?? []).map((a) => ({
      name: a.name,
      price: Number(a.price ?? 0),
      quantity: Math.max(1, Math.floor(Number(a.quantity ?? 1))),
    }));
    const line: NewCartItem = {
      productId: i.product_id,
      productName: i.product_name,
      categorySlug: i.category_slug ?? "",
      comboRole,
      name: i.display_name || i.product_name,
      size: i.size ?? "",
      addons,
      secondFlavor: i.second_flavor ?? "",
      remocoes: Array.isArray(i.remocoes) ? i.remocoes : [],
      unitPrice: Number(i.unit_price ?? 0),
      image_url: urlMap[i.image_url] ?? i.image_url ?? "",
    };
    return { line, quantity: Math.max(1, Math.floor(Number(i.quantity ?? 1))) };
  });

  return {
    eligible: !!resp.eligible,
    totalItems: Number(resp.total_items ?? 0),
    availableItems: Number(resp.available_items ?? 0),
    skippedItems: Number(resp.skipped_items ?? 0),
    lines,
  };
}
