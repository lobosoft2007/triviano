import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------------ */
/* Setores                                                            */
/* ------------------------------------------------------------------ */

export interface Setor {
  id: string;
  setor: string;
  ordem_exibicao: number;
}

export async function listSetores(): Promise<Setor[]> {
  const { data, error } = await supabase
    .from("setores")
    .select("id, setor, ordem_exibicao")
    .order("ordem_exibicao")
    .order("setor");
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    setor: s.setor,
    ordem_exibicao: Number(s.ordem_exibicao ?? 0),
  }));
}

export async function saveSetor(input: {
  id?: string | null;
  setor: string;
  ordem_exibicao: number;
}): Promise<void> {
  const payload = {
    setor: input.setor.trim(),
    ordem_exibicao: input.ordem_exibicao,
  };
  if (input.id) {
    const { error } = await supabase
      .from("setores")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("setores").insert(payload);
    if (error) throw error;
  }
}

export async function deleteSetor(id: string): Promise<void> {
  const { error } = await supabase.from("setores").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Fornecedores                                                       */
/* ------------------------------------------------------------------ */

export interface Fornecedor {
  id: string;
  fornecedor: string;
  endereco: string;
  contato: string;
  telefone: string;
  email: string;
  prazo: number | null;
  site: string;
  cnpj: string;
  i_estadual: string;
  ativo: boolean;
}

export async function listFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from("fornecedores")
    .select(
      "id, fornecedor, endereco, contato, telefone, email, prazo, site, cnpj, i_estadual, ativo",
    )
    .order("fornecedor");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    fornecedor: f.fornecedor,
    endereco: f.endereco ?? "",
    contato: f.contato ?? "",
    telefone: f.telefone ?? "",
    email: f.email ?? "",
    prazo: f.prazo === null || f.prazo === undefined ? null : Number(f.prazo),
    site: f.site ?? "",
    cnpj: f.cnpj ?? "",
    i_estadual: f.i_estadual ?? "",
    ativo: f.ativo ?? true,
  }));
}

export async function saveFornecedor(input: {
  id?: string | null;
  fornecedor: string;
  endereco: string;
  contato: string;
  telefone: string;
  email: string;
  prazo: number | null;
  site: string;
  cnpj: string;
  i_estadual: string;
  ativo: boolean;
}): Promise<void> {
  const payload = {
    fornecedor: input.fornecedor.trim(),
    endereco: input.endereco.trim() || null,
    contato: input.contato.trim() || null,
    telefone: input.telefone.trim() || null,
    email: input.email.trim() || null,
    prazo: input.prazo,
    site: input.site.trim() || null,
    cnpj: input.cnpj.trim() || null,
    i_estadual: input.i_estadual.trim() || null,
    ativo: input.ativo,
  };
  if (input.id) {
    const { error } = await supabase
      .from("fornecedores")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("fornecedores").insert(payload);
    if (error) throw error;
  }
}

export async function deleteFornecedor(id: string): Promise<void> {
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Insumos                                                            */
/* ------------------------------------------------------------------ */

export interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estocavel: boolean;
  fornecedor_id: string | null;
  setor_id: string | null;
}

export async function listInsumos(): Promise<Insumo[]> {
  const { data, error } = await supabase
    .from("insumos")
    .select("id, nome, unidade_medida, custo_unitario, estocavel, fornecedor_id, setor_id")
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    unidade_medida: i.unidade_medida ?? "un",
    custo_unitario: Number(i.custo_unitario ?? 0),
    estocavel: i.estocavel ?? true,
    fornecedor_id: i.fornecedor_id ?? null,
    setor_id: i.setor_id ?? null,
  }));
}

export async function saveInsumo(input: {
  id?: string | null;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estocavel: boolean;
  fornecedor_id: string | null;
  setor_id: string | null;
}): Promise<void> {
  const payload = {
    nome: input.nome.trim(),
    unidade_medida: input.unidade_medida.trim() || "un",
    custo_unitario: round2(input.custo_unitario),
    estocavel: input.estocavel,
    fornecedor_id: input.fornecedor_id,
    setor_id: input.setor_id,
  };
  if (input.id) {
    const { error } = await supabase
      .from("insumos")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("insumos").insert(payload);
    if (error) throw error;
  }
}

export async function deleteInsumo(id: string): Promise<void> {
  const { error } = await supabase.from("insumos").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Subprodutos + composição                                           */
/* ------------------------------------------------------------------ */

export interface ComposicaoLinha {
  insumo_id: string;
  quantidade: number;
}

export interface Subproduto {
  id: string;
  nome: string;
  rendimento_porcoes: number;
  modo_preparo: string;
  composicao: ComposicaoLinha[];
}

export async function listSubprodutos(): Promise<Subproduto[]> {
  const [subRes, compRes] = await Promise.all([
    supabase
      .from("subprodutos")
      .select("id, nome, rendimento_porcoes, modo_preparo")
      .order("nome"),
    supabase
      .from("composicao_subproduto")
      .select("subproduto_id, insumo_id, quantidade"),
  ]);
  if (subRes.error) throw subRes.error;
  if (compRes.error) throw compRes.error;

  const compMap = new Map<string, ComposicaoLinha[]>();
  for (const c of compRes.data ?? []) {
    const list = compMap.get(c.subproduto_id) ?? [];
    list.push({ insumo_id: c.insumo_id, quantidade: Number(c.quantidade) });
    compMap.set(c.subproduto_id, list);
  }

  return (subRes.data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    rendimento_porcoes: Number(s.rendimento_porcoes ?? 1),
    modo_preparo: s.modo_preparo ?? "",
    composicao: compMap.get(s.id) ?? [],
  }));
}

export async function saveSubproduto(input: {
  id?: string | null;
  nome: string;
  rendimento_porcoes: number;
  modo_preparo: string;
  composicao: ComposicaoLinha[];
}): Promise<void> {
  const payload = {
    nome: input.nome.trim(),
    rendimento_porcoes: input.rendimento_porcoes || 1,
    modo_preparo: input.modo_preparo.trim(),
  };

  let subId = input.id ?? null;
  if (subId) {
    const { error } = await supabase
      .from("subprodutos")
      .update(payload)
      .eq("id", subId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("subprodutos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    subId = data.id;
  }

  // Replace composition rows.
  const { error: delErr } = await supabase
    .from("composicao_subproduto")
    .delete()
    .eq("subproduto_id", subId);
  if (delErr) throw delErr;

  const rows = input.composicao
    .filter((c) => c.insumo_id && c.quantidade > 0)
    .map((c) => ({
      subproduto_id: subId,
      insumo_id: c.insumo_id,
      quantidade: round2(c.quantidade),
    }));
  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("composicao_subproduto")
      .insert(rows);
    if (insErr) throw insErr;
  }
}

export async function deleteSubproduto(id: string): Promise<void> {
  const { error } = await supabase.from("subprodutos").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Produto — tabelas relacionais + ficha técnica (dados fiscais)      */
/* ------------------------------------------------------------------ */

export interface RelOption {
  tamanho: string;
  preco: number;
}
export interface RelAddon {
  nome: string;
  preco: number;
}

export interface FichaLine {
  /** Whether this recipe line references a raw insumo or a subproduto. */
  tipo: "insumo" | "subproduto";
  /** insumo_id or subproduto_id depending on `tipo`. */
  ref_id: string;
  /** Display name snapshot (also used by the customer removal UI). */
  nome: string;
  quantidade: number;
  permitir_exclusao: boolean;
}

export interface ProductDetail {
  manipulado: boolean;
  setor_id: string | null;
  fornecedor_id: string | null;
  price_options: RelOption[];
  addons: RelAddon[];
  free_addons: RelAddon[];
  ncm: string;
  ean: string;
  /** Ficha técnica: insumos / subprodutos that compose the product. */
  ficha: FichaLine[];
}

export async function fetchProductDetail(
  productId: string,
): Promise<ProductDetail> {
  const [poRes, addRes, freeRes, fichaRes, prodRes, ingRes] = await Promise.all([
    supabase
      .from("produtos_price_options")
      .select("tamanho, preco, sort_order")
      .eq("produto_id", productId)
      .order("sort_order"),
    supabase
      .from("produtos_addons")
      .select("nome, preco, sort_order")
      .eq("produto_id", productId)
      .order("sort_order"),
    supabase
      .from("produtos_free_addons")
      .select("nome, preco, sort_order")
      .eq("produto_id", productId)
      .order("sort_order"),
    supabase
      .from("fichas_tecnicas")
      .select("dados_fiscais")
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("products")
      .select("manipulado, setor_id, fornecedor_id")
      .eq("id", productId)
      .single(),
    supabase
      .from("ingredientes_produto")
      .select("insumo_id, subproduto_id, nome, quantidade, permitir_exclusao, sort_order")
      .eq("product_id", productId)
      .order("sort_order"),
  ]);
  if (poRes.error) throw poRes.error;
  if (addRes.error) throw addRes.error;
  if (freeRes.error) throw freeRes.error;
  if (fichaRes.error) throw fichaRes.error;
  if (prodRes.error) throw prodRes.error;
  if (ingRes.error) throw ingRes.error;

  const fiscais = (fichaRes.data?.dados_fiscais ?? {}) as Record<string, unknown>;

  return {
    manipulado: prodRes.data.manipulado ?? true,
    setor_id: prodRes.data.setor_id ?? null,
    fornecedor_id: prodRes.data.fornecedor_id ?? null,
    price_options: (poRes.data ?? []).map((p) => ({
      tamanho: String(p.tamanho),
      preco: Number(p.preco),
    })),
    addons: (addRes.data ?? []).map((a) => ({
      nome: String(a.nome),
      preco: Number(a.preco),
    })),
    free_addons: (freeRes.data ?? []).map((a) => ({
      nome: String(a.nome),
      preco: Number(a.preco),
    })),
    ncm: String(fiscais.ncm ?? ""),
    ean: String(fiscais.ean ?? ""),
    ficha: (ingRes.data ?? []).map((r) => ({
      tipo: (r.subproduto_id ? "subproduto" : "insumo") as
        | "insumo"
        | "subproduto",
      ref_id: (r.subproduto_id ?? r.insumo_id ?? "") as string,
      nome: String(r.nome ?? ""),
      quantidade: Number(r.quantidade ?? 0),
      permitir_exclusao: Boolean(r.permitir_exclusao),
    })),
  };
}

/** Replace all relational rows + upsert ficha técnica for a product. */
export async function saveProductDetail(
  productId: string,
  detail: ProductDetail,
): Promise<void> {
  // products flags
  const { error: prodErr } = await supabase
    .from("products")
    .update({
      manipulado: detail.manipulado,
      setor_id: detail.manipulado ? null : detail.setor_id,
      fornecedor_id: detail.manipulado ? null : detail.fornecedor_id,
    })
    .eq("id", productId);
  if (prodErr) throw prodErr;

  // price options
  await supabase
    .from("produtos_price_options")
    .delete()
    .eq("produto_id", productId);
  const poRows = detail.price_options
    .filter((p) => p.tamanho.trim())
    .map((p, idx) => ({
      produto_id: productId,
      tamanho: p.tamanho.trim(),
      preco: round2(p.preco),
      sort_order: idx,
    }));
  if (poRows.length) {
    const { error } = await supabase
      .from("produtos_price_options")
      .insert(poRows);
    if (error) throw error;
  }

  // paid addons
  await supabase.from("produtos_addons").delete().eq("produto_id", productId);
  const addRows = detail.addons
    .filter((a) => a.nome.trim())
    .map((a, idx) => ({
      produto_id: productId,
      nome: a.nome.trim(),
      preco: round2(a.preco),
      sort_order: idx,
    }));
  if (addRows.length) {
    const { error } = await supabase.from("produtos_addons").insert(addRows);
    if (error) throw error;
  }

  // free addons (overflow price stored on every row)
  await supabase
    .from("produtos_free_addons")
    .delete()
    .eq("produto_id", productId);
  const freeRows = detail.free_addons
    .filter((a) => a.nome.trim())
    .map((a, idx) => ({
      produto_id: productId,
      nome: a.nome.trim(),
      preco: round2(a.preco),
      sort_order: idx,
    }));
  if (freeRows.length) {
    const { error } = await supabase
      .from("produtos_free_addons")
      .insert(freeRows);
    if (error) throw error;
  }

  // ficha técnica — dados fiscais (NCM / EAN)
  const { error: fichaErr } = await supabase.from("fichas_tecnicas").upsert(
    {
      product_id: productId,
      dados_fiscais: { ncm: detail.ncm.trim(), ean: detail.ean.trim() },
    },
    { onConflict: "product_id" },
  );
  if (fichaErr) throw fichaErr;

  // ficha técnica — composição da receita (insumos / subprodutos)
  await supabase
    .from("ingredientes_produto")
    .delete()
    .eq("product_id", productId);
  const fichaRows = detail.ficha
    .filter((f) => f.ref_id && f.nome.trim())
    .map((f, idx) => ({
      product_id: productId,
      nome: f.nome.trim(),
      insumo_id: f.tipo === "insumo" ? f.ref_id : null,
      subproduto_id: f.tipo === "subproduto" ? f.ref_id : null,
      quantidade: round2(f.quantidade),
      permitir_exclusao: f.permitir_exclusao,
      sort_order: idx,
    }));
  if (fichaRows.length) {
    const { error } = await supabase
      .from("ingredientes_produto")
      .insert(fichaRows);
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Configurações de pagamento (PIX / gateway)                         */
/* ------------------------------------------------------------------ */

export interface ConfigPagamento {
  id: string;
  gateway_banco: string;
  client_id: string;
  client_secret: string;
  chave_pix_padrao: string;
  nome_recebedor: string;
  cidade_recebedor: string;
  ativo: boolean;
}

export async function listConfigPagamentos(): Promise<ConfigPagamento[]> {
  const { data, error } = await supabase
    .from("config_pagamentos")
    .select(
      "id, gateway_banco, client_id, client_secret, chave_pix_padrao, nome_recebedor, cidade_recebedor, ativo",
    )
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    gateway_banco: c.gateway_banco ?? "",
    client_id: c.client_id ?? "",
    client_secret: c.client_secret ?? "",
    chave_pix_padrao: c.chave_pix_padrao ?? "",
    nome_recebedor: c.nome_recebedor ?? "",
    cidade_recebedor: c.cidade_recebedor ?? "",
    ativo: c.ativo ?? false,
  }));
}

export async function saveConfigPagamento(input: {
  id?: string | null;
  gateway_banco: string;
  client_id: string;
  client_secret: string;
  chave_pix_padrao: string;
  nome_recebedor: string;
  cidade_recebedor: string;
  ativo: boolean;
}): Promise<void> {
  const payload = {
    gateway_banco: input.gateway_banco.trim(),
    client_id: input.client_id.trim(),
    client_secret: input.client_secret.trim(),
    chave_pix_padrao: input.chave_pix_padrao.trim(),
    nome_recebedor: input.nome_recebedor.trim(),
    cidade_recebedor: input.cidade_recebedor.trim(),
    ativo: input.ativo,
  };

  let id = input.id ?? null;
  if (id) {
    const { error } = await supabase
      .from("config_pagamentos")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("config_pagamentos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  }

  // Only one active config at a time.
  if (input.ativo && id) {
    const { error } = await supabase
      .from("config_pagamentos")
      .update({ ativo: false })
      .neq("id", id);
    if (error) throw error;
  }
}

export async function deleteConfigPagamento(id: string): Promise<void> {
  const { error } = await supabase
    .from("config_pagamentos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export interface ActivePixConfig {
  chave_pix_padrao: string;
  nome_recebedor: string;
  cidade_recebedor: string;
  gateway_banco: string;
}

/**
 * Reads ONLY the public PIX fields of the active payment config through a
 * security-definer function (never exposes client_secret to the checkout).
 */
export async function fetchActivePixConfig(): Promise<ActivePixConfig | null> {
  const { data, error } = await supabase.rpc("get_active_pix_config");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    chave_pix_padrao: row.chave_pix_padrao ?? "",
    nome_recebedor: row.nome_recebedor ?? "",
    cidade_recebedor: row.cidade_recebedor ?? "",
    gateway_banco: row.gateway_banco ?? "",
  };
}

export { num as parseNumberInput };
