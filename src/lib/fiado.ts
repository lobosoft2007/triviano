import { supabase } from "@/integrations/supabase/client";

export interface FiadoClient {
  id: string;
  full_name: string;
  phone: string;
  fiado_autorizado: boolean;
  limite_fiado: number;
  saldo_devedor_fiado: number;
  saldo_cashback: number;
}

export interface ExtratoFiadoRow {
  id: string;
  id_pedido: string | null;
  tipo: "Debito_Compra" | "Credito_Pagamento";
  valor: number;
  saldo_devedor_momento: number;
  created_at: string;
}

/** Lists customers, surfacing fiado/cashback wallet state (admin only). */
export async function fetchFiadoClients(): Promise<FiadoClient[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, phone, fiado_autorizado, limite_fiado, saldo_devedor_fiado, saldo_cashback",
    )
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? "",
    phone: p.phone ?? "",
    fiado_autorizado: !!p.fiado_autorizado,
    limite_fiado: Number(p.limite_fiado ?? 0),
    saldo_devedor_fiado: Number(p.saldo_devedor_fiado ?? 0),
    saldo_cashback: Number(p.saldo_cashback ?? 0),
  }));
}

/** Sets a customer's fiado authorization and credit limit (admin RPC). */
export async function setFiadoConfig(input: {
  userId: string;
  autorizado: boolean;
  limite: number;
}): Promise<void> {
  const { error } = await supabase.rpc("set_fiado_config", {
    p_user_id: input.userId,
    p_autorizado: input.autorizado,
    p_limite: input.limite,
  });
  if (error) throw error;
}

/** Registers a fiado debt payment (quitação). Returns the new debt balance. */
export async function payFiado(input: {
  userId: string;
  valor: number;
  meioId: string;
  descricao: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("pay_fiado", {
    p_user_id: input.userId,
    p_valor: input.valor,
    p_id_meio: input.meioId,
    p_descricao: input.descricao,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Full fiado statement for a customer, newest first. */
export async function fetchExtratoFiado(
  userId: string,
): Promise<ExtratoFiadoRow[]> {
  const { data, error } = await supabase
    .from("extrato_fiado")
    .select("id, id_pedido, tipo, valor, saldo_devedor_momento, created_at")
    .eq("id_usuario", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    id_pedido: r.id_pedido,
    tipo: r.tipo as "Debito_Compra" | "Credito_Pagamento",
    valor: Number(r.valor),
    saldo_devedor_momento: Number(r.saldo_devedor_momento),
    created_at: r.created_at,
  }));
}
