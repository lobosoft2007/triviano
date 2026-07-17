import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ReportSpecSchema, normalizeSpec, type ReportSpec } from "./spec";
import { getDataSource, getField } from "./datasources";

/* ------------------------------------------------------------------ */
/* Types shared with the UI                                            */
/* ------------------------------------------------------------------ */

export interface RunReportResult {
  rows: Record<string, any>[];
  totals: Record<string, number>;
  spec: ReportSpec;
}

export interface RelatorioSalvo {
  id: string;
  nome: string;
  descricao: string | null;
  spec: ReportSpec;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validateSpec(spec: ReportSpec): ReportSpec {
  const ds = getDataSource(spec.dataSource);
  const known = new Set(ds.fields.map((f) => f.key));

  for (const f of spec.filters) {
    const field = getField(spec.dataSource, f.field);
    if (!field.ops.includes(f.op))
      throw new Error(`Operador "${f.op}" não permitido em "${f.field}".`);
  }
  for (const c of spec.columns) {
    if (!known.has(c.key))
      throw new Error(`Coluna "${c.key}" não existe em "${spec.dataSource}".`);
  }
  for (const g of spec.groupBy ?? []) {
    const field = getField(spec.dataSource, g);
    if (!field.groupable)
      throw new Error(`Campo "${g}" não pode ser agrupado.`);
  }
  for (const o of spec.orderBy ?? []) {
    if (!known.has(o.field))
      throw new Error(`Ordenação por "${o.field}" inválida.`);
  }
  return normalizeSpec(spec);
}

/* ------------------------------------------------------------------ */
/* Query builders (one per whitelisted data source)                    */
/* ------------------------------------------------------------------ */

type SB = SupabaseClient;

function applyFilters(q: any, spec: ReportSpec) {
  for (const f of spec.filters) {
    const v = f.value;
    switch (f.op) {
      case "eq": q = q.eq(f.field, v); break;
      case "neq": q = q.neq(f.field, v); break;
      case "gte": q = q.gte(f.field, v); break;
      case "lte": q = q.lte(f.field, v); break;
      case "between":
        if (Array.isArray(v) && v.length === 2) q = q.gte(f.field, v[0]).lte(f.field, v[1]);
        break;
      case "in": if (Array.isArray(v)) q = q.in(f.field, v); break;
      case "like": q = q.ilike(f.field, `%${String(v)}%`); break;
      case "is_null": q = q.is(f.field, null); break;
      case "not_null": q = q.not(f.field, "is", null); break;
    }
  }
  return q;
}

function applyOrderLimit(q: any, spec: ReportSpec) {
  for (const o of spec.orderBy ?? []) q = q.order(o.field, { ascending: o.dir === "asc" });
  return q.limit(spec.limit ?? 500);
}

async function runClientes(supabase: SB, spec: ReportSpec) {
  // profiles table used as cliente source
  const columns = spec.columns.map((c) => c.key);
  const projection = Array.from(
    new Set(["id", ...columns, ...(spec.groupBy ?? []), ...(spec.orderBy ?? []).map((o) => o.field)]),
  );
  // Map spec keys to real profile columns
  const map: Record<string, string> = {
    nome: "full_name",
    telefone: "phone",
    saldo_devedor_fiado: "saldo_devedor_fiado",
    cashback: "saldo_cashback",
    limite_fiado: "limite_fiado",
  };
  const dbCols = projection.map((c) => map[c] ?? c);
  const select = Array.from(new Set(dbCols)).join(",");
  let q = supabase.from("profiles").select(select);
  // Filters: translate too
  const specWithMapped: ReportSpec = {
    ...spec,
    filters: spec.filters.map((f) => ({ ...f, field: map[f.field] ?? f.field })),
    orderBy: (spec.orderBy ?? []).map((o) => ({ ...o, field: map[o.field] ?? o.field })),
  };
  q = applyFilters(q, specWithMapped);
  q = applyOrderLimit(q, specWithMapped);
  const { data, error } = await q;
  if (error) throw error;
  // Reverse-map back to spec keys
  const rev = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
  return (data ?? []).map((row: any) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[rev[k] ?? k] = v;
    return out;
  });
}

async function runVendas(supabase: SB, spec: ReportSpec) {
  const cols = Array.from(
    new Set(["id", ...spec.columns.map((c) => c.key), ...(spec.groupBy ?? []), ...(spec.orderBy ?? []).map((o) => o.field)]),
  ).join(",");
  let q = supabase.from("orders").select(cols);
  q = applyFilters(q, spec);
  q = applyOrderLimit(q, spec);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown) as Record<string, any>[];
}

async function runProdutos(supabase: SB, spec: ReportSpec) {
  const cols = Array.from(
    new Set(["id", ...spec.columns.map((c) => c.key), ...(spec.groupBy ?? []), ...(spec.orderBy ?? []).map((o) => o.field)]),
  ).join(",");
  let q = supabase.from("products").select(cols);
  q = applyFilters(q, spec);
  q = applyOrderLimit(q, spec);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown) as Record<string, any>[];
}

/* ------------------------------------------------------------------ */
/* Grouping + totals (client-safe post-processing)                     */
/* ------------------------------------------------------------------ */

function aggregate(rows: Record<string, unknown>[], spec: ReportSpec): Record<string, unknown>[] {
  const groupBy = spec.groupBy ?? [];
  const aggCols = spec.columns.filter((c) => c.agg);
  if (groupBy.length === 0 || aggCols.length === 0) return rows;

  const buckets = new Map<string, { key: Record<string, unknown>; nums: Record<string, number[]> }>();
  for (const r of rows) {
    const keyObj: Record<string, unknown> = {};
    for (const g of groupBy) keyObj[g] = r[g];
    const k = JSON.stringify(keyObj);
    let bucket = buckets.get(k);
    if (!bucket) {
      bucket = { key: keyObj, nums: {} };
      buckets.set(k, bucket);
    }
    for (const c of aggCols) {
      (bucket.nums[c.key] ??= []).push(Number(r[c.key]) || 0);
    }
  }
  return Array.from(buckets.values()).map(({ key, nums }) => {
    const out: Record<string, unknown> = { ...key };
    for (const c of aggCols) {
      const arr = nums[c.key] ?? [];
      const sum = arr.reduce((a, b) => a + b, 0);
      switch (c.agg) {
        case "sum": out[c.key] = sum; break;
        case "count": out[c.key] = arr.length; break;
        case "avg": out[c.key] = arr.length ? sum / arr.length : 0; break;
        case "min": out[c.key] = arr.length ? Math.min(...arr) : 0; break;
        case "max": out[c.key] = arr.length ? Math.max(...arr) : 0; break;
      }
    }
    return out;
  });
}

function computeTotals(rows: Record<string, unknown>[], spec: ReportSpec): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const c of spec.columns) {
    if (!c.money) continue;
    totals[c.key] = rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* runReportQuery — main entry point                                   */
/* ------------------------------------------------------------------ */

export const runReportQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const parsed = ReportSpecSchema.parse((input as { spec: unknown }).spec);
    return { spec: validateSpec(parsed) };
  })
  .handler(async ({ data, context }): Promise<RunReportResult> => {
    const { supabase } = context;
    const spec = data.spec;
    let rows: Record<string, unknown>[];
    switch (spec.dataSource) {
      case "clientes": rows = await runClientes(supabase, spec); break;
      case "vendas": rows = await runVendas(supabase, spec); break;
      case "produtos_estoque": rows = await runProdutos(supabase, spec); break;
    }
    const aggregated = aggregate(rows, spec);
    return { rows: aggregated, totals: computeTotals(aggregated, spec), spec };
  });

/* ------------------------------------------------------------------ */
/* Saved reports CRUD                                                  */
/* ------------------------------------------------------------------ */

export const listRelatoriosSalvos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RelatorioSalvo[]> => {
    const { data, error } = await context.supabase
      .from("relatorios_salvos")
      .select("id, nome, descricao, spec, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as RelatorioSalvo[];
  });

export const createRelatorioSalvo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { nome: string; descricao?: string; spec: unknown };
    return {
      nome: String(i.nome).slice(0, 200),
      descricao: i.descricao ? String(i.descricao).slice(0, 1000) : null,
      spec: ReportSpecSchema.parse(i.spec),
    };
  })
  .handler(async ({ data, context }): Promise<RelatorioSalvo> => {
    const { data: row, error } = await context.supabase
      .from("relatorios_salvos")
      .insert({ nome: data.nome, descricao: data.descricao, spec: data.spec as any })
      .select("id, nome, descricao, spec, created_at, updated_at")
      .single();
    if (error) throw error;
    return row as unknown as RelatorioSalvo;
  });

export const updateRelatorioSalvo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { id: string; nome?: string; descricao?: string; spec?: unknown };
    return {
      id: String(i.id),
      nome: i.nome != null ? String(i.nome).slice(0, 200) : undefined,
      descricao: i.descricao != null ? String(i.descricao).slice(0, 1000) : undefined,
      spec: i.spec != null ? ReportSpecSchema.parse(i.spec) : undefined,
    };
  })
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.nome != null) patch.nome = data.nome;
    if (data.descricao !== undefined) patch.descricao = data.descricao;
    if (data.spec != null) patch.spec = data.spec;
    const { error } = await context.supabase
      .from("relatorios_salvos")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteRelatorioSalvo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({ id: String((input as { id: string }).id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("relatorios_salvos")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
