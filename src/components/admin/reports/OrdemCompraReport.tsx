import { forwardRef, type CSSProperties } from "react";
import type { EmpresaBranding } from "@/lib/empresa";
import { formatBRL } from "@/lib/format";

export interface OrdemCompraReportRow {
  nome: string;
  tipo: "insumo" | "produto" | "livre";
  setor: string;
  fornecedor: string;
  unidade: string;
  quantidade: number;
  custo_unitario: number;
}

interface OrdemCompraReportProps {
  empresa: EmpresaBranding | undefined;
  rows: OrdemCompraReportRow[];
  observacao: string;
  orientation?: "portrait" | "landscape";
}

/**
 * A4 portrait report for a manual purchase order.
 *
 * IMPORTANT: colors, borders and backgrounds are declared with inline
 * hex/rgb styles (never Tailwind color utilities). Tailwind v4 emits
 * `oklch(...)` / `color-mix(in oklab, ...)` colors that html2canvas
 * (used by html2pdf.js) cannot parse — that crashes the PDF/WhatsApp
 * export with "Attempting to parse an unsupported color function oklch".
 * Keep this file free of color classes so both `window.print()` and PDF
 * export stay reliable.
 */
export const OrdemCompraReport = forwardRef<HTMLDivElement, OrdemCompraReportProps>(
  function OrdemCompraReport({ empresa, rows, observacao, orientation = "landscape" }, ref) {
    const total = rows.reduce((s, r) => s + r.quantidade * r.custo_unitario, 0);
    const now = new Date();
    const isLandscape = orientation === "landscape";
    const dataHora = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString(
      "pt-BR",
      { hour: "2-digit", minute: "2-digit" },
    )}`;

    const grupos = new Map<string, OrdemCompraReportRow[]>();
    for (const row of rows) {
      const key = row.fornecedor || "Sem fornecedor";
      const arr = grupos.get(key) ?? [];
      arr.push(row);
      grupos.set(key, arr);
    }
    const gruposOrdenados = Array.from(grupos.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );

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

    // Palette — pure hex, no oklch.
    const C = {
      text: "#111111",
      muted: "#555555",
      soft: "#777777",
      line: "#333333",
      lineSoft: "#cccccc",
      lineFaint: "#e5e5e5",
      band: "#f2f2f2",
    };

    const th: CSSProperties = {
      padding: "4px 5px",
      textAlign: "left",
      fontWeight: 600,
      fontSize: "9pt",
      textTransform: "uppercase",
      color: C.muted,
      borderBottom: `1px solid ${C.lineSoft}`,
      whiteSpace: "nowrap",
    };
    const td: CSSProperties = {
      padding: "4px 5px",
      verticalAlign: "top",
      borderBottom: `1px solid ${C.lineFaint}`,
      color: C.text,
      overflowWrap: "anywhere",
    };
    const num: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

    return (
      <div
        ref={ref}
        className="report-a4"
        style={{
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
          fontSize: "10pt",
          boxSizing: "border-box",
          maxWidth: isLandscape ? "273mm" : "186mm",
          width: isLandscape ? "273mm" : "186mm",
          background: "#ffffff",
          color: C.text,
          padding: "0 0 14px 0",
        }}
      >
        <div
          className="report-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderBottom: `1px solid ${C.line}`,
            paddingBottom: "8px",
          }}
        >
          <img
            src={empresa?.logo_display_url || "/logo.png"}
            alt={empresa?.nome_fantasia || "Logotipo"}
            style={{ height: "40px", width: "auto", maxWidth: "120px", objectFit: "contain" }}
          />
          <h1
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "15px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              margin: 0,
            }}
          >
            Ordem de Compra — Sugestão
          </h1>
          <span
            className="report-pagenum"
            style={{
              minWidth: "80px",
              textAlign: "right",
              fontSize: "11px",
              fontVariantNumeric: "tabular-nums",
              color: C.muted,
            }}
          />

        </div>

        <div className="report-content" style={{ paddingTop: "12px" }}>
          <div
            style={{
              marginBottom: "12px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "8px",
              fontSize: "10pt",
            }}
          >
            <div>
              <span style={{ color: C.soft }}>Emitido em:</span>{" "}
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{dataHora}</b>
            </div>
            <div>
              <span style={{ color: C.soft }}>Itens:</span>{" "}
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{rows.length}</b>
            </div>
            <div>
              <span style={{ color: C.soft }}>Total previsto:</span>{" "}
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(total)}</b>
            </div>
          </div>

          {observacao ? (
            <p
              style={{
                marginBottom: "12px",
                border: `1px solid ${C.lineSoft}`,
                background: "#fafafa",
                padding: "4px 8px",
                fontSize: "10pt",
                borderRadius: "3px",
              }}
            >
              <b>Observação:</b> {observacao}
            </p>
          ) : null}

          {rows.length === 0 ? (
            <p style={{ padding: "40px 0", textAlign: "center", color: C.soft }}>
              Nenhum item selecionado.
            </p>
          ) : (
            gruposOrdenados.map(([fornNome, itens]) => {
              const subtotal = itens.reduce(
                (s, r) => s + r.quantidade * r.custo_unitario,
                0,
              );
              return (
                <div key={fornNome} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: `1px solid ${C.line}`,
                      background: C.band,
                      padding: "4px 8px",
                      fontSize: "10.5pt",
                      fontWeight: 700,
                    }}
                  >
                    <span>{fornNome}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(subtotal)}</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: isLandscape ? "42%" : "34%" }} />
                      <col style={{ width: isLandscape ? "18%" : "16%" }} />
                      <col style={{ width: isLandscape ? "12%" : "14%" }} />
                      <col style={{ width: isLandscape ? "14%" : "17%" }} />
                      <col style={{ width: isLandscape ? "14%" : "19%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={th}>Item</th>
                        <th style={th}>Setor</th>
                        <th style={{ ...th, ...num }}>Qtd</th>
                        <th style={{ ...th, ...num }}>Custo un.</th>
                        <th style={{ ...th, ...num }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((r, i) => (
                        <tr key={i} style={{ pageBreakInside: "avoid" }}>
                          <td style={td}>{r.nome}</td>
                          <td style={{ ...td, color: C.muted }}>{r.setor || "—"}</td>
                          <td style={{ ...td, ...num }}>
                            {r.quantidade} {r.unidade}
                          </td>
                          <td style={{ ...td, ...num }}>{formatBRL(r.custo_unitario)}</td>
                          <td style={{ ...td, ...num, fontWeight: 600 }}>
                            {formatBRL(r.quantidade * r.custo_unitario)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              borderTop: `2px solid ${C.line}`,
              paddingTop: "8px",
              fontSize: "12pt",
            }}
          >
            <span style={{ marginRight: "12px", fontWeight: 600 }}>TOTAL GERAL</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {formatBRL(total)}
            </span>
          </div>
        </div>

        <div
          className="report-footer"
          style={{
            borderTop: `1px solid ${C.line}`,
            paddingTop: "7px",
            paddingBottom: "6px",
            fontSize: "11px",
            lineHeight: 1.4,
            color: C.muted,
            marginTop: "24px",
            overflow: "visible",
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              lineHeight: "18px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {razao}
            {cnpj}{enderecoParts ? ` · ${enderecoParts}` : ""}
          </p>
        </div>
      </div>
    );
  },
);
