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
const DBL_ON = Buffer.from([GS, 0x21, 0x11]);
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

interface SectorItem {
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  size?: string;
  addons?: Array<string | { name?: string; price?: number }>;
  second_flavor?: string;
  remocoes?: string[];
  observacao?: string;
  nome?: string;
  qtd?: number;
  preco_unit?: number;
  adicionais?: string[];
  removidos?: string[];
}

interface OrderData {
  id?: string;
  senha?: string | null;
  senha_diaria?: string | null;
  tipo_atendimento?: string;
  numero_mesa?: string | number | null;
  delivery_address?: string;
  observacoes_operador?: string;
  notes?: string;
  total?: number;
  tipo_pagamento?: string;
  created_at?: string;
  cliente_nome?: string;
  phone?: string;
  mesa?: string | number | null;
  endereco?: string;
  meio_pagamento?: string;
  taxa_entrega?: number;
  criado_em?: string;
  hora_prevista_pronto?: string | null;
  tempo_estimado_min?: number | null;
}

interface JobPayload {
  sector_name?: string;
  order?: OrderData;
  items?: SectorItem[];
  empresa_nome?: string;
  itens?: SectorItem[];
  setor?: string;
  cliente_nome?: string;
  tipo_atendimento?: string;
  mesa?: string | number | null;
  endereco?: string;
  observacao?: string;
  meio_pagamento?: string;
  total?: number;
  taxa_entrega?: number;
  numero_pedido?: string | number;
  senha?: string;
  criado_em?: string;
  entregador_nome?: string;
}

function money(n: number | undefined): string {
  if (typeof n !== "number") return "";
  return "R$ " + n.toFixed(2).replace(".", ",");
}

function addonToStr(a: string | { name?: string; price?: number }): string {
  if (typeof a === "string") return a;
  const name = a?.name ?? "";
  if (a?.price != null) return `${name} (${money(a.price)})`;
  return name;
}

function getOrder(payload: JobPayload): OrderData {
  if (payload.order) return payload.order;
  return {
    cliente_nome: payload.cliente_nome,
    tipo_atendimento: payload.tipo_atendimento,
    mesa: payload.mesa,
    numero_mesa: payload.mesa,
    endereco: payload.endereco,
    delivery_address: payload.endereco,
    observacoes_operador: payload.observacao,
    notes: payload.observacao,
    meio_pagamento: payload.meio_pagamento,
    tipo_pagamento: payload.meio_pagamento,
    total: payload.total,
    taxa_entrega: payload.taxa_entrega,
    senha: payload.senha,
    criado_em: payload.criado_em,
    created_at: payload.criado_em,
  };
}

function getItems(payload: JobPayload): SectorItem[] {
  return payload.items ?? payload.itens ?? [];
}

function getSector(payload: JobPayload): string {
  return payload.sector_name ?? payload.setor ?? "";
}

function getQtd(it: SectorItem): number {
  return it.quantity ?? it.qtd ?? 1;
}

function getNome(it: SectorItem): string {
  return it.product_name ?? it.nome ?? "";
}

function getUnitPrice(it: SectorItem): number | undefined {
  return it.unit_price ?? it.preco_unit;
}

function getAddons(it: SectorItem): Array<string | { name?: string; price?: number }> {
  return it.addons ?? it.adicionais ?? [];
}

function getRemocoes(it: SectorItem): string[] {
  return it.remocoes ?? it.removidos ?? [];
}

export function renderJob(job: PrintJob, encodingOverride?: string | null): Buffer {
  const cols = config.printerColumns;
  const payload = (job.payload || {}) as JobPayload;
  const enc = encodingOverride || config.printerEncoding;
  const order = getOrder(payload);
  const items = getItems(payload);
  const sector = getSector(payload);
  const parts: Buffer[] = [INIT];

  parts.push(ALIGN_CENTER, BOLD_ON, DBL_ON);
  parts.push(encode((payload.empresa_nome || "Pedido") + "\n", enc));
  parts.push(DBL_OFF, BOLD_OFF);

  if (order.senha) {
    parts.push(BOLD_ON, DBL_ON);
    parts.push(encode(`SENHA ${order.senha}\n`, enc));
    parts.push(DBL_OFF, BOLD_OFF);
  }

  const kind =
    job.tipo === "pedido_completo"
      ? "VIA COMPLETA"
      : job.tipo === "teste"
        ? "TESTE"
        : sector
          ? sector.toUpperCase()
          : "COZINHA";
  parts.push(BOLD_ON, encode(kind + "\n", enc), BOLD_OFF);

  parts.push(ALIGN_LEFT);
  parts.push(encode(line(cols), enc));

  const header: string[] = [];
  if (order.id) header.push(`Pedido: #${order.id.slice(0, 8)}`);
  if (order.tipo_atendimento) header.push(`Tipo: ${order.tipo_atendimento}`);
  const mesa = order.numero_mesa ?? order.mesa;
  if (mesa) header.push(`Mesa: ${mesa}`);
  if (order.cliente_nome) header.push(`Cliente: ${order.cliente_nome}`);
  if (order.phone) header.push(`Tel: ${order.phone}`);
  if (order.created_at) header.push(`Hora: ${new Date(order.created_at).toLocaleString("pt-BR")}`);
  for (const h of header) parts.push(encode(wrap(h, cols), enc));

  if (order.delivery_address && job.tipo === "pedido_completo") {
    parts.push(encode(wrap(`End: ${order.delivery_address}`, cols), enc));
  }

  parts.push(encode(line(cols), enc));

  for (const it of items) {
    const qtd = `${getQtd(it)}x`;
    let nome = getNome(it);

    if (it.size && it.size !== "Padrão" && !nome.includes(`(${it.size})`)) {
      nome += ` (${it.size})`;
    }

    const unitPrice = getUnitPrice(it);
    const subtotal = unitPrice != null ? getQtd(it) * unitPrice : undefined;
    const priceStr =
      job.tipo === "pedido_completo" && typeof subtotal === "number"
        ? money(subtotal)
        : "";
    parts.push(BOLD_ON, encode(pad2(cols, `${qtd} ${nome}`, priceStr), enc), BOLD_OFF);

    if (it.second_flavor) {
      parts.push(encode(wrap(`+ 2ª metade: ${it.second_flavor}`, cols, 2), enc));
    }

    for (const a of getAddons(it)) {
      const aStr = addonToStr(a);
      if (aStr) parts.push(encode(wrap(`+ ${aStr}`, cols, 2), enc));
    }

    for (const r of getRemocoes(it)) {
      parts.push(BOLD_ON, encode(wrap(`- SEM ${r.toUpperCase()}`, cols, 2), enc), BOLD_OFF);
    }

    if (it.observacao) {
      parts.push(encode(wrap(`Obs: ${it.observacao}`, cols, 2), enc));
    }
  }

  const obsPedido = order.observacoes_operador || order.notes;
  if (obsPedido) {
    parts.push(encode(line(cols), enc));
    parts.push(BOLD_ON, encode("OBS DO PEDIDO:\n", enc), BOLD_OFF);
    parts.push(encode(wrap(obsPedido, cols), enc));
  }

  if (job.tipo === "pedido_completo") {
    parts.push(encode(line(cols), enc));

    const total = order.total ?? items.reduce(
      (sum, it) => sum + (getUnitPrice(it) ?? 0) * getQtd(it),
      0
    );

    if (total > 0) {
      parts.push(BOLD_ON, DBL_ON);
      parts.push(encode(pad2(Math.floor(cols / 2), "TOTAL", money(total)), enc));
      parts.push(DBL_OFF, BOLD_OFF);
    }

    const pagto = order.tipo_pagamento || order.meio_pagamento;
    if (pagto) {
      parts.push(encode(`Pagto: ${pagto}\n`, enc));
    } else if (order.notes) {
      const match = order.notes.match(/Forma de pagamento:\s*(.+)/i);
      if (match) {
        parts.push(encode(`Pagto: ${match[1].trim()}\n`, enc));
      }
    }
  }

  parts.push(FEED(3), CUT);
  return Buffer.concat(parts);
}