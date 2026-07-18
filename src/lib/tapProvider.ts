import { supabase } from "@/integrations/supabase/client";

/**
 * Tap on Phone — configuração por empresa.
 * Guarda qual provedor (Mercado Pago | PagBank) o restaurante quer usar
 * no app garçom, em qual ambiente e com quais credenciais.
 *
 * A leitura das credenciais brutas fica restrita ao admin/dono da empresa
 * via RLS (`can_manage_empresa`). O app garçom só recebe o essencial
 * pelo RPC `get_my_tap_provider` — o secret nunca sai do backend.
 */

export type TapProvider = "mercadopago" | "pagbank";
export type TapAmbiente = "prod" | "sandbox";

/** Campos esperados nas credenciais de cada provedor. */
export interface MercadoPagoTapCreds {
  access_token?: string;
  user_id?: string;
  store_id?: string;
  pos_id?: string;
  application_id?: string;
}
export interface PagBankTapCreds {
  client_id?: string;
  client_secret?: string;
  token_aplicacao?: string;
  codigo_ativacao?: string;
}

export interface TapProviderConfig {
  id: string;
  empresa_id: string;
  provider: TapProvider;
  ambiente: TapAmbiente;
  ativo: boolean;
  credentials: MercadoPagoTapCreds | PagBankTapCreds | Record<string, string>;
  created_at: string;
  updated_at: string;
}

/** Todas as configurações Tap desta empresa (Mercado Pago + PagBank). */
export async function listTapProviderConfigs(): Promise<TapProviderConfig[]> {
  const { data, error } = await supabase
    .from("tap_provider_config")
    .select("*")
    .order("provider", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TapProviderConfig[];
}

/** Upsert (empresa+provider) via RPC — retorna o id da linha gravada. */
export async function saveTapProviderConfig(input: {
  provider: TapProvider;
  ambiente: TapAmbiente;
  credentials: Record<string, string>;
  ativo: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_tap_provider_config", {
    p_provider: input.provider,
    p_ambiente: input.ambiente,
    p_credentials: input.credentials,
    p_ativo: input.ativo,
  });
  if (error) throw error;
  return data as string;
}

/** Desativa qualquer provedor Tap desta empresa (nenhum ativo). */
export async function disableTapProvider(): Promise<void> {
  const { error } = await supabase
    .from("tap_provider_config")
    .update({ ativo: false })
    .eq("ativo", true);
  if (error) throw error;
}
