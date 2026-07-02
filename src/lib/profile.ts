import { supabase } from "@/integrations/supabase/client";

export interface FullProfile {
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
  latitude: number | null;
  longitude: number | null;
  fiado_autorizado: boolean;
  limite_fiado: number;
  saldo_devedor_fiado: number;
  saldo_cashback: number;
}

const PROFILE_COLS =
  "id, full_name, address, tipo_logradouro, logradouro, numero, complemento, bairro, municipio, estado, cep, ddd, telefone, latitude, longitude, fiado_autorizado, limite_fiado, saldo_devedor_fiado, saldo_cashback";

export async function fetchFullProfile(userId: string): Promise<FullProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name ?? "",
    address: data.address ?? "",
    tipo_logradouro: data.tipo_logradouro ?? "",
    logradouro: data.logradouro ?? "",
    numero: data.numero ?? "",
    complemento: data.complemento ?? "",
    bairro: data.bairro ?? "",
    municipio: data.municipio ?? "",
    estado: data.estado ?? "",
    cep: data.cep ?? "",
    ddd: data.ddd ?? "",
    telefone: data.telefone ?? "",
    latitude: data.latitude != null ? Number(data.latitude) : null,
    longitude: data.longitude != null ? Number(data.longitude) : null,
    fiado_autorizado: !!data.fiado_autorizado,
    limite_fiado: Number(data.limite_fiado ?? 0),
    saldo_devedor_fiado: Number(data.saldo_devedor_fiado ?? 0),
    saldo_cashback: Number(data.saldo_cashback ?? 0),
  };
}

export interface ProfileAddressUpdate {
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

/** Builds a single-line address string from atomized parts (legacy field). */
export function composeAddress(p: {
  tipo_logradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  estado: string;
  cep: string;
}): string {
  const line1 = [p.tipo_logradouro, p.logradouro].filter(Boolean).join(" ").trim();
  const withNumber = [line1, p.numero].filter(Boolean).join(", ");
  const withComp = [withNumber, p.complemento].filter(Boolean).join(" - ");
  const rest = [p.bairro, p.municipio, p.estado].filter(Boolean).join(", ");
  const cep = p.cep ? `CEP ${p.cep}` : "";
  return [withComp, rest, cep].filter(Boolean).join(", ");
}

export async function updateProfileAddress(
  userId: string,
  patch: ProfileAddressUpdate,
): Promise<void> {
  const address = composeAddress(patch);
  const phone = [patch.ddd, patch.telefone].filter(Boolean).join(" ").trim();
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, address, phone })
    .eq("id", userId);
  if (error) throw error;
}

export interface ExtratoContaRow {
  id: string;
  tipo: "Debito" | "Credito";
  valor: number;
  descricao: string;
  saldo_devedor_momento: number;
  created_at: string;
}

export async function fetchExtratoContaCorrente(
  userId: string,
): Promise<ExtratoContaRow[]> {
  const { data, error } = await supabase
    .from("extrato_conta_corrente")
    .select("id, tipo, valor, descricao, saldo_devedor_momento, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo as "Debito" | "Credito",
    valor: Number(r.valor),
    descricao: r.descricao ?? "",
    saldo_devedor_momento: Number(r.saldo_devedor_momento ?? 0),
    created_at: r.created_at,
  }));
}
