import { forwardRef } from "react";
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
}

/**
 * A4 portrait report for a manual purchase order. Rendered off-screen and
 * used both for `window.print()` and for html2pdf.js when sharing via
 * WhatsApp. Uses the same `.report-a4 / .report-header / .report-content /
 * .report-footer` skeleton as the rest of the report framework so the print
 * CSS in `src/styles.css` picks it up automatically.
 */
export const OrdemCompraReport = forwardRef<HTMLDivElement, OrdemCompraReportProps>(
  function OrdemCompraReport({ empresa, rows, observacao }, ref) {
    const total = rows.reduce((s, r) => s + r.quantidade * r.custo_unitario, 0);
    const now = new Date();
    const dataHora = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString(
      "pt-BR",
      { hour: "2-digit", minute: "2-digit" },
    )}`;

    // Group by fornecedor for a compact printed layout.
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

    return (
      <div
        ref={ref}
        className="report-a4 bg-white p-6 text-neutral-900"
        style={{
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
          fontSize: "10.5pt",
          maxWidth: "210mm",
          width: "210mm",
        }}
      >
        <div className="report-header flex items-center gap-3 border-b border-black/60 pb-2">
          <img
            src={empresa?.logo_display_url || "/logo.png"}
            alt={empresa?.nome_fantasia || "Logotipo"}
            className="h-10 w-auto max-w-[120px] object-contain"
          />
          <h1 className="flex-1 text-center text-[15px] font-bold uppercase tracking-wide">
            Ordem de Compra — Sugestão
          </h1>
          <span className="report-pagenum min-w-[80px] text-right text-[11px] tabular-nums text-neutral-700">
            Pág 1 / 1
          </span>
        </div>

        <div className="report-content pt-3">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[10pt]">
            <div>
              <span className="text-neutral-500">Emitido em:</span>{" "}
              <b className="tabular-nums">{dataHora}</b>
            </div>
            <div>
              <span className="text-neutral-500">Itens:</span>{" "}
              <b className="tabular-nums">{rows.length}</b>
            </div>
            <div>
              <span className="text-neutral-500">Total previsto:</span>{" "}
              <b className="tabular-nums">{formatBRL(total)}</b>
            </div>
          </div>

          {observacao ? (
            <p className="mb-3 rounded border border-black/20 bg-neutral-50 px-2 py-1 text-[10pt]">
              <b>Observação:</b> {observacao}
            </p>
          ) : null}

          {rows.length === 0 ? (
            <p className="py-10 text-center text-neutral-500">
              Nenhum item selecionado.
            </p>
          ) : (
            gruposOrdenados.map(([fornNome, itens]) => {
              const subtotal = itens.reduce(
                (s, r) => s + r.quantidade * r.custo_unitario,
                0,
              );
              return (
                <div key={fornNome} className="mb-4" style={{ pageBreakInside: "avoid" }}>
                  <div className="flex items-center justify-between border-b border-black/40 bg-neutral-100 px-2 py-1 text-[10.5pt] font-bold">
                    <span>{fornNome}</span>
                    <span className="tabular-nums">{formatBRL(subtotal)}</span>
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-black/30 text-left text-[9.5pt] uppercase text-neutral-700">
                        <th className="px-1.5 py-1 font-semibold">Item</th>
                        <th className="px-1.5 py-1 font-semibold">Setor</th>
                        <th className="px-1.5 py-1 text-right font-semibold">Qtd</th>
                        <th className="px-1.5 py-1 text-right font-semibold">Custo un.</th>
                        <th className="px-1.5 py-1 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-black/10 align-top"
                          style={{ pageBreakInside: "avoid" }}
                        >
                          <td className="px-1.5 py-1">{r.nome}</td>
                          <td className="px-1.5 py-1 text-neutral-700">{r.setor || "—"}</td>
                          <td className="px-1.5 py-1 text-right tabular-nums">
                            {r.quantidade} {r.unidade}
                          </td>
                          <td className="px-1.5 py-1 text-right tabular-nums">
                            {formatBRL(r.custo_unitario)}
                          </td>
                          <td className="px-1.5 py-1 text-right font-semibold tabular-nums">
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

          <div className="mt-4 flex items-center justify-end border-t-2 border-black/60 pt-2 text-[12pt]">
            <span className="mr-3 font-semibold">TOTAL GERAL</span>
            <span className="font-bold tabular-nums">{formatBRL(total)}</span>
          </div>
        </div>

        <div className="report-footer border-t border-black/60 pt-1.5 text-[10px] leading-tight text-neutral-700">
          <p className="font-semibold">
            {razao}
            {cnpj}
          </p>
          <p>{enderecoParts || "—"}</p>
        </div>
      </div>
    );
  },
);
