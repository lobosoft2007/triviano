import * as iconv from "iconv-lite";
import { config } from "./config";
import type { PrintJob } from "./api";

const ESC = 0x1b;
const GS = 0x1d;

const INIT = Buffer.from([ESC, 0x40]);
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 1]);
const BOLD_ON = Buffer.from([ESC, 0x45, 1]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0]);
const DBL_ON = Buffer.from([GS, 0x21, 0x11]); // dobra L e A
const DBL_OFF = Buffer.from([GS, 0x21, 0x00]);
const CUT = Buffer.from([GS, 0x56, 0x42, 0x00]);
const FEED = (n: number) => Buffer.from([ESC, 0x64, n]);

function encode(text: string, enc: string): Buffer {
  const target = (enc || config.printerEncoding || "cp850").toLowerCase();
  try {
    return iconv.encode(text, target);
  } catch {
    return Buffer.from(text, "utf8");
  }
}

function line(cols: number, ch = "-") {
  return ch.repeat(cols) + "\n";
}

function pad2(cols: number, left: string, right: string): string {
  const l = left ?? "";
  const r = right ?? "";
  const space = Math.max(1, cols - l.length - r.length);
  return l + " ".repeat(space) + r + "\n";
}

function wrap(text: string, cols: number, indent = 0): string {
  const pad = " ".repeat(indent);
  const words = String(text ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((pad + cur + (cur ? " " : "") + w).length > cols) {
      if (cur) lines.push(pad + cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(pad + cur);
  return lines.join("\n") + "\n";
}

interface JobPayload {
  empresa_nome?: string;
  senha?: string;
  numero_pedido?: string | number;
  tipo_atendimento?: string;
  mesa?: string | number | null;
  cliente_nome?: string;
  entregador_nome?: string;
  endereco?: string;
  setor?: string;
  observacao?: string;
  meio_pagamento?: string;
  total?: number;
  taxa_entrega?: number;
  itens?: Array<{
    qtd: number;
    nome: string;
    preco_unit?: number;
    subtotal?: number;
    adicionais?: string[];
    free_addons?: string[];
    removidos?: string[];
    observacao?: string;
    setor?: string;
  }>;
  criado_em?: string;
}

function money(n: number | undefined): string {
  if (typeof n !== "number") return "";
  return "R$ " + n.toFixed(2).replace(".", ",");
}

export function renderJob(job: PrintJob, encodingOverride?: string | null): Buffer {
  const cols = config.printerColumns;
  const payload = (job.payload || {}) as JobPayload;
  const enc = encodingOverride || config.printerEncoding;
  const parts: Buffer[] = [INIT];

  parts.push(ALIGN_CENTER, BOLD_ON, DBL_ON);
  parts.push(encode((payload.empresa_nome || "Pedido") + "\n", enc));
  parts.push(DBL_OFF, BOLD_OFF);

  if (payload.senha) {
    parts.push(BOLD_ON, DBL_ON);
    parts.push(encode(`SENHA ${payload.senha}\n`, enc));
    parts.push(DBL_OFF, BOLD_OFF);
  }

  const kind =
    job.tipo === "pedido_completo"
      ? "VIA COMPLETA"
      : job.tipo === "teste"
        ? "TESTE"
        : payload.setor
          ? `SETOR: ${payload.setor}`
          : "COZINHA";
  parts.push(BOLD_ON, encode(kind + "\n", enc), BOLD_OFF);

  parts.push(ALIGN_LEFT);
  parts.push(encode(line(cols), enc));

  const header: string[] = [];
  if (payload.numero_pedido) header.push(`Pedido: #${payload.numero_pedido}`);
  if (payload.tipo_atendimento) header.push(`Tipo: ${payload.tipo_atendimento}`);
  if (payload.mesa) header.push(`Mesa: ${payload.mesa}`);
  if (payload.cliente_nome) header.push(`Cliente: ${payload.cliente_nome}`);
  if (payload.entregador_nome) header.push(`Entregador: ${payload.entregador_nome}`);
  if (payload.criado_em) header.push(`Hora: ${new Date(payload.criado_em).toLocaleString("pt-BR")}`);
  for (const h of header) parts.push(encode(wrap(h, cols), enc));

  if (payload.endereco && job.tipo === "pedido_completo") {
    parts.push(encode(wrap(`End: ${payload.endereco}`, cols), enc));
  }

  parts.push(encode(line(cols), enc));

  for (const it of payload.itens || []) {
    const qtd = `${it.qtd}x`;
    const nome = it.nome ?? "";
    const priceStr =
      job.tipo === "pedido_completo" && typeof it.subtotal === "number"
        ? money(it.subtotal)
        : "";
    parts.push(BOLD_ON, encode(pad2(cols, `${qtd} ${nome}`, priceStr), enc), BOLD_OFF);

    for (const a of it.adicionais || []) {
      parts.push(encode(wrap(`+ ${a}`, cols, 2), enc));
    }
    for (const a of it.free_addons || []) {
      parts.push(encode(wrap(`+ ${a} (grátis)`, cols, 2), enc));
    }
    for (const r of it.removidos || []) {
      parts.push(BOLD_ON, encode(wrap(`- SEM ${r.toUpperCase()}`, cols, 2), enc), BOLD_OFF);
    }
    if (it.observacao) {
      parts.push(encode(wrap(`Obs: ${it.observacao}`, cols, 2), enc));
    }
  }

  if (payload.observacao) {
    parts.push(encode(line(cols), enc));
    parts.push(BOLD_ON, encode("OBS DO PEDIDO:\n", enc), BOLD_OFF);
    parts.push(encode(wrap(payload.observacao, cols), enc));
  }

  if (job.tipo === "pedido_completo") {
    parts.push(encode(line(cols), enc));
    if (typeof payload.taxa_entrega === "number" && payload.taxa_entrega > 0) {
      parts.push(encode(pad2(cols, "Taxa entrega", money(payload.taxa_entrega)), enc));
    }
    if (typeof payload.total === "number") {
      parts.push(BOLD_ON, DBL_ON);
      parts.push(encode(pad2(cols / 2, "TOTAL", money(payload.total)), enc));
      parts.push(DBL_OFF, BOLD_OFF);
    }
    if (payload.meio_pagamento) {
      parts.push(encode(`Pagto: ${payload.meio_pagamento}\n`, enc));
    }
  }

  parts.push(FEED(3), CUT);
  return Buffer.concat(parts);
}
