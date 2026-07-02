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

export interface AdminClienteUpdate {
  full_name: string;
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
  latitude: number | null;
  longitude: number | null;
}

/** Admin edits a customer's name/address/contact via secure RPC (bypasses RLS). */
export async function adminUpdateCliente(
  userId: string,
  patch: AdminClienteUpdate,
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_cliente", {
    p_user_id: userId,
    p_full_name: patch.full_name,
    p_tipo_logradouro: patch.tipo_logradouro,
    p_logradouro: patch.logradouro,
    p_numero: patch.numero,
    p_complemento: patch.complemento,
    p_bairro: patch.bairro,
    p_municipio: patch.municipio,
    p_estado: patch.estado,
    p_cep: patch.cep,
    p_ddd: patch.ddd,
    p_telefone: patch.telefone,
    // DB param is nullable numeric; generated types mark it non-null, so cast.
    p_latitude: patch.latitude as number,
    p_longitude: patch.longitude as number,
  });
  if (error) throw error;
}
