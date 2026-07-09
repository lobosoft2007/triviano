import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/format";
import type { ProjecaoDia } from "@/lib/tesouraria";

/**
 * Cash-flow projection chart. Extracted into its own module so `recharts`
 * (a heavy dependency) is code-split and lazy-loaded only when the admin
 * Treasury tab is actually opened, keeping the initial PWA bundle small.
 */
export default function TesourariaChart({ data }: { data: ProjecaoDia[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval={4}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={64}
          stroke="currentColor"
          className="text-muted-foreground"
          tickFormatter={(v) => formatBRL(Number(v))}
        />
        <Tooltip
          formatter={(v: number) => formatBRL(Number(v))}
          labelFormatter={(l) => `Dia ${l}`}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card)",
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="saldoAcumulado"
          name="Saldo projetado"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
