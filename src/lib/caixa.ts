import { supabase } from "@/integrations/supabase/client";

export type CaixaStatus = "Aberto" | "Fechado";
export type MovimentacaoTipo = "Sangria" | "Suprimento" | "Recebimento Pedido";

export interface Caixa {
  id: string;
  id_usuario: string;
  data_hora_abertura: string;
  data_hora_fechamento: string | null;
  valor_abertura: number;
  valor_fechamento: number | null;
  status: CaixaStatus;
}

export interface Movimentacao {
  id: string;
  id_caixa: string;
  tipo: MovimentacaoTipo;
  valor: number;
  motivo: string;
  created_at: string;
}

export interface CaixaOrderItem {
  id: string;
  product_id: string | null;
  category_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  size: string;
  addons: { name: string; price: number; quantity?: number }[];
  second_flavor: string;
  remocoes: string[];
}

export interface CaixaOrder {
  id: string;
  status: string;
  total: number;
  discount: number;
  delivery_address: string;
  phone: string;
  notes: string;
  created_at: string;
  tipo_atendimento: "Delivery" | "Presencial";
  numero_mesa: number | null;
  impresso_cozinha: boolean;
  impresso_conta: boolean;
  order_items: CaixaOrderItem[];
}

/** Returns the currently open cash register (if any). */
export async function fetchOpenCaixa(): Promise<Caixa | null> {
  const { data, error } = await supabase
    .from("fluxo_caixa")
    .select(
      "id, id_usuario, data_hora_abertura, data_hora_fechamento, valor_abertura, valor_fechamento, status",
    )
    .eq("status", "Aberto")
    .order("data_hora_abertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    valor_abertura: Number(data.valor_abertura),
    valor_fechamento:
      data.valor_fechamento === null ? null : Number(data.valor_fechamento),
  } as Caixa;
}

export async function openCaixa(input: {
  userId: string;
  valorAbertura: number;
}): Promise<Caixa> {
  const { data, error } = await supabase
    .from("fluxo_caixa")
    .insert({
      id_usuario: input.userId,
      valor_abertura: input.valorAbertura,
      status: "Aberto",
    })
    .select(
      "id, id_usuario, data_hora_abertura, data_hora_fechamento, valor_abertura, valor_fechamento, status",
    )
    .single();
  if (error) throw error;
  return { ...data, valor_abertura: Number(data.valor_abertura) } as Caixa;
}

export async function closeCaixa(input: {
  id: string;
  valorFechamento: number;
}): Promise<void> {
  const { error } = await supabase
    .from("fluxo_caixa")
    .update({
      status: "Fechado",
      valor_fechamento: input.valorFechamento,
      data_hora_fechamento: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchMovimentacoes(
  caixaId: string,
): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from("movimentacoes_caixa")
    .select("id, id_caixa, tipo, valor, motivo, created_at")
    .eq("id_caixa", caixaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    ...m,
    valor: Number(m.valor),
  })) as Movimentacao[];
}

export async function addMovimentacao(input: {
  caixaId: string;
  tipo: MovimentacaoTipo;
  valor: number;
  motivo: string;
}): Promise<void> {
  const { error } = await supabase.from("movimentacoes_caixa").insert({
    id_caixa: input.caixaId,
    tipo: input.tipo,
    valor: input.valor,
    motivo: input.motivo,
  });
  if (error) throw error;
}

/** Net balance: opening + suprimentos + recebimentos - sangrias. */
export function saldoAtual(caixa: Caixa, movs: Movimentacao[]): number {
  return movs.reduce((acc, m) => {
    if (m.tipo === "Sangria") return acc - m.valor;
    return acc + m.valor;
  }, caixa.valor_abertura);
}

export async function fetchCaixaOrders(): Promise<CaixaOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total, discount, delivery_address, phone, notes, created_at, tipo_atendimento, numero_mesa, impresso_cozinha, impresso_conta, order_items(id, product_id, product_name, unit_price, quantity, size, addons, second_flavor, remocoes, products(category_id))",
    )
    .neq("status", "delivered")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    total: Number(o.total),
    discount: Number(o.discount ?? 0),
    delivery_address: o.delivery_address ?? "",
    phone: (o as { phone?: string }).phone ?? "",
    notes: (o as { notes?: string }).notes ?? "",
    created_at: o.created_at,
    tipo_atendimento: o.tipo_atendimento,
    numero_mesa: o.numero_mesa,
    impresso_cozinha: o.impresso_cozinha,
    impresso_conta: o.impresso_conta,
    order_items: (o.order_items ?? []).map((it) => ({
      id: it.id,
      product_name: it.product_name,
      unit_price: Number(it.unit_price),
      quantity: it.quantity,
      size: it.size ?? "",
      addons: Array.isArray(it.addons)
        ? (it.addons as { name: string; price: number; quantity?: number }[])
        : [],
      second_flavor: it.second_flavor ?? "",
      remocoes: Array.isArray(it.remocoes) ? (it.remocoes as string[]) : [],
    })),
  })) as CaixaOrder[];
}

export async function markPrintedCozinha(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ impresso_cozinha: true, status: "preparing" })
    .eq("id", orderId);
  if (error) throw error;
}

export async function markPrintedConta(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ impresso_conta: true })
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}
