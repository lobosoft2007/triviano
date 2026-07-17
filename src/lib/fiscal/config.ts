import { supabase } from "@/integrations/supabase/client";
import { currentEmpresaId } from "@/lib/storage";
import type { FiscalAmbiente, FiscalProvider, RegimeTributario } from "@/lib/fiscal/types";

export interface FiscalConfig {
  id: string | null;
  empresa_id: string | null;
  provider: FiscalProvider;
  ambiente: FiscalAmbiente;
  regime_tributario: RegimeTributario;
  serie_nfce: string;
  numero_nfce_proximo: number;
  serie_nfe: string;
  numero_nfe_proximo: number;
  credenciais: {
    base_url?: string;
    api_key?: string;
    bearer_token?: string;
  };
  certificado_a1_path: string;
  certificado_a1_nome: string;
  certificado_a1_validade: string | null;
  certificado_a1_senha: string;
  ativo: boolean;
}

function encodeSenha(value: string): string {
  if (!value) return "";
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return value;
  }
}

function decodeSenha(value: string): string {
  if (!value) return "";
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value;
  }
}

export async function fetchFiscalConfig(): Promise<FiscalConfig> {
  const empresaId = await currentEmpresaId();
  const { data, error } = await supabase
    .from("config_fiscal")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      id: null,
      empresa_id: empresaId,
      provider: "tecnospeed",
      ambiente: "homologacao",
      regime_tributario: "simples_nacional",
      serie_nfce: "1",
      numero_nfce_proximo: 1,
      serie_nfe: "1",
      numero_nfe_proximo: 1,
      credenciais: {},
      certificado_a1_path: "",
      certificado_a1_nome: "",
      certificado_a1_validade: null,
      certificado_a1_senha: "",
      ativo: true,
    };
  }

  return {
    id: data.id,
    empresa_id: data.empresa_id,
    provider: (data.provider as FiscalProvider) || "tecnospeed",
    ambiente: (data.ambiente as FiscalAmbiente) || "homologacao",
    regime_tributario:
      (data.regime_tributario as RegimeTributario) || "simples_nacional",
    serie_nfce: data.serie_nfce || "1",
    numero_nfce_proximo: Number(data.numero_nfce_proximo ?? 1),
    serie_nfe: data.serie_nfe || "1",
    numero_nfe_proximo: Number(data.numero_nfe_proximo ?? 1),
    credenciais: (data.credenciais as FiscalConfig["credenciais"]) || {},
    certificado_a1_path: data.certificado_a1_path || "",
    certificado_a1_nome: data.certificado_a1_nome || "",
    certificado_a1_validade: data.certificado_a1_validade || null,
    certificado_a1_senha: decodeSenha(data.certificado_a1_senha_criptografada || ""),
    ativo: data.ativo ?? true,
  };
}

export async function saveFiscalConfig(input: FiscalConfig): Promise<void> {
  const payload = {
    empresa_id: input.empresa_id,
    provider: input.provider,
    ambiente: input.ambiente,
    regime_tributario: input.regime_tributario,
    serie_nfce: input.serie_nfce,
    numero_nfce_proximo: input.numero_nfce_proximo,
    serie_nfe: input.serie_nfe,
    numero_nfe_proximo: input.numero_nfe_proximo,
    credenciais: input.credenciais,
    certificado_a1_path: input.certificado_a1_path || null,
    certificado_a1_senha_criptografada: encodeSenha(input.certificado_a1_senha),
    ativo: input.ativo,
  };

  if (input.id) {
    const { error } = await supabase
      .from("config_fiscal")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("config_fiscal").insert(payload);
    if (error) throw error;
  }
}
