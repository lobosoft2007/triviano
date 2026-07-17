import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { ReportShell } from "./ReportShell";
import { ChartRenderer } from "./ChartRenderer";
import { runReportQuery } from "@/lib/reports/reports.functions";
import type { ReportSpec } from "@/lib/reports/spec";
import type { ReportColumn } from "@/lib/reports/types";
import { formatBRL } from "@/lib/format";

interface Props {
  spec: ReportSpec;
}

function formatValue(v: unknown, money: boolean): React.ReactNode {
  if (v == null) return "—";
  if (money) return formatBRL(Number(v) || 0);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    try {
      return new Date(v).toLocaleString("pt-BR");
    } catch {
      return v;
    }
  }
  return String(v);
}

export function ReportSpecRunner({ spec }: Props) {
  const runFn = useServerFn(runReportQuery);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-spec-run", spec],
    queryFn: () => runFn({ data: { spec } }),
    staleTime: 30_000,
  });

  const columns: ReportColumn<Record<string, any>>[] = useMemo(
    () =>
      spec.columns.map((c) => ({
        key: c.key,
        label: c.label,
        money: !!c.money,
        numeric: !!c.money || c.agg != null,
        sum: c.money ? (r) => Number(r[c.key]) || 0 : undefined,
        render: (r) => formatValue(r[c.key], !!c.money),
      })),
    [spec.columns],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Falha ao rodar relatório: {String((error as Error).message)}
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div>
      <ReportShell
        slug={`ia-${spec.dataSource}`}
        title={spec.title}
        columns={columns}
        defaultVisible={columns.map((c) => c.key)}
        rows={rows}
        loading={isLoading}
      />
      {spec.chart ? (
        <div className="print:block">
          <ChartRenderer spec={spec} rows={rows} />
        </div>
      ) : null}
    </div>
  );
}
