import { supabase } from "@/integrations/supabase/client";

export type TipoConexao = "USB" | "IP";

export interface Printer {
  id: string;
  nome: string;
  tipo_conexao: TipoConexao;
  endereco_ip: string | null;
  porta: number | null;
  caminho_usb: string | null;
  cor: string;
  is_default: boolean;
  ativo: boolean;
  imprime_pedido_completo: boolean;
}

export interface CategoryRouting {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  id_impressora_destino: string | null;
}

/** Fallback sector used when an item's category has no printer linked. */
export const FALLBACK_SECTOR = "Balcão de Entregas";
export const FALLBACK_COLOR = "#9333ea";

export async function fetchPrinters(): Promise<Printer[]> {
  const { data, error } = await supabase
    .from("config_impressoras")
    .select(
      "id, nome, tipo_conexao, endereco_ip, porta, caminho_usb, cor, is_default, ativo, imprime_pedido_completo",
    )
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    ...p,
    tipo_conexao: (p.tipo_conexao as TipoConexao) ?? "USB",
    imprime_pedido_completo: Boolean(
      (p as { imprime_pedido_completo?: boolean }).imprime_pedido_completo,
    ),
  })) as Printer[];
}

export async function fetchCategoriesRouting(): Promise<CategoryRouting[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, id_impressora_destino")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRouting[];
}

export async function setCategoryPrinter(
  categoryId: string,
  printerId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .update({ id_impressora_destino: printerId })
    .eq("id", categoryId);
  if (error) throw error;
}

export async function createPrinter(input: {
  nome: string;
  tipo_conexao: TipoConexao;
  endereco_ip?: string | null;
  porta?: number | null;
  caminho_usb?: string | null;
  cor?: string;
  imprime_pedido_completo?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("config_impressoras").insert({
    nome: input.nome,
    tipo_conexao: input.tipo_conexao,
    endereco_ip: input.endereco_ip ?? null,
    porta: input.porta ?? null,
    caminho_usb: input.caminho_usb ?? null,
    cor: input.cor ?? "#2563eb",
    imprime_pedido_completo: !!input.imprime_pedido_completo,
  });
  if (error) throw error;
}

export async function updatePrinter(
  id: string,
  patch: Partial<{
    nome: string;
    tipo_conexao: TipoConexao;
    endereco_ip: string | null;
    porta: number | null;
    caminho_usb: string | null;
    cor: string;
    ativo: boolean;
    imprime_pedido_completo: boolean;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from("config_impressoras")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePrinter(id: string): Promise<void> {
  const { error } = await supabase
    .from("config_impressoras")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Test print + Agent tokens                                           */
/* ------------------------------------------------------------------ */

export async function enqueueTestPrint(printerId: string): Promise<string> {
  const { data, error } = await supabase.rpc("enqueue_test_print", {
    p_printer_id: printerId,
  });
  if (error) throw error;
  return data as unknown as string;
}

export interface PrinterAgentToken {
  id: string;
  nome: string;
  ativo: boolean;
  last_seen_at: string | null;
  created_at: string;
}

type BackendErrorShape = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  status?: unknown;
  statusText?: unknown;
};

export function getBackendErrorMessage(
  err: unknown,
  fallback = "Não foi possível concluir a operação.",
): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }

  if (err && typeof err === "object") {
    const e = err as BackendErrorShape;
    const parts = [e.message, e.details, e.hint, e.code, e.status, e.statusText]
      .filter((value): value is string | number =>
        (typeof value === "string" && value.trim().length > 0) ||
        typeof value === "number",
      )
      .map(String);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return fallback;
}

function isRpcSignatureCacheMiss(err: unknown): boolean {
  const message = getBackendErrorMessage(err, "").toLowerCase();
  return (
    message.includes("pgrst202") ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    message.includes("404") ||
    message.includes("not found")
  );
}

export async function fetchPrinterAgentTokens(): Promise<PrinterAgentToken[]> {
  const { data, error } = await supabase
    .from("printer_agent_tokens")
    .select("id, nome, ativo, last_seen_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PrinterAgentToken[];
}

export async function createPrinterAgentToken(nome: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_printer_agent_token", {
    nome,
  });
  if (!error) return data as unknown as string;

  if (isRpcSignatureCacheMiss(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase.rpc(
      "create_printer_agent_token" as never,
      { payload: { nome } } as never,
    );
    if (!fallbackError) return fallbackData as unknown as string;
    throw new Error(
      getBackendErrorMessage(fallbackError, "Não foi possível criar o agente."),
    );
  }

  throw new Error(getBackendErrorMessage(error, "Não foi possível criar o agente."));
}

export async function revokePrinterAgentToken(id: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_printer_agent_token", {
    p_id: id,
  });
  if (error) {
    throw new Error(getBackendErrorMessage(error, "Não foi possível revogar o agente."));
  }
}

/* ------------------------------------------------------------------ */
/* Routing resolution                                                  */
/* ------------------------------------------------------------------ */

export interface ResolvedSector {
  printerId: string | null;
  nome: string;
  cor: string;
  printer: Printer | null;
}

/**
 * Builds a resolver from a category_id to the destination sector/printer.
 * Items whose category has no linked printer fall back to the default
 * printer (is_default) or the "Balcão de Entregas" sector.
 */
export function makeSectorResolver(
  printers: Printer[],
  categories: CategoryRouting[],
) {
  const printerById = new Map(printers.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const defaultPrinter = printers.find((p) => p.is_default) ?? null;

  return function resolve(categoryId: string | null | undefined): ResolvedSector {
    const cat = categoryId ? categoryById.get(categoryId) : undefined;
    const printer = cat?.id_impressora_destino
      ? printerById.get(cat.id_impressora_destino) ?? null
      : null;
    const target = printer ?? defaultPrinter;
    if (target) {
      return {
        printerId: target.id,
        nome: target.nome,
        cor: target.cor,
        printer: target,
      };
    }
    return {
      printerId: null,
      nome: FALLBACK_SECTOR,
      cor: FALLBACK_COLOR,
      printer: null,
    };
  };
}
