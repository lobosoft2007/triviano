import { supabase } from "@/integrations/supabase/client";
import { currentHost } from "@/lib/empresa";
import type { CartItem } from "@/lib/cart";
import type { Json } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SolicitacaoMesaStatus =
  | "aguardando"
  | "liberada"
  | "recusada"
  | "expirada";

export type ComandaStatus =
  | "aberta"
  | "aguardando_fechamento"
  | "fechada"
  | "cancelada";

export interface SolicitacaoMesa {
  id: string;
  status: SolicitacaoMesaStatus;
  numero_mesa: number;
  empresa_id: string;
}

export interface ComandaAtiva {
  id: string;
  status: ComandaStatus;
  numero_mesa: number;
  total_parcial: number;
}

export interface ParsedMesaQr {
  numero: number;
  token: string;
}

/** Chaves usadas para lembrar a sessão de mesa no aparelho do cliente. */
export const MESA_COMANDA_KEY = "mesa_comanda_id";
export const MESA_NUMERO_KEY = "mesa_numero";

/* ------------------------------------------------------------------ */
/* QR parsing                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aceita vários formatos de QR para a mesa e extrai { numero, token }:
 *  - URL:            https://host/mesa?m=8&t=abc123
 *  - Query solta:    m=8&t=abc123  (ou "?m=8&t=abc123")
 *  - Compacto:       MESA:8:abc123 ou MESA|8|abc123
 * O host NÃO é lido do QR — usamos sempre o host atual (validação de tenant).
 */
export function parseMesaQr(text: string): ParsedMesaQr | null {
  if (!text) return null;
  const raw = text.trim();

  // 1) URL completa
  try {
    const u = new URL(raw);
    const m = u.searchParams.get("m");
    const t = u.searchParams.get("t");
    if (m && t) {
      const numero = Number(m);
      if (Number.isFinite(numero) && numero > 0) return { numero, token: t };
    }
  } catch {
    /* não é URL — segue */
  }

  // 2) Query solta
  const qs = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw;
  if (qs.includes("m=") && qs.includes("t=")) {
    const params = new URLSearchParams(qs);
    const m = params.get("m");
    const t = params.get("t");
    if (m && t) {
      const numero = Number(m);
      if (Number.isFinite(numero) && numero > 0) return { numero, token: t };
    }
  }

  // 3) Compacto MESA:8:token / MESA|8|token
  const parts = raw.split(/[:|]/);
  if (parts.length >= 3 && /mesa/i.test(parts[0])) {
    const numero = Number(parts[1]);
    const token = parts[2].trim();
    if (Number.isFinite(numero) && numero > 0 && token) {
      return { numero, token };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* RPCs                                                                */
/* ------------------------------------------------------------------ */

/** Abre a solicitação de mesa (valida host + token do QR no servidor). */
export async function abrirSolicitacaoMesa(
  numero: number,
  token: string,
  nome: string,
  telefone: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("abrir_solicitacao_mesa", {
    p_host: currentHost(),
    p_numero_mesa: numero,
    p_token: token,
    p_nome: nome,
    p_telefone: telefone,
  });
  if (error) throw error;
  return data as string;
}

/** Cliente desiste da espera. */
export async function desistirSolicitacao(id: string): Promise<void> {
  const { error } = await supabase.rpc("desistir_solicitacao_mesa", {
    p_solicitacao_id: id,
  });
  if (error) throw error;
}

/** Lê o estado atual de uma solicitação (fallback de polling). */
export async function fetchSolicitacao(
  id: string,
): Promise<SolicitacaoMesa | null> {
  const { data, error } = await supabase
    .from("solicitacoes_mesa")
    .select("id, status, numero_mesa, empresa_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SolicitacaoMesa) ?? null;
}

/** Comanda aberta do próprio cliente (RLS já restringe ao usuário). */
export async function fetchMinhaComandaAberta(
  numero: number,
): Promise<ComandaAtiva | null> {
  const { data, error } = await supabase
    .from("comanda_ativa")
    .select("id, status, numero_mesa, total_parcial")
    .eq("numero_mesa", numero)
    .eq("status", "aberta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ComandaAtiva) ?? null;
}
