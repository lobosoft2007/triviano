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
    const m = u.searchParams.get("m") ?? u.searchParams.get("mesa");
    const t = u.searchParams.get("t") ?? u.searchParams.get("token");
    // Suporta também o caminho /mesa/<numero>?token=xxx
    const pathNum = u.pathname.match(/\/mesa\/(\d+)/)?.[1] ?? null;
    const numRaw = m ?? pathNum;
    if (numRaw && t) {
      const numero = Number(numRaw);
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

/* ------------------------------------------------------------------ */
/* Sessão de mesa (persistida no aparelho do cliente)                  */
/* ------------------------------------------------------------------ */

export interface MesaSession {
  comandaId: string;
  numero: number;
}

/** Evento disparado quando a sessão de mesa muda (abre/fecha). */
export const MESA_SESSION_EVENT = "mesa-session-change";

export function getMesaSession(): MesaSession | null {
  try {
    const id = sessionStorage.getItem(MESA_COMANDA_KEY);
    if (!id) return null;
    const numero = Number(sessionStorage.getItem(MESA_NUMERO_KEY));
    return { comandaId: id, numero: Number.isFinite(numero) ? numero : 0 };
  } catch {
    return null;
  }
}

export function setMesaSession(comandaId: string, numero: number): void {
  try {
    sessionStorage.setItem(MESA_COMANDA_KEY, comandaId);
    sessionStorage.setItem(MESA_NUMERO_KEY, String(numero));
    window.dispatchEvent(new Event(MESA_SESSION_EVENT));
  } catch {
    /* ignore */
  }
}

export function clearMesaSession(): void {
  try {
    sessionStorage.removeItem(MESA_COMANDA_KEY);
    sessionStorage.removeItem(MESA_NUMERO_KEY);
    window.dispatchEvent(new Event(MESA_SESSION_EVENT));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Envio de pedido da mesa → reaproveita create_order via RPC          */
/* ------------------------------------------------------------------ */

/**
 * Envia os itens do carrinho para a cozinha, anexando-os à comanda ativa.
 * O preço/desconto é recalculado no servidor (mesma blindagem do delivery).
 */
export async function enviarPedidoMesa(
  comandaId: string,
  items: CartItem[],
  notes = "",
): Promise<string> {
  const payload = items.map((i) => ({
    product_id: i.productId,
    size: i.size,
    second_flavor: i.secondFlavor,
    addons: i.addons,
    remocoes: i.remocoes,
    quantity: i.quantity,
  }));
  const { data, error } = await supabase.rpc("enviar_pedido_mesa", {
    p_items: payload as unknown as Json,
    p_host: currentHost(),
    p_comanda_id: comandaId,
    p_notes: notes,
  });
  if (error) throw error;
  return data as string;
}

/** Cliente (ou operador) solicita o fechamento da conta. */
export async function fecharComanda(comandaId: string): Promise<void> {
  const { error } = await supabase.rpc("fechar_comanda", {
    p_comanda_id: comandaId,
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Leitura da comanda (tela "Minha Comanda")                           */
/* ------------------------------------------------------------------ */

export async function fetchComandaById(id: string): Promise<ComandaAtiva | null> {
  const { data, error } = await supabase
    .from("comanda_ativa")
    .select("id, status, numero_mesa, total_parcial")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ComandaAtiva) ?? null;
}

export interface ComandaItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  size: string;
  second_flavor: string;
  addons: { name: string; price: number; quantity?: number }[];
  remocoes: string[];
}

export interface ComandaPedido {
  id: string;
  created_at: string;
  status_pedido: string;
  total: number;
  items: ComandaItem[];
}

/** Pedidos já enviados para a cozinha nesta comanda. */
export async function fetchComandaPedidos(
  comandaId: string,
): Promise<ComandaPedido[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, created_at, status_pedido, total, order_items(id, product_name, quantity, unit_price, size, second_flavor, addons, remocoes)",
    )
    .eq("comanda_id", comandaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    created_at: o.created_at,
    status_pedido: (o as { status_pedido?: string }).status_pedido ?? "",
    total: Number(o.total),
    items: (o.order_items ?? []).map((it) => ({
      id: it.id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      size: (it as { size?: string }).size ?? "",
      second_flavor: (it as { second_flavor?: string }).second_flavor ?? "",
      addons: Array.isArray((it as { addons?: unknown }).addons)
        ? ((it as unknown as {
            addons: { name: string; price: number; quantity?: number }[];
          }).addons)
        : [],
      remocoes: Array.isArray((it as { remocoes?: unknown }).remocoes)
        ? ((it as unknown as { remocoes: string[] }).remocoes)
        : [],
    })),
  })) as ComandaPedido[];
}

/* ------------------------------------------------------------------ */
/* Cockpit do Caixa — Fila de Visto e comandas em fechamento            */
/* ------------------------------------------------------------------ */

export interface SolicitacaoPendente {
  id: string;
  numero_mesa: number;
  nome_cliente: string;
  telefone: string;
  created_at: string;
}

/** Solicitações de abertura de mesa aguardando o "Visto" do operador. */
export async function fetchSolicitacoesPendentes(): Promise<
  SolicitacaoPendente[]
> {
  const { data, error } = await supabase
    .from("solicitacoes_mesa")
    .select("id, numero_mesa, nome_cliente, telefone, created_at")
    .eq("status", "aguardando")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SolicitacaoPendente[];
}

/** Operador libera a mesa (Visto) — cria/reaproveita a comanda. */
export async function liberarMesa(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("liberar_mesa", {
    p_solicitacao_id: id,
  });
  if (error) throw error;
  return data as string;
}

/** Operador recusa a solicitação de abertura. */
export async function recusarSolicitacao(id: string): Promise<void> {
  const { error } = await supabase.rpc("recusar_solicitacao_mesa", {
    p_solicitacao_id: id,
  });
  if (error) throw error;
}

export interface ComandaFechamento {
  numero_mesa: number;
  total_parcial: number;
  nome_cliente: string;
}

/** Mesas que pediram o fechamento (destaque amarelo pulsante no Caixa). */
export async function fetchComandasAguardandoFechamento(): Promise<
  ComandaFechamento[]
> {
  const { data, error } = await supabase
    .from("comanda_ativa")
    .select("numero_mesa, total_parcial, nome_cliente")
    .eq("status", "aguardando_fechamento");
  if (error) throw error;
  return (data ?? []) as ComandaFechamento[];
}

/* ------------------------------------------------------------------ */
/* Gerador de QR (Admin)                                               */
/* ------------------------------------------------------------------ */

/** Token curto e assinado para a mesa (hash com o segredo da empresa). */
export async function mesaTokenFor(
  empresaId: string,
  numero: number,
): Promise<string> {
  const { data, error } = await supabase.rpc("mesa_token", {
    p_empresa: empresaId,
    p_numero: numero,
  });
  if (error) throw error;
  return data as string;
}

/** Monta a URL segura do QR da mesa (formato lido por parseMesaQr). */
export function buildMesaQrUrl(numero: number, token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://triviano.com.br";
  return `${origin}/mesa?m=${numero}&t=${encodeURIComponent(token)}`;
}
