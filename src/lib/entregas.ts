import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Entregadores                                                        */
/* ------------------------------------------------------------------ */

export interface Entregador {
  id: string;
  empresa_id: string;
  user_id: string | null;
  nome: string;
  telefone: string;
  cpf: string;
  placa_veiculo: string;
  tipo_veiculo: string;
  ativo: boolean;
  comissao_percentual: number;
  comissao_fixa_por_entrega: number;
}

export async function listEntregadores(): Promise<Entregador[]> {
  const { data, error } = await supabase
    .from("entregadores")
    .select(
      "id, empresa_id, user_id, nome, telefone, cpf, placa_veiculo, tipo_veiculo, ativo, comissao_percentual, comissao_fixa_por_entrega",
    )
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    empresa_id: r.empresa_id,
    user_id: r.user_id ?? null,
    nome: r.nome,
    telefone: r.telefone ?? "",
    cpf: r.cpf ?? "",
    placa_veiculo: r.placa_veiculo ?? "",
    tipo_veiculo: r.tipo_veiculo ?? "moto",
    ativo: r.ativo,
    comissao_percentual: Number(r.comissao_percentual ?? 0),
    comissao_fixa_por_entrega: Number(r.comissao_fixa_por_entrega ?? 0),
  }));
}

export async function saveEntregador(input: {
  id?: string | null;
  empresa_id: string;
  nome: string;
  telefone: string;
  cpf: string;
  placa_veiculo: string;
  tipo_veiculo: string;
  ativo: boolean;
  comissao_percentual: number;
  comissao_fixa_por_entrega: number;
}): Promise<void> {
  const payload = {
    empresa_id: input.empresa_id,
    nome: input.nome.trim(),
    telefone: input.telefone.trim() || null,
    cpf: input.cpf.trim() || null,
    placa_veiculo: input.placa_veiculo.trim() || null,
    tipo_veiculo: input.tipo_veiculo,
    ativo: input.ativo,
    comissao_percentual: input.comissao_percentual,
    comissao_fixa_por_entrega: input.comissao_fixa_por_entrega,
  };
  if (input.id) {
    const { error } = await supabase
      .from("entregadores")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("entregadores").insert(payload);
    if (error) throw error;
  }
}

export async function deleteEntregador(id: string): Promise<void> {
  const { error } = await supabase.from("entregadores").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Entregas                                                            */
/* ------------------------------------------------------------------ */

export type EntregaStatus =
  | "PENDENTE"
  | "ATRIBUIDA"
  | "EM_ROTA"
  | "ENTREGUE"
  | "DEVOLVIDA";

export interface Entrega {
  id: string;
  order_id: string;
  entregador_id: string | null;
  entregador_nome: string | null;
  canal: string;
  status: EntregaStatus;
  saiu_para_entrega_em: string | null;
  entregue_em: string | null;
  taxa_entrega: number;
  valor_comissao: number;
  observacao: string;
  // Order-side fields shown on the card
  pedido_total: number;
  pedido_endereco: string;
  pedido_telefone: string;
  pedido_cliente: string;
  pedido_created_at: string;
  pedido_status: string;
  pedido_canal: string;
}

/**
 * Carrega entregas ativas (não entregues) + últimas 20 entregues do dia.
 * Combina rows das duas tabelas para o Kanban do Caixa.
 */
export async function listEntregasKanban(): Promise<Entrega[]> {
  const { data, error } = await supabase
    .from("entregas")
    .select(
      "id, order_id, entregador_id, canal, status, saiu_para_entrega_em, entregue_em, taxa_entrega, valor_comissao, observacao, created_at, entregadores(nome), orders(id, total, delivery_address, phone, created_at, status_pedido, canal_venda, profiles(full_name))",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const o = (r.orders ?? {}) as Record<string, unknown>;
    const profiles = (o.profiles ?? null) as { full_name?: string } | null;
    const ent = (r.entregadores ?? null) as { nome?: string } | null;
    return {
      id: r.id,
      order_id: r.order_id,
      entregador_id: r.entregador_id ?? null,
      entregador_nome: ent?.nome ?? null,
      canal: r.canal,
      status: r.status as EntregaStatus,
      saiu_para_entrega_em: r.saiu_para_entrega_em ?? null,
      entregue_em: r.entregue_em ?? null,
      taxa_entrega: Number(r.taxa_entrega ?? 0),
      valor_comissao: Number(r.valor_comissao ?? 0),
      observacao: r.observacao ?? "",
      pedido_total: Number(o.total ?? 0),
      pedido_endereco: String(o.delivery_address ?? ""),
      pedido_telefone: String(o.phone ?? ""),
      pedido_cliente: profiles?.full_name ?? "Consumidor",
      pedido_created_at: String(o.created_at ?? r.created_at ?? ""),
      pedido_status: String(o.status_pedido ?? ""),
      pedido_canal: String(o.canal_venda ?? "PWA"),
    } satisfies Entrega;
  });
}

export async function atribuirEntregador(
  entregaId: string,
  entregadorId: string,
): Promise<void> {
  const { error } = await supabase
    .from("entregas")
    .update({ entregador_id: entregadorId, status: "ATRIBUIDA" })
    .eq("id", entregaId);
  if (error) throw error;
}

export async function marcarEmRota(
  entregaId: string,
  entregadorId: string,
): Promise<void> {
  const { error } = await supabase
    .from("entregas")
    .update({
      entregador_id: entregadorId,
      status: "EM_ROTA",
      saiu_para_entrega_em: new Date().toISOString(),
    })
    .eq("id", entregaId);
  if (error) throw error;
}

export async function marcarEntregue(entregaId: string): Promise<void> {
  const { error } = await supabase
    .from("entregas")
    .update({
      status: "ENTREGUE",
      entregue_em: new Date().toISOString(),
    })
    .eq("id", entregaId);
  if (error) throw error;
}
