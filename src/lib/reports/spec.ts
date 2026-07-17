import { z } from "zod";

/** Supported data sources for the AI-generated reports. */
export const DATA_SOURCES = ["clientes", "vendas", "produtos_estoque"] as const;
export type ReportDataSource = (typeof DATA_SOURCES)[number];

export const FILTER_OPS = [
  "eq",
  "neq",
  "gte",
  "lte",
  "between",
  "in",
  "like",
  "is_null",
  "not_null",
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const AGGREGATIONS = ["sum", "count", "avg", "min", "max"] as const;
export type AggregationFn = (typeof AGGREGATIONS)[number];

export const CHART_TYPES = ["bar", "line", "pie", "area"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** JSON schema returned by the AI. Kept flat / constraint-free for structured output. */
export const ReportSpecSchema = z.object({
  title: z.string(),
  dataSource: z.enum(DATA_SOURCES),
  filters: z.array(
    z.object({
      field: z.string(),
      op: z.enum(FILTER_OPS),
      value: z.any(),
    }),
  ),
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      agg: z.enum(AGGREGATIONS).nullable(),
      money: z.boolean().nullable(),
    }),
  ),
  groupBy: z.array(z.string()).nullable(),
  orderBy: z
    .array(
      z.object({
        field: z.string(),
        dir: z.enum(["asc", "desc"]),
      }),
    )
    .nullable(),
  limit: z.number().nullable(),
  chart: z
    .object({
      type: z.enum(CHART_TYPES),
      x: z.string(),
      y: z.string(),
      series: z.string().nullable(),
    })
    .nullable(),
  orientation: z.enum(["portrait", "landscape"]).nullable(),
  clarify: z.string().nullable(),
});

export type ReportSpec = z.infer<typeof ReportSpecSchema>;

export const HARD_LIMIT = 5000;
export const DEFAULT_LIMIT = 500;

/** Clamp/normalize a spec after AI generation. */
export function normalizeSpec(spec: ReportSpec): ReportSpec {
  return {
    ...spec,
    limit: Math.min(HARD_LIMIT, Math.max(1, spec.limit ?? DEFAULT_LIMIT)),
    groupBy: spec.groupBy ?? [],
    orderBy: spec.orderBy ?? [],
    orientation: spec.orientation ?? "portrait",
  };
}
