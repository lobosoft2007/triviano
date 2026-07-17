import { supabase } from "@/integrations/supabase/client";

export type IfoodStatusLoja = "OPEN" | "CLOSED" | "PAUSED";

export interface IfoodMerchant {
  id: string;
  empresa_id: string;
  merchant_id: string;
  nome: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  polling_enabled: boolean;
  status_loja: IfoodStatusLoja;
  ultima_sincronizacao: string | null;
}

export async function listIfoodMerchants(): Promise<IfoodMerchant[]> {
  const { data, error } = await supabase
    .from("ifood_merchants")
    .select(
      "id, empresa_id, merchant_id, nome, client_id, client_secret, access_token, refresh_token, token_expires_at, polling_enabled, status_loja, ultima_sincronizacao",
    )
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    empresa_id: r.empresa_id,
    merchant_id: r.merchant_id,
    nome: r.nome,
    client_id: r.client_id ?? "",
    client_secret: r.client_secret ?? "",
    access_token: r.access_token ?? "",
    refresh_token: r.refresh_token ?? "",
    token_expires_at: r.token_expires_at ?? null,
    polling_enabled: r.polling_enabled,
    status_loja: (r.status_loja as IfoodStatusLoja) ?? "CLOSED",
    ultima_sincronizacao: r.ultima_sincronizacao ?? null,
  }));
}

export async function saveIfoodMerchant(input: {
  id?: string | null;
  empresa_id: string;
  merchant_id: string;
  nome: string;
  client_id: string;
  client_secret: string;
  polling_enabled: boolean;
  status_loja: IfoodStatusLoja;
}): Promise<void> {
  const payload = {
    empresa_id: input.empresa_id,
    merchant_id: input.merchant_id.trim(),
    nome: input.nome.trim(),
    client_id: input.client_id.trim() || null,
    client_secret: input.client_secret.trim() || null,
    polling_enabled: input.polling_enabled,
    status_loja: input.status_loja,
  };
  if (input.id) {
    const { error } = await supabase
      .from("ifood_merchants")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("ifood_merchants").insert(payload);
    if (error) throw error;
  }
}

export async function deleteIfoodMerchant(id: string): Promise<void> {
  const { error } = await supabase.from("ifood_merchants").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePolling(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("ifood_merchants")
    .update({ polling_enabled: enabled })
    .eq("id", id);
  if (error) throw error;
}

export async function setStoreStatus(
  id: string,
  status: IfoodStatusLoja,
): Promise<void> {
  const { error } = await supabase
    .from("ifood_merchants")
    .update({ status_loja: status })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Aplica o markup_ifood_percentual da empresa em massa nos produtos.
 * @param overwrite quando true, sobrescreve preços já preenchidos.
 * @returns nº de produtos afetados.
 */
export async function applyIfoodMarkup(
  empresaId: string,
  overwrite: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc("apply_ifood_markup", {
    p_empresa_id: empresaId,
    p_overwrite: overwrite,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
