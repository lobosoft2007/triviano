import * as dotenv from "dotenv";
import * as path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Variável ${name} obrigatória no .env`);
  }
  return v.trim();
}

function num(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  agentToken: required("AGENT_TOKEN"),
  apiBaseUrl: (process.env.API_BASE_URL || "https://triviano.com.br").replace(/\/+$/, ""),
  pollIntervalMs: num("POLL_INTERVAL_MS", 2000),
  heartbeatIntervalMs: num("HEARTBEAT_INTERVAL_MS", 30000),
  printerEncoding: (process.env.PRINTER_ENCODING || "cp850").toLowerCase(),
  logFile: process.env.LOG_FILE || "",
  printerColumns: num("PRINTER_COLUMNS", 48),
  tcpTimeoutMs: num("TCP_TIMEOUT_MS", 5000),
};
