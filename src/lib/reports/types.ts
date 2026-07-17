import { formatBRL } from "@/lib/format";

/** A single column definition for a report. */
export interface ReportColumn<T> {
  /** Stable identifier used to persist visibility preferences. */
  key: string;
  /** Header shown in the table and column-picker. */
  label: string;
  /** Cell value. Returns any renderable JSX / string. */
  render: (row: T) => React.ReactNode;
  /** Sum this column at the footer (formatted as BRL). */
  money?: boolean;
  /** Numeric extractor used when `money=true`. */
  sum?: (row: T) => number;
  /** Right-aligned column. */
  numeric?: boolean;
  /** Minimum column width (helps A4 layout). */
  minWidth?: string;
  /** Hidden by default (still selectable). */
  defaultHidden?: boolean;
}

export type ReportOrientation = "portrait" | "landscape";

export interface ReportPrefs {
  visible: string[]; // ordered list of visible column keys
  fontFamily: string;
  fontSize: number;
  orientation: ReportOrientation;
}

export const REPORT_FONTS: { label: string; value: string }[] = [
  { label: "Inter (Sans)", value: '"Inter", ui-sans-serif, system-ui, sans-serif' },
  { label: "Outfit (Display)", value: '"Outfit", ui-sans-serif, system-ui, sans-serif' },
  { label: "Roboto", value: '"Roboto", ui-sans-serif, system-ui, sans-serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia (Serif)", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Courier New (Mono)", value: '"Courier New", ui-monospace, monospace' },
];

const PREFS_KEY = (slug: string) => `report:${slug}:prefs`;

export function loadPrefs(slug: string, defaults: ReportPrefs): ReportPrefs {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(PREFS_KEY(slug));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ReportPrefs>;
    return {
      visible: Array.isArray(parsed.visible) ? parsed.visible : defaults.visible,
      fontFamily: parsed.fontFamily || defaults.fontFamily,
      fontSize: Number(parsed.fontSize) || defaults.fontSize,
      orientation:
        parsed.orientation === "landscape" ? "landscape" : defaults.orientation,
    };
  } catch {
    return defaults;
  }
}

export function savePrefs(slug: string, prefs: ReportPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY(slug), JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

export function sumMoneyColumns<T>(rows: T[], cols: ReportColumn<T>[]) {
  const totals: Record<string, number> = {};
  for (const col of cols) {
    if (!col.money || !col.sum) continue;
    totals[col.key] = rows.reduce((acc, r) => acc + (Number(col.sum!(r)) || 0), 0);
  }
  return totals;
}

export function formatMoney(v: number): string {
  return formatBRL(v);
}

/**
 * Trigger the browser's print dialog with A4 page rules and a body class
 * that isolates the report container from the rest of the app. Coexists with
 * the 80mm thermal-receipt print rule (which requires `.thermal-receipt`).
 */
export function printReport() {
  const style = document.createElement("style");
  style.id = "report-print-page";
  style.textContent = `@media print { @page { size: A4 portrait; margin: 14mm 12mm 20mm 12mm; } }`;
  document.head.appendChild(style);
  document.body.classList.add("printing-report");
  const cleanup = () => {
    document.body.classList.remove("printing-report");
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

/** Escape a value for CSV (RFC 4180-ish). */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Renders a plain-text version of a column cell for CSV export.
 * Uses `csvValue` when supplied, otherwise falls back to `render` if it
 * returns a primitive.
 */
export function exportCsv<T>(
  slug: string,
  rows: T[],
  cols: ReportColumn<T>[],
  csvValue: (row: T, col: ReportColumn<T>) => string | number,
) {
  const header = cols.map((c) => csvCell(c.label)).join(";");
  const body = rows
    .map((r) => cols.map((c) => csvCell(csvValue(r, c))).join(";"))
    .join("\n");
  const bom = "\uFEFF"; // Excel-friendly UTF-8
  const blob = new Blob([bom + header + "\n" + body], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${slug}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
