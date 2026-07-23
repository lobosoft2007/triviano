import { fetch } from "undici";
import { config } from "./config";

export interface AgentPrinter {
  id: string;
  nome: string;
  tipo_conexao: "USB" | "IP";
  endereco_ip: string | null;
  porta: number | null;
  caminho_usb: string | null;
  imprime_pedido_completo: boolean;
  ativo: boolean;
  encoding?: string | null;
}

export interface PrintJob {
  id: string;
  empresa_id: string;
  printer_id: string | null;
  order_id: string | null;
  tipo: "setor" | "pedido_completo" | "teste" | "reimpressao";
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-token": config.agentToken,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function heartbeat() {
  return post<{
    ok: boolean;
    agent: { id: string; nome: string; empresa_id: string };
    printers: AgentPrinter[];
    server_time: string;
  }>("/api/public/print-agent/heartbeat", {});
}

export async function claim(limit = 10) {
  return post<{ jobs: PrintJob[] }>("/api/public/print-agent/claim", { limit });
}

export async function ack(jobId: string, ok: boolean, error?: string) {
  return post<{ ok: boolean }>("/api/public/print-agent/ack", {
    job_id: jobId,
    ok,
    error: error ?? null,
  });
}
