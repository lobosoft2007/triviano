import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Patrimônio líquido em estoque (valor de custo total)                */
/* ------------------------------------------------------------------ */

/**
 * Valor de custo de todo o estoque: insumos estocáveis (saldo × custo) +
 * produtos prontos não manipulados (saldo × preço). Admin-only via RPC.
 */
export async function fetchPatrimonioEstoque(): Promise<number> {
  const { data, error } = await supabase.rpc("get_patrimonio_estoque");
  if (error) throw error;
  return round2(Number(data ?? 0));
}

/* ------------------------------------------------------------------ */
/* Sugestão de compras por demanda                                     */
/* ------------------------------------------------------------------ */

export type ItemTipo = "insumo" | "produto";

export interface SugestaoItem {
  tipo: ItemTipo;
  ref_id: string;
  nome: string;
  unidade: string;
  fornecedor_id: string | null;
  setor_id: string | null;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  estoque_maximo: number;
  /** estoque_maximo - estoque_atual (nunca negativo). */
  quantidade_comprar: number;
}

/**
 * Varre insumos estocáveis e produtos prontos (manipulado = false) e devolve
 * a lista de itens cujo estoque atual está abaixo do mínimo definido.
 * A quantidade a comprar recompõe o estoque até o máximo cadastrado.
 */
export async function fetchSugestaoCompras(): Promise<SugestaoItem[]> {
  const [insumoRes, prodRes] = await Promise.all([
    supabase
      .from("insumos")
      .select(
        "id, nome, unidade_medida, custo_unitario, saldo_estoque, estoque_minimo, estoque_maximo, fornecedor_id, setor_id, estocavel",
      )
      .eq("estocavel", true),
    // Admin-only RPC exposes cost/stock columns (hidden on the raw table).
    supabase.rpc("admin_get_products", { p_only_manipulado_false: true }),

  ]);
  if (insumoRes.error) throw insumoRes.error;
  if (prodRes.error) throw prodRes.error;

  const items: SugestaoItem[] = [];

  for (const i of insumoRes.data ?? []) {
    const atual = Number(i.saldo_estoque ?? 0);
    const min = Number(i.estoque_minimo ?? 0);
    const max = Number(i.estoque_maximo ?? 0);
    if (min > 0 && atual < min) {
      items.push({
        tipo: "insumo",
        ref_id: i.id,
        nome: i.nome,
        unidade: i.unidade_medida ?? "un",
        fornecedor_id: i.fornecedor_id ?? null,
        setor_id: i.setor_id ?? null,
        custo_unitario: Number(i.custo_unitario ?? 0),
        estoque_atual: atual,
        estoque_minimo: min,
        estoque_maximo: max,
        quantidade_comprar: round2(Math.max(0, (max || min) - atual)),
      });
    }
  }

  for (const p of prodRes.data ?? []) {
    const atual = Number(p.saldo_estoque ?? 0);
    const min = Number(p.estoque_minimo ?? 0);
    const max = Number(p.estoque_maximo ?? 0);
    if (min > 0 && atual < min) {
      items.push({
        tipo: "produto",
        ref_id: p.id,
        nome: p.name,
        unidade: "un",
        fornecedor_id: p.fornecedor_id ?? null,
        setor_id: p.setor_id ?? null,
        custo_unitario: Number(p.price ?? 0),
        estoque_atual: atual,
        estoque_minimo: min,
        estoque_maximo: max,
        quantidade_comprar: round2(Math.max(0, (max || min) - atual)),
      });
    }
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* Ordens de compra (manual / avulsa)                                  */
/* ------------------------------------------------------------------ */

export interface OrdemCompraItemInput {
  tipo: ItemTipo;
  ref_id: string | null;
  nome: string;
  quantidade: number;
  custo_unitario: number;
}

export async function criarOrdemCompra(input: {
  id_fornecedor: string | null;
  observacao: string;
  origem: string;
  itens: OrdemCompraItemInput[];
}): Promise<number> {
  const itens = input.itens
    .filter((i) => i.nome && i.quantidade > 0)
    .map((i) => ({
      tipo: i.tipo,
      ref_id: i.ref_id,
      nome: i.nome,
      quantidade: round2(i.quantidade),
      custo_unitario: round2(i.custo_unitario),
    }));
  if (itens.length === 0) {
    throw new Error("Adicione ao menos um item com quantidade válida.");
  }

  const { data, error } = await supabase.rpc("criar_ordem_compra", {
    p_fornecedor: input.id_fornecedor as string,
    p_observacao: input.observacao,
    p_origem: input.origem || "Manual",
    p_itens: itens,
  });
  if (error) {
    console.error("[criarOrdemCompra]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  return Number(data ?? 0);
}

export interface OrdemCompra {
  id: string;
  numero: number;
  id_fornecedor: string | null;
  fornecedor_nome: string;
  fornecedor_telefone: string | null;
  status: string;
  origem: string;
  observacao: string;
  valor_total: number;
  created_at: string;
}

export async function listOrdensCompra(limit = 50): Promise<OrdemCompra[]> {
  const { data, error } = await supabase
    .from("ordens_compra")
    .select(
      "id, numero, id_fornecedor, status, origem, observacao, valor_total, created_at, fornecedores(fornecedor, telefone)",
    )
    .order("numero", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((o) => {
    const f = o.fornecedores as { fornecedor?: string; telefone?: string } | null;
    return {
      id: o.id,
      numero: Number(o.numero ?? 0),
      id_fornecedor: o.id_fornecedor ?? null,
      fornecedor_nome: f?.fornecedor ?? "—",
      fornecedor_telefone: f?.telefone ?? null,
      status: o.status ?? "Aberta",
      origem: o.origem ?? "Manual",
      observacao: o.observacao ?? "",
      valor_total: Number(o.valor_total ?? 0),
      created_at: o.created_at,
    };
  });
}

export interface OrdemCompraItem {
  id: string;
  tipo: ItemTipo | "livre";
  ref_id: string | null;
  nome: string;
  quantidade: number;
  custo_unitario: number;
  /** Enriquecidos após a leitura (resolvidos por `ref_id`). */
  setor_id?: string | null;
  setor_nome?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  unidade?: string | null;
}

export interface OrdemCompraDetalhe {
  id: string;
  numero: number;
  id_fornecedor: string | null;
  fornecedor_nome: string | null;
  fornecedor_telefone: string | null;
  fornecedor_cnpj: string | null;
  status: string;
  origem: string;
  observacao: string;
  valor_total: number;
  created_at: string;
  updated_at: string;
  itens: OrdemCompraItem[];
}

export async function getOrdemCompra(id: string): Promise<OrdemCompraDetalhe> {
  const { data, error } = await supabase.rpc("get_ordem_compra", { p_id: id });
  if (error) throw error;
  const d = data as Record<string, unknown>;
  const itensRaw = (d.itens as Record<string, unknown>[] | undefined) ?? [];

  const itens: OrdemCompraItem[] = itensRaw.map((i) => ({
    id: String(i.id),
    tipo: (i.tipo as OrdemCompraItem["tipo"]) ?? "insumo",
    ref_id: (i.ref_id as string | null) ?? null,
    nome: String(i.nome ?? ""),
    quantidade: Number(i.quantidade ?? 0),
    custo_unitario: Number(i.custo_unitario ?? 0),
    setor_id: null,
    setor_nome: null,
    fornecedor_id: null,
    fornecedor_nome: null,
    unidade: null,
  }));

  // Resolver setor/fornecedor por item via join no cliente.
  const insumoIds = Array.from(
    new Set(
      itens
        .filter((i) => i.tipo === "insumo" && i.ref_id)
        .map((i) => i.ref_id as string),
    ),
  );
  const produtoIds = Array.from(
    new Set(
      itens
        .filter((i) => i.tipo === "produto" && i.ref_id)
        .map((i) => i.ref_id as string),
    ),
  );

  const insumoMap = new Map<
    string,
    { setor_id: string | null; fornecedor_id: string | null; unidade: string | null }
  >();
  if (insumoIds.length > 0) {
    const { data: rows } = await supabase
      .from("insumos")
      .select("id, setor_id, fornecedor_id, unidade_medida")
      .in("id", insumoIds);
    for (const r of rows ?? []) {
      insumoMap.set(String(r.id), {
        setor_id: (r.setor_id as string | null) ?? null,
        fornecedor_id: (r.fornecedor_id as string | null) ?? null,
        unidade: (r.unidade_medida as string | null) ?? null,
      });
    }
  }

  const produtoMap = new Map<
    string,
    { setor_id: string | null; fornecedor_id: string | null }
  >();
  if (produtoIds.length > 0) {
    const { data: rows } = await supabase.rpc("admin_get_products", {
      p_only_manipulado_false: false,
    });
    const wanted = new Set(produtoIds);
    for (const r of (rows ?? []) as Record<string, unknown>[]) {
      const pid = String(r.id);
      if (!wanted.has(pid)) continue;
      produtoMap.set(pid, {
        setor_id: (r.setor_id as string | null) ?? null,
        fornecedor_id: (r.fornecedor_id as string | null) ?? null,
      });
    }
  }

  const setorIdsNeed = new Set<string>();
  const fornIdsNeed = new Set<string>();
  for (const it of itens) {
    const src =
      it.tipo === "insumo"
        ? insumoMap.get(it.ref_id ?? "")
        : it.tipo === "produto"
          ? produtoMap.get(it.ref_id ?? "")
          : null;
    if (src?.setor_id) setorIdsNeed.add(src.setor_id);
    if (src?.fornecedor_id) fornIdsNeed.add(src.fornecedor_id);
  }

  const setorNames = new Map<string, string>();
  if (setorIdsNeed.size > 0) {
    const { data: rows } = await supabase
      .from("setores")
      .select("id, setor")
      .in("id", Array.from(setorIdsNeed));
    for (const r of rows ?? []) setorNames.set(String(r.id), String(r.setor ?? ""));
  }
  const fornNames = new Map<string, string>();
  if (fornIdsNeed.size > 0) {
    const { data: rows } = await supabase
      .from("fornecedores")
      .select("id, fornecedor")
      .in("id", Array.from(fornIdsNeed));
    for (const r of rows ?? [])
      fornNames.set(String(r.id), String(r.fornecedor ?? ""));
  }

  for (const it of itens) {
    if (it.tipo === "insumo") {
      const src = insumoMap.get(it.ref_id ?? "");
      it.setor_id = src?.setor_id ?? null;
      it.fornecedor_id = src?.fornecedor_id ?? null;
      it.unidade = src?.unidade ?? null;
    } else if (it.tipo === "produto") {
      const src = produtoMap.get(it.ref_id ?? "");
      it.setor_id = src?.setor_id ?? null;
      it.fornecedor_id = src?.fornecedor_id ?? null;
      it.unidade = "un";
    }
    it.setor_nome = it.setor_id ? setorNames.get(it.setor_id) ?? null : null;
    it.fornecedor_nome = it.fornecedor_id
      ? fornNames.get(it.fornecedor_id) ?? null
      : null;
  }

  return {
    id: String(d.id),
    numero: Number(d.numero ?? 0),
    id_fornecedor: (d.id_fornecedor as string | null) ?? null,
    fornecedor_nome: (d.fornecedor_nome as string | null) ?? null,
    fornecedor_telefone: (d.fornecedor_telefone as string | null) ?? null,
    fornecedor_cnpj: (d.fornecedor_cnpj as string | null) ?? null,
    status: String(d.status ?? "Aberta"),
    origem: String(d.origem ?? "Manual"),
    observacao: String(d.observacao ?? ""),
    valor_total: Number(d.valor_total ?? 0),
    created_at: String(d.created_at),
    updated_at: String(d.updated_at),
    itens,
  };
}

export async function atualizarOrdemCompra(input: {
  id: string;
  id_fornecedor: string | null;
  observacao: string;
  itens: OrdemCompraItemInput[];
}): Promise<void> {
  const itens = input.itens
    .filter((i) => i.nome && i.quantidade > 0)
    .map((i) => ({
      tipo: i.tipo,
      ref_id: i.ref_id,
      nome: i.nome,
      quantidade: round2(i.quantidade),
      custo_unitario: round2(i.custo_unitario),
    }));
  if (itens.length === 0) {
    throw new Error("Adicione ao menos um item com quantidade válida.");
  }
  const { error } = await supabase.rpc("atualizar_ordem_compra", {
    p_id: input.id,
    p_fornecedor: input.id_fornecedor as string,
    p_observacao: input.observacao,
    p_itens: itens,
  });
  if (error) throw error;
}

export async function excluirOrdemCompra(id: string): Promise<void> {
  const { error } = await supabase.rpc("excluir_ordem_compra", { p_id: id });
  if (error) throw error;
}
