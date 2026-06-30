import { supabase } from "@/integrations/supabase/client";

export type CaixaStatus = "Aberto" | "Fechado";
export type MovimentacaoTipo = "Sangria" | "Suprimento" | "Recebimento Pedido";

/** Production conveyor (esteira) statuses for an order. */
export const ESTEIRA_STATUSES = [
  "Recebido",
  "Em preparação",
  "Aguardando entregador",
  "Em entrega",
  "Entregue",
  "Encerrado e pago",
] as const;
export type StatusPedido = (typeof ESTEIRA_STATUSES)[number] | "Cancelado";

/**
 * Terminal statuses that drop an order off the active operational board.
 * "Entregue" stays on the board so the operator can still finalize payment
 * ("Encerrado e pago"); only a closed/paid or cancelled order leaves the board.
 */
export const TERMINAL_STATUSES: StatusPedido[] = ["Encerrado e pago", "Cancelado"];

/** A dynamic, relational payment method (table `meios_pagamento`). */
export interface MeioPagamento {
  id: string;
  nome: string;
  ativo: boolean;
  exige_maquineta: boolean;
}

/** Loads payment methods (active only by default), ordered by name. */
export async function fetchMeiosPagamento(
  activeOnly = true,
): Promise<MeioPagamento[]> {
  let q = supabase
    .from("meios_pagamento")
    .select("id, nome, ativo, exige_maquineta")
    .order("nome");
  if (activeOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MeioPagamento[];
}

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
  id_meio_pagamento: string | null;
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
  user_id: string;
  status: string;
  status_pedido: StatusPedido;
  total: number;
  discount: number;
  desconto_manual: number;
  delivery_address: string;
  phone: string;
  notes: string;
  observacoes_operador: string;
  created_at: string;
  tipo_atendimento: "Delivery" | "Presencial";
  numero_mesa: number | null;
  impresso_cozinha: boolean;
  impresso_conta: boolean;
  order_items: CaixaOrderItem[];
}

export interface PagamentoPedido {
  id: string;
  id_pedido: string;
  id_meio_pagamento: string;
  meio_nome: string;
  valor_pago: number;
  created_at: string;
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
  metadados?: Record<string, number> | null;
}): Promise<Caixa> {
  const { data, error } = await supabase
    .from("fluxo_caixa")
    .insert({
      id_usuario: input.userId,
      valor_abertura: input.valorAbertura,
      metadados_abertura: input.metadados ?? null,
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
  metadados?: Record<string, number> | null;
}): Promise<void> {
  const { error } = await supabase
    .from("fluxo_caixa")
    .update({
      status: "Fechado",
      valor_fechamento: input.valorFechamento,
      metadados_fechamento: input.metadados ?? null,
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
    .select("id, id_caixa, tipo, valor, motivo, id_meio_pagamento, created_at")
    .eq("id_caixa", caixaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    ...m,
    valor: Number(m.valor),
    id_meio_pagamento:
      (m as { id_meio_pagamento?: string | null }).id_meio_pagamento ?? null,
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
      "id, user_id, status, status_pedido, total, discount, desconto_manual, delivery_address, phone, notes, observacoes_operador, created_at, tipo_atendimento, numero_mesa, impresso_cozinha, impresso_conta, order_items(id, product_id, product_name, unit_price, quantity, size, addons, second_flavor, remocoes, products(category_id))",
    )
    .not("status_pedido", "in", '("Encerrado e pago",Cancelado)')
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    user_id: (o as { user_id: string }).user_id,
    status: o.status,
    status_pedido: (o.status_pedido ?? "Recebido") as StatusPedido,
    total: Number(o.total),
    discount: Number(o.discount ?? 0),
    desconto_manual: Number(
      (o as { desconto_manual?: number }).desconto_manual ?? 0,
    ),
    delivery_address: o.delivery_address ?? "",
    phone: (o as { phone?: string }).phone ?? "",
    notes: (o as { notes?: string }).notes ?? "",
    observacoes_operador:
      (o as { observacoes_operador?: string }).observacoes_operador ?? "",
    created_at: o.created_at,
    tipo_atendimento: o.tipo_atendimento,
    numero_mesa: o.numero_mesa,
    impresso_cozinha: o.impresso_cozinha,
    impresso_conta: o.impresso_conta,
    order_items: (o.order_items ?? []).map((it) => ({
      id: it.id,
      product_id: (it as { product_id?: string | null }).product_id ?? null,
      category_id:
        (it as { products?: { category_id?: string | null } | null }).products
          ?.category_id ?? null,
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
    .update({ impresso_cozinha: true, status: "preparing", status_pedido: "Em preparação" })
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

/** Updates the production-conveyor status of an order (realtime to /caixa). */
export async function updateStatusPedido(
  orderId: string,
  status: StatusPedido,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status_pedido: status })
    .eq("id", orderId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Order editing (operator)                                            */
/* ------------------------------------------------------------------ */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Items subtotal (already includes addons baked into unit_price snapshot). */
export function itemsSubtotal(items: CaixaOrderItem[]): number {
  return items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
}

/** Final total = items subtotal - automatic discount - manual discount (>= 0). */
export function recalcOrderTotal(
  items: CaixaOrderItem[],
  discount: number,
  descontoManual: number,
): number {
  const t = itemsSubtotal(items) - (discount || 0) - (descontoManual || 0);
  return round2(Math.max(0, t));
}

export interface SaveOrderEditsInput {
  orderId: string;
  /** Final list of items (kept ones with their quantities). */
  items: { id: string; quantity: number }[];
  /** Ids of items removed from the order. */
  removedItemIds: string[];
  observacoesOperador: string;
  descontoManual: number;
  total: number;
}

export async function saveOrderEdits(
  input: SaveOrderEditsInput,
): Promise<void> {
  // Delete removed items.
  if (input.removedItemIds.length > 0) {
    const { error } = await supabase
      .from("order_items")
      .delete()
      .in("id", input.removedItemIds);
    if (error) throw error;
  }
  // Update quantities for the remaining items.
  for (const it of input.items) {
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: it.quantity })
      .eq("id", it.id);
    if (error) throw error;
  }
  // Update order meta + recalculated total.
  const { error: ordErr } = await supabase
    .from("orders")
    .update({
      observacoes_operador: input.observacoesOperador,
      desconto_manual: round2(input.descontoManual),
      total: round2(input.total),
    })
    .eq("id", input.orderId);
  if (ordErr) throw ordErr;
}

/* ------------------------------------------------------------------ */
/* Split payments                                                      */
/* ------------------------------------------------------------------ */

export async function fetchPagamentos(
  orderId: string,
): Promise<PagamentoPedido[]> {
  const { data, error } = await supabase
    .from("pagamentos_pedido")
    .select(
      "id, id_pedido, id_meio_pagamento, valor_pago, created_at, meios_pagamento(nome)",
    )
    .eq("id_pedido", orderId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    id_pedido: p.id_pedido,
    id_meio_pagamento: p.id_meio_pagamento ?? "",
    meio_nome:
      (p as { meios_pagamento?: { nome?: string } | null }).meios_pagamento
        ?.nome ?? "—",
    valor_pago: Number(p.valor_pago),
    created_at: p.created_at,
  }));
}

export async function addPagamento(input: {
  orderId: string;
  meioId: string;
  valor: number;
}): Promise<void> {
  const { error } = await supabase.from("pagamentos_pedido").insert({
    id_pedido: input.orderId,
    id_meio_pagamento: input.meioId,
    valor_pago: round2(input.valor),
  });
  if (error) throw error;
}

export async function deletePagamento(id: string): Promise<void> {
  const { error } = await supabase
    .from("pagamentos_pedido")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Finalizes & settles an order via the secure RPC: posts revenue movements to
 * the open caixa per payment method, validates fiado limit, debits cashback
 * spent, and credits 5% cashback of the total. Returns the customer's
 * resulting fiado debt balance (for the push message).
 */
export async function finalizeOrderPaid(orderId: string): Promise<number> {
  const { data, error } = await supabase.rpc("finalize_order_paid", {
    p_order_id: orderId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/* ------------------------------------------------------------------ */
/* Partial cash report (X de caixa)                                    */
/* ------------------------------------------------------------------ */

export interface CaixaPartialReport {
  valorAbertura: number;
  /** Revenue grouped by payment method (only entries with a method). */
  porMeio: { nome: string; total: number }[];
  totalEntradas: number;
  totalSangrias: number;
  totalSuprimentos: number;
  /** Total restaurant balance: opening + all entries - sangrias. */
  saldoTotal: number;
  /** Expected physical cash in drawer. */
  saldoGavetaDinheiro: number;
}

/**
 * Builds the partial ("X de caixa") financial audit for the current open
 * shift, grouping movements dynamically by payment method.
 */
export async function buildPartialReport(
  caixa: Caixa,
  movs: Movimentacao[],
): Promise<CaixaPartialReport> {
  const meios = await fetchMeiosPagamento(false);
  const nameById = new Map(meios.map((m) => [m.id, m.nome]));

  const porMeioMap = new Map<string, number>();
  let totalSangrias = 0;
  let totalSuprimentos = 0;
  let entradasComMeio = 0;
  let dinheiroEntradas = 0;

  for (const m of movs) {
    if (m.tipo === "Sangria") {
      totalSangrias += m.valor;
      continue;
    }
    if (m.tipo === "Suprimento") {
      totalSuprimentos += m.valor;
    }
    const meioId = (m as { id_meio_pagamento?: string | null })
      .id_meio_pagamento;
    if (meioId) {
      const nome = nameById.get(meioId) ?? "Outro";
      porMeioMap.set(nome, (porMeioMap.get(nome) ?? 0) + m.valor);
      entradasComMeio += m.valor;
      if (nome === "Dinheiro") dinheiroEntradas += m.valor;
    }
  }

  const porMeio = [...porMeioMap.entries()]
    .map(([nome, total]) => ({ nome, total: round2(total) }))
    .sort((a, b) => b.total - a.total);

  // Total entries = all non-sangria movements (tagged + manual suprimentos).
  const totalEntradas = round2(entradasComMeio + totalSuprimentos);
  const saldoTotal = round2(
    caixa.valor_abertura + totalEntradas - totalSangrias,
  );
  const saldoGavetaDinheiro = round2(
    caixa.valor_abertura + dinheiroEntradas + totalSuprimentos - totalSangrias,
  );

  return {
    valorAbertura: round2(caixa.valor_abertura),
    porMeio,
    totalEntradas,
    totalSangrias: round2(totalSangrias),
    totalSuprimentos: round2(totalSuprimentos),
    saldoTotal,
    saldoGavetaDinheiro,
  };
}
