import { supabase } from "@/integrations/supabase/client";

export interface Cliente {
  id: string;
  full_name: string;
  address: string;
  tipo_logradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  estado: string;
  cep: string;
  ddd: string;
  telefone: string;
  phone: string;
  fiado_autorizado: boolean;
  limite_fiado: number;
  saldo_devedor_fiado: number;
  saldo_cashback: number;
  bloqueado: boolean;
  created_at: string;
}

const CLIENTE_COLS =
  "id, full_name, address, tipo_logradouro, logradouro, numero, complemento, bairro, municipio, estado, cep, ddd, telefone, phone, fiado_autorizado, limite_fiado, saldo_devedor_fiado, saldo_cashback, bloqueado, created_at";

/** Lists all registered customers (admin/operator read-only consultation). */
export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(CLIENTE_COLS)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? "",
    address: p.address ?? "",
    tipo_logradouro: p.tipo_logradouro ?? "",
    logradouro: p.logradouro ?? "",
    numero: p.numero ?? "",
    complemento: p.complemento ?? "",
    bairro: p.bairro ?? "",
    municipio: p.municipio ?? "",
    estado: p.estado ?? "",
    cep: p.cep ?? "",
    ddd: p.ddd ?? "",
    telefone: p.telefone ?? "",
    phone: p.phone ?? "",
    fiado_autorizado: !!p.fiado_autorizado,
    limite_fiado: Number(p.limite_fiado ?? 0),
    saldo_devedor_fiado: Number(p.saldo_devedor_fiado ?? 0),
    saldo_cashback: Number(p.saldo_cashback ?? 0),
    bloqueado: !!(p as { bloqueado?: boolean }).bloqueado,
    created_at: p.created_at ?? "",
  }));
}

/** Blocks or unblocks a customer (admin only, via secure RPC). */
export async function setClienteBloqueado(
  userId: string,
  bloqueado: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_cliente_bloqueado", {
    p_user_id: userId,
    p_bloqueado: bloqueado,
  });
  if (error) throw error;
}
