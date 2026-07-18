import { supabase } from "@/integrations/supabase/client";
import { currentEmpresaId } from "@/lib/storage";

export type PosFlavor = "rede" | "pagseguro" | "infinitepay";

export interface PosDevice {
  id: string;
  nome: string;
  flavor: PosFlavor;
  last_seen_at: string | null;
  revogado_em: string | null;
  created_at: string;
}

export interface PosPairCode {
  id: string;
  code: string;
  nome: string;
  flavor: PosFlavor;
  expira_em: string;
  usado_em: string | null;
  created_at: string;
}

export async function listPosDevices(): Promise<PosDevice[]> {
  const { data, error } = await supabase
    .from("pos_devices")
    .select("id, nome, flavor, last_seen_at, revogado_em, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PosDevice[];
}

export async function listPosPairCodes(): Promise<PosPairCode[]> {
  const { data, error } = await supabase
    .from("pos_pair_codes")
    .select("id, code, nome, flavor, expira_em, usado_em, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as PosPairCode[];
}

export async function generatePosPairCode(
  nome: string,
  flavor: PosFlavor,
): Promise<string> {
  const empresa_id = await currentEmpresaId();
  const { data, error } = await supabase.rpc("pos_generate_pair_code", {
    p_empresa: empresa_id,
    p_nome: nome,
    p_flavor: flavor,
  });
  if (error) throw error;
  return data as string;
}

export async function revokePosDevice(device_id: string): Promise<void> {
  const { error } = await supabase.rpc("pos_revoke_device", { p_device: device_id });
  if (error) throw error;
}

export async function setOperatorPin(user_id: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc("pos_set_pin", { p_user: user_id, p_pin: pin });
  if (error) throw error;
}
