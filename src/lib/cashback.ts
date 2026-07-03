import { supabase } from "@/integrations/supabase/client";

export type CashbackMovTipo =
  | "credito_ganho"
  | "debito_uso"
  | "debito_abatimento_fiado";

export interface ExtratoCashbackRow {
  id: string;
  pedido_id: string | null;
  tipo_movimentacao: CashbackMovTipo;
  valor: number;
  saldo_residual: number;
  created_at: string;
}

export interface AbatimentoResult {
  saldo_cashback: number;
  saldo_devedor: number;
  abatido: number;
}

const LABELS: Record<CashbackMovTipo, string> = {
  credito_ganho: "Cashback recebido",
  debito_uso: "Cashback utilizado",
  debito_abatimento_fiado: "Abatimento de fiado com cashback",
};

export function cashbackLabel(tipo: CashbackMovTipo): string {
  return LABELS[tipo] ?? "Movimentação";
}

export function isCashbackCredito(tipo: CashbackMovTipo): boolean {
  return tipo === "credito_ganho";
}

/** Full cashback statement for a customer, newest first. */
export async function fetchExtratoCashback(
  userId: string,
): Promise<ExtratoCashbackRow[]> {
  const { data, error } = await supabase
    .from("extrato_cashback")
    .select("id, pedido_id, tipo_movimentacao, valor, saldo_residual, created_at")
    .eq("cliente_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    pedido_id: r.pedido_id,
    tipo_movimentacao: r.tipo_movimentacao as CashbackMovTipo,
    valor: Number(r.valor),
    saldo_residual: Number(r.saldo_residual),
    created_at: r.created_at,
  }));
}

/**
 * Atomic cross-abatement: uses the customer's cashback balance to pay down
 * their fiado debt. Pass `valor` to abate a specific amount, or omit it to use
 * the maximum possible (min of cashback balance and outstanding debt).
 * The customer can only run this for themselves; admins for anyone.
 */
export async function abaterFiadoComCashback(input: {
  userId: string;
  valor?: number;
}): Promise<AbatimentoResult> {
  const { data, error } = await supabase.rpc("abater_fiado_com_cashback", {
    p_user_id: input.userId,
    p_valor: input.valor ?? undefined,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    saldo_cashback: Number(row?.saldo_cashback ?? 0),
    saldo_devedor: Number(row?.saldo_devedor ?? 0),
    abatido: Number(row?.abatido ?? 0),
  };
}
