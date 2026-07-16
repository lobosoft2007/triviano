import { formatBRL } from "@/lib/format";
import type { CaixaOrder } from "@/lib/caixa";
import { EscPos } from "@/lib/thermal-printer";

/**
 * Build ESC/POS bytes for the "conta / conferência da mesa" coupon.
 *
 * Mirrors the fields of the printable `<BillReceipt>` React component, but
 * as raw bytes for direct thermal printing (no browser print dialog).
 */
export function buildMesaBillEscPos(input: {
  restaurantName: string;
  mesa: number;
  orders: CaixaOrder[];
  total: number;
  pixKey?: string;
  pixName?: string;
  brcode?: string;
  mpDynamic?: boolean;
}): Uint8Array {
  const {
    restaurantName,
    mesa,
    orders,
    total,
    pixKey,
    pixName,
    brcode,
    mpDynamic,
  } = input;
  const items = orders.flatMap((o) => o.order_items);
  const subtotal = orders.reduce(
    (s, o) =>
      s + o.order_items.reduce((a, it) => a + it.unit_price * it.quantity, 0),
    0,
  );
  const discount = orders.reduce((s, o) => s + o.discount, 0);

  const p = new EscPos().init();

  p.align("center").bold(true).line(restaurantName || "");
  p.line(`CONTA - MESA ${mesa || "-"}`);
  p.bold(false).line(new Date().toLocaleString("pt-BR"));
  p.line("-".repeat(42));

  p.align("left");
  for (const it of items) {
    p.line(twoCol(
      `${it.quantity}x ${it.product_name}`,
      formatBRL(it.unit_price * it.quantity),
    ));
  }
  p.line("-".repeat(42));

  p.line(twoCol("Subtotal", formatBRL(subtotal)));
  if (discount > 0) {
    p.line(twoCol("Desconto", `- ${formatBRL(discount)}`));
  }
  p.bold(true).line(twoCol("TOTAL", formatBRL(total))).bold(false);
  p.line("-".repeat(42));

  p.align("center").bold(true).line(`Pague com PIX - ${formatBRL(total)}`);
  p.bold(false);
  if (mpDynamic) {
    p.line("Pagamento via Mercado Pago");
    p.line("Baixa automatica apos confirmar");
  } else if (pixKey) {
    p.line(`Chave: ${pixKey}`);
    if (pixName) p.line(pixName);
  }
  if (brcode) {
    p.newline();
    p.line("PIX Copia e Cola:");
    // Wrap brcode across lines (thermal 80mm ~ 42 chars).
    for (const chunk of wrap(brcode, 42)) p.line(chunk);
  }
  p.newline().line("Obrigado pela visita!");
  p.feed(3).cut();
  return p.bytes();
}

const LINE_WIDTH = 42;

function twoCol(left: string, right: string): string {
  const l = truncate(left, LINE_WIDTH - right.length - 1);
  const gap = Math.max(1, LINE_WIDTH - l.length - right.length);
  return l + " ".repeat(gap) + right;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + "…";
}

function wrap(s: string, width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += width) out.push(s.slice(i, i + width));
  return out;
}
