import { supabase } from "@/integrations/supabase/client";

export type PosCommand =
  | "ping"
  | "bloquear"
  | "desbloquear"
  | "forcar_logout"
  | "reimprimir_ultimo"
  | "limpar_fila_offline"
  | "atualizar_config";

export interface PosDeviceHealth {
  id: string;
  nome: string;
  flavor: string;
  ativo: boolean;
  revogado_em: string | null;
  last_seen_at: string | null;
  app_version: string | null;
  os_version: string | null;
  battery_pct: number | null;
  network_type: string | null;
  printer_ok: boolean | null;
  nfc_ok: boolean | null;
  sdk_provider_ativo: string | null;
  last_error: string | null;
  last_error_at: string | null;
}

export interface PosDeviceEvent {
  id: string;
  device_id: string;
  tipo: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PosFleetKpis {
  total: number;
  online: number;
  bateria_baixa: number;
  erros_24h: number;
  transacionado_hoje: number;
}

export async function fetchFleetKpis(): Promise<PosFleetKpis> {
  const { data, error } = await supabase.rpc("pos_fleet_kpis");
  if (error) throw error;
  const j = (data ?? {}) as Partial<PosFleetKpis>;
  return {
    total: Number(j.total ?? 0),
    online: Number(j.online ?? 0),
    bateria_baixa: Number(j.bateria_baixa ?? 0),
    erros_24h: Number(j.erros_24h ?? 0),
    transacionado_hoje: Number(j.transacionado_hoje ?? 0),
  };
}

export async function fetchFleetDevices(): Promise<PosDeviceHealth[]> {
  const { data, error } = await supabase
    .from("pos_devices")
    .select(
      "id, nome, flavor, ativo, revogado_em, last_seen_at, app_version, os_version, battery_pct, network_type, printer_ok, nfc_ok, sdk_provider_ativo, last_error, last_error_at",
    )
    .order("last_seen_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as PosDeviceHealth[];
}

export async function fetchDeviceEvents(deviceId: string, limit = 50): Promise<PosDeviceEvent[]> {
  const { data, error } = await supabase
    .from("pos_device_events")
    .select("id, device_id, tipo, payload, created_at")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PosDeviceEvent[];
}

export async function sendPosCommand(
  deviceId: string,
  comando: PosCommand,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc("pos_send_command", {
    p_device: deviceId,
    p_comando: comando,
    p_payload: payload,
  });
  if (error) throw error;
  return data as string;
}

export function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60_000;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
