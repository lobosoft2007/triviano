import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  address: string;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, address")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export interface PlaceOrderInput {
  userId: string;
  items: CartItem[];
  total: number;
  discount: number;
  deliveryAddress: string;
  phone: string;
  notes: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  // RLS guarantees user_id must equal auth.uid()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: input.userId,
      total: input.total,
      discount: input.discount,
      delivery_address: input.deliveryAddress,
      phone: input.phone,
      notes: input.notes,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const orderId = order.id as string;

  const itemsPayload = input.items.map((i) => ({
    order_id: orderId,
    product_id: i.productId,
    product_name: i.name,
    unit_price: i.unitPrice,
    quantity: i.quantity,
    size: i.size,
    addons: i.addons,
    second_flavor: i.secondFlavor,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) throw itemsError;

  return orderId;
}

export interface OrderRow {
  id: string;
  status: string;
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
    addons: { name: string; price: number }[];
    second_flavor: string;
  }[];
}

export async function fetchOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total, discount, delivery_address, created_at, order_items(id, product_name, unit_price, quantity, size, addons, second_flavor)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    status: o.status,
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
        ? ((it as { addons: { name: string; price: number }[] }).addons)
        : [],
      second_flavor: (it as { second_flavor?: string }).second_flavor ?? "",
    })),
  })) as OrderRow[];
}
