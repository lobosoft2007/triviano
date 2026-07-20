import { supabase } from "@/integrations/supabase/client";
import { currentHost } from "@/lib/empresa";

export type ReservaStatus =
  | "confirmada"
  | "aguardando_pagamento"
  | "cancelada"
  | "no_show"
  | "atendida";

export type FilaStatus = "aguardando" | "avisado" | "sentado" | "desistiu";

export interface MesaFisica {
  id: string;
  numero: number;
  capacidade: number;
  zona: string;
  ativa: boolean;
}

export interface ConfigSlot {
  id: string;
  dia_semana: number;
  hora: string;
  assentos: number;
}

export interface Reserva {
  id: string;
  nome: string;
  telefone: string;
  data: string;
  hora: string;
  pessoas: number;
  observacoes: string;
  status: ReservaStatus;
  numero_mesa: number | null;
  sinal_valor: number;
}

export interface FilaItem {
  id: string;
  nome: string;
  telefone: string;
  pessoas: number;
  status: FilaStatus;
  posicao: number;
  avisado_em: string | null;
  numero_mesa: number | null;
}

/* ------------------------------------------------------------------ */
/* Mesas físicas                                                       */
/* ------------------------------------------------------------------ */

export async function listMesasFisicas(): Promise<MesaFisica[]> {
  const { data, error } = await supabase
    .from("mesas_fisicas")
    .select("id, numero, capacidade, zona, ativa")
    .order("numero");
  if (error) throw error;
  return (data ?? []) as MesaFisica[];
}

export async function upsertMesaFisica(m: Omit<MesaFisica, "id"> & { id?: string }) {
  const payload = {
    numero: m.numero,
    capacidade: m.capacidade,
    zona: m.zona ?? "",
    ativa: m.ativa,
  };
  if (m.id) {
    const { error } = await supabase.from("mesas_fisicas").update(payload).eq("id", m.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("mesas_fisicas").insert(payload);
    if (error) throw error;
  }
}

export async function deleteMesaFisica(id: string) {
  const { error } = await supabase.from("mesas_fisicas").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Slots de capacidade                                                 */
/* ------------------------------------------------------------------ */

export async function listSlots(): Promise<ConfigSlot[]> {
  const { data, error } = await supabase
    .from("config_reservas_slot")
    .select("id, dia_semana, hora, assentos")
    .order("dia_semana")
    .order("hora");
  if (error) throw error;
  return (data ?? []) as ConfigSlot[];
}

export async function upsertSlot(dia_semana: number, hora: string, assentos: number) {
  if (assentos <= 0) {
    const { error } = await supabase
      .from("config_reservas_slot")
      .delete()
      .eq("dia_semana", dia_semana)
      .eq("hora", hora);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("config_reservas_slot")
    .upsert(
      { dia_semana, hora, assentos },
      { onConflict: "empresa_id,dia_semana,hora" },
    );
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Configuração da empresa (reserva)                                   */
/* ------------------------------------------------------------------ */

export interface ReservaConfig {
  reserva_ativa: boolean;
  reserva_duracao_min: number;
  reserva_antecedencia_min_horas: number;
  reserva_antecedencia_max_dias: number;
  reserva_tolerancia_min: number;
  reserva_grupo_min: number;
  reserva_grupo_max: number;
  reserva_sinal_ativo: boolean;
  reserva_sinal_por_pessoa: number;
  pedido_na_mesa_pelo_cliente: boolean;
}

export async function fetchReservaConfig(empresaId: string): Promise<ReservaConfig> {
  const { data, error } = await supabase
    .from("empresas")
    .select(
      "reserva_ativa, reserva_duracao_min, reserva_antecedencia_min_horas, reserva_antecedencia_max_dias, reserva_tolerancia_min, reserva_grupo_min, reserva_grupo_max, reserva_sinal_ativo, reserva_sinal_por_pessoa, pedido_na_mesa_pelo_cliente",
    )
    .eq("id", empresaId)
    .maybeSingle();
  if (error) throw error;
  return data as ReservaConfig;
}

export async function updateReservaConfig(
  empresaId: string,
  patch: Partial<ReservaConfig>,
): Promise<void> {
  const { error } = await supabase.from("empresas").update(patch).eq("id", empresaId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Reservas / Disponibilidade                                          */
/* ------------------------------------------------------------------ */

export interface DisponibilidadeSlot {
  hora: string;
  disponivel: boolean;
  vagas: number;
}

export async function reservaDisponibilidade(
  data: string,
  pessoas: number,
): Promise<DisponibilidadeSlot[]> {
  const { data: rows, error } = await supabase.rpc("reserva_disponibilidade", {
    p_host: currentHost(),
    p_data: data,
    p_pessoas: pessoas,
  });
  if (error) throw error;
  return (rows ?? []) as DisponibilidadeSlot[];
}

export async function criarReserva(input: {
  data: string;
  hora: string;
  pessoas: number;
  nome: string;
  telefone: string;
  observacoes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("criar_reserva", {
    p_host: currentHost(),
    p_data: input.data,
    p_hora: input.hora,
    p_pessoas: input.pessoas,
    p_nome: input.nome,
    p_telefone: input.telefone,
    p_observacoes: input.observacoes ?? "",
  });
  if (error) throw error;
  return data as string;
}

export async function cancelarReserva(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_reserva", { p_reserva_id: id });
  if (error) throw error;
}

export async function darEntradaReserva(id: string, numero_mesa: number): Promise<void> {
  const { error } = await supabase.rpc("dar_entrada_reserva", {
    p_reserva_id: id,
    p_numero_mesa: numero_mesa,
  });
  if (error) throw error;
}

export async function listReservasDoDia(data: string): Promise<Reserva[]> {
  const { data: rows, error } = await supabase
    .from("reservas")
    .select(
      "id, nome, telefone, data, hora, pessoas, observacoes, status, numero_mesa, sinal_valor",
    )
    .eq("data", data)
    .order("hora");
  if (error) throw error;
  return (rows ?? []) as Reserva[];
}

/* ------------------------------------------------------------------ */
/* Fila de espera                                                      */
/* ------------------------------------------------------------------ */

export async function listFila(): Promise<FilaItem[]> {
  const { data, error } = await supabase
    .from("fila_espera")
    .select(
      "id, nome, telefone, pessoas, status, posicao, avisado_em, numero_mesa",
    )
    .in("status", ["aguardando", "avisado"])
    .order("posicao");
  if (error) throw error;
  return (data ?? []) as FilaItem[];
}

export async function filaAdicionar(
  nome: string,
  telefone: string,
  pessoas: number,
): Promise<string> {
  const { data, error } = await supabase.rpc("fila_adicionar", {
    p_nome: nome,
    p_telefone: telefone,
    p_pessoas: pessoas,
  });
  if (error) throw error;
  return data as string;
}

export async function filaAvisar(id: string): Promise<void> {
  const { error } = await supabase.rpc("fila_avisar", { p_fila_id: id });
  if (error) throw error;
}

export async function filaSentar(id: string, numero_mesa: number): Promise<void> {
  const { error } = await supabase.rpc("fila_sentar", {
    p_fila_id: id,
    p_numero_mesa: numero_mesa,
  });
  if (error) throw error;
}
