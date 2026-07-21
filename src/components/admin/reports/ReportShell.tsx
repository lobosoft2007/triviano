import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, Columns3, Type, Loader2, RectangleVertical, RectangleHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

import { empresaAdminConfigQueryOptions, type EmpresaBranding } from "@/lib/empresa";
import {
  REPORT_FONTS,
  exportCsv,
  formatMoney,
  loadPrefs,
  printReport,
  savePrefs,
  sumMoneyColumns,
  type ReportColumn,
  type ReportPrefs,
} from "@/lib/reports/types";

/* ------------------------------------------------------------------ */
/* Header / Footer (repeated on each printed page via table groups)    */
/* ------------------------------------------------------------------ */

function ReportHeader({
  empresa,
  title,
}: {
  empresa: EmpresaBranding | undefined;
  title: string;
}) {
  return (
    <div className="report-header flex items-center gap-3 border-b border-black/60 pb-2">
      <img
        src={empresa?.logo_display_url || "/logo.png"}
        alt={empresa?.nome_fantasia || "Logotipo"}
        className="h-10 w-auto max-w-[120px] object-contain"
      />
      <h1 className="flex-1 text-center text-[15px] font-bold uppercase tracking-wide">
        {title}
      </h1>
      <span className="report-pagenum min-w-[80px] text-right text-[11px] tabular-nums text-neutral-700">
        Pág 1 / 1
      </span>
    </div>
  );
}

function ReportFooter({ empresa }: { empresa: EmpresaBranding | undefined }) {
  const razao = empresa?.nome_fantasia || "";
  const cnpj = empresa?.cnpj ? ` — CNPJ ${empresa.cnpj}` : "";
  const enderecoParts = [
    [empresa?.logradouro, empresa?.numero].filter(Boolean).join(", "),
    empresa?.complemento,
    empresa?.bairro,
    [empresa?.cidade, empresa?.estado].filter(Boolean).join(" / "),
    empresa?.cep ? `CEP ${empresa.cep}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="report-footer border-t border-black/60 pt-1.5 text-[10px] leading-tight text-neutral-700">
      <p className="font-semibold">
        {razao}
        {cnpj}
      </p>
      <p>{enderecoParts || "—"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar controls                                                    */
/* ------------------------------------------------------------------ */

function ColumnPicker<T>({
  columns,
  visible,
  onChange,
}: {
  columns: ReportColumn<T>[];
  visible: string[];
  onChange: (next: string[]) => void;
}) {
  const isVisible = (k: string) => visible.includes(k);
  const toggle = (k: string) => {
    if (isVisible(k)) onChange(visible.filter((v) => v !== k));
    else onChange([...columns.map((c) => c.key).filter((c) => c === k || visible.includes(c))]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="h-4 w-4" /> Colunas
          <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] font-semibold">
            {visible.length}/{columns.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-muted-foreground">
            Incluir colunas
          </p>
          <button
            type="button"
            className="text-[11px] font-medium text-primary hover:underline"
            onClick={() => onChange(columns.map((c) => c.key))}
          >
            Marcar todas
          </button>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {columns.map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <Checkbox
                checked={isVisible(c.key)}
                onCheckedChange={() => toggle(c.key)}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FontPicker({
  fontFamily,
  fontSize,
  onChange,
}: {
  fontFamily: string;
  fontSize: number;
  onChange: (patch: Partial<{ fontFamily: string; fontSize: number }>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Type className="h-4 w-4" /> Fonte
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Família</Label>
          <Select
            value={fontFamily}
            onValueChange={(v) => onChange({ fontFamily: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tamanho: {fontSize}pt</Label>
          <Slider
            value={[fontSize]}
            min={8}
            max={16}
            step={1}
            onValueChange={([v]) => onChange({ fontSize: v })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface ReportShellProps<T> {
  /** Persist key (also used as CSV filename prefix). */
  slug: string;
  /** Title displayed in the header of every printed page. */
  title: string;
  /** All available columns. */
  columns: ReportColumn<T>[];
  /** Column keys that start visible (order preserved). */
  defaultVisible: string[];
  /** Filter UI rendered above the report body. */
  filters?: ReactNode;
  /** Filtered rows ready to render. */
  rows: T[];
  /** Optional loading flag. */
  loading?: boolean;
  /** Initial A4 orientation before the user changes it. */
  defaultOrientation?: ReportPrefs["orientation"];
  /** CSV cell extractor (defaults to using `render` when it is a primitive). */
  csvValue?: (row: T, col: ReportColumn<T>) => string | number;
}

export function ReportShell<T>({
  slug,
  title,
  columns,
  defaultVisible,
  filters,
  rows,
  loading,
  defaultOrientation = "portrait",
  csvValue,
}: ReportShellProps<T>) {
  const { data: empresa } = useQuery(empresaAdminConfigQueryOptions);

  const defaults: ReportPrefs = useMemo(
    () => ({
      visible: defaultVisible,
      fontFamily: REPORT_FONTS[0].value,
      fontSize: 11,
      orientation: defaultOrientation,
    }),
    [defaultVisible, defaultOrientation],
  );

  const [prefs, setPrefs] = useState<ReportPrefs>(() => loadPrefs(slug, defaults));

  const updatePrefs = (patch: Partial<ReportPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(slug, next);
      return next;
    });
  };

  const visibleCols = useMemo(
    () => columns.filter((c) => prefs.visible.includes(c.key)),
    [columns, prefs.visible],
  );
  const visibleColSpan = Math.max(visibleCols.length, 1);

  const totals = useMemo(
    () => sumMoneyColumns(rows, visibleCols),
    [rows, visibleCols],
  );

  const extractCsv =
    csvValue ??
    ((row: T, col: ReportColumn<T>) => {
      const rendered = col.render(row);
      if (rendered == null) return "";
      if (typeof rendered === "string" || typeof rendered === "number")
        return rendered;
      return String(rendered);
    });

  return (
    <div className="space-y-3">
      {/* Toolbar (screen-only) */}
      <div className="report-toolbar flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 print:hidden">
        <div className="flex-1 min-w-0">{filters}</div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnPicker
            columns={columns}
            visible={prefs.visible}
            onChange={(v) => updatePrefs({ visible: v })}
          />
          <FontPicker
            fontFamily={prefs.fontFamily}
            fontSize={prefs.fontSize}
            onChange={updatePrefs}
          />
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => updatePrefs({ orientation: "portrait" })}
              className={
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition " +
                (prefs.orientation === "portrait"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary")
              }
              title="Retrato"
            >
              <RectangleVertical className="h-3.5 w-3.5" /> Retrato
            </button>
            <button
              type="button"
              onClick={() => updatePrefs({ orientation: "landscape" })}
              className={
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition " +
                (prefs.orientation === "landscape"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary")
              }
              title="Paisagem"
            >
              <RectangleHorizontal className="h-3.5 w-3.5" /> Paisagem
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              exportCsv(slug, rows, visibleCols, extractCsv)
            }
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => printReport(prefs.orientation, slug)}
            disabled={rows.length === 0}
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Report body (also target of window.print()) */}
      <div
        className="report-a4 mx-auto rounded-xl border border-border bg-white p-6 text-neutral-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
        data-report-slug={slug}
        data-report-orientation={prefs.orientation}
        style={{
          fontFamily: prefs.fontFamily,
          fontSize: `${prefs.fontSize}pt`,
          maxWidth: prefs.orientation === "landscape" ? "297mm" : "210mm",
        }}
      >
        <table className="report-print-table w-full border-collapse">
          <thead className="report-print-head">
            <tr className="report-header-row">
              <th colSpan={visibleColSpan} className="report-header-cell p-0 pb-3">
                <ReportHeader empresa={empresa} title={title} />
              </th>
            </tr>
            {!loading && rows.length > 0 && visibleCols.length > 0 ? (
              <tr className="report-column-head border-b border-black/40 text-left">
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    data-report-col={c.key}
                    className={
                      "px-1.5 py-1 font-semibold " +
                      (c.numeric ? "text-right" : "")
                    }
                    style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody className="report-print-body">
            {loading ? (
              <tr>
                <td colSpan={visibleColSpan}>
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColSpan}>
                  <p className="py-10 text-center text-neutral-500">
                    Nenhum registro encontrado com os filtros selecionados.
                  </p>
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="report-data-row border-b border-black/10 align-top"
                  >
                    {visibleCols.map((c) => (
                      <td
                        key={c.key}
                        data-report-col={c.key}
                        className={
                          "px-1.5 py-1 " + (c.numeric ? "text-right tabular-nums" : "")
                        }
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {Object.keys(totals).length > 0 && (
                  <tr className="report-summary-row border-t-2 border-black/60 font-semibold">
                    {visibleCols.map((c, i) => (
                      <td
                        key={c.key}
                        className={
                          "px-1.5 py-1.5 " +
                          (c.numeric ? "text-right tabular-nums" : "")
                        }
                      >
                        {i === 0
                          ? "TOTAIS"
                          : c.money
                            ? formatMoney(totals[c.key] ?? 0)
                            : ""}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="report-total-row">
                  <td
                    colSpan={visibleColSpan}
                    className="px-1.5 pt-2 text-[11px] text-neutral-700"
                  >
                    Total de registros: <b>{rows.length}</b>
                  </td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot className="report-print-foot">
            <tr className="report-footer-row">
              <td colSpan={visibleColSpan} className="report-footer-cell p-0 pt-3">
                <ReportFooter empresa={empresa} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
