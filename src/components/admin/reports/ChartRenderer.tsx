import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ReportSpec } from "@/lib/reports/spec";

const COLORS = ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

interface Props {
  spec: ReportSpec;
  rows: Record<string, any>[];
}

export function ChartRenderer({ spec, rows }: Props) {
  const chart = spec.chart;
  if (!chart || rows.length === 0) return null;

  const data = rows.map((r) => ({ ...r, [chart.x]: String(r[chart.x] ?? "—") }));

  return (
    <div className="my-4 h-72 w-full print:h-64">
      <ResponsiveContainer width="100%" height="100%">
        {chart.type === "bar" ? (
          <BarChart data={data}>
            <XAxis dataKey={chart.x} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={chart.y} fill={COLORS[0]} />
          </BarChart>
        ) : chart.type === "line" ? (
          <LineChart data={data}>
            <XAxis dataKey={chart.x} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={chart.y} stroke={COLORS[0]} />
          </LineChart>
        ) : chart.type === "area" ? (
          <AreaChart data={data}>
            <XAxis dataKey={chart.x} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey={chart.y} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.35} />
          </AreaChart>
        ) : (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey={chart.y} nameKey={chart.x} outerRadius={90} label>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
