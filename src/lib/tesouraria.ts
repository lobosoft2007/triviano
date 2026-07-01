import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Contas financeiras                                                  */
/* ------------------------------------------------------------------ */

export type TipoConta = "Físico" | "Banco" | "Recebível_Futuro";

export interface ContaFinanceira {
  id: string;
  nome: string;
  saldo_atual: number;
  tipo_conta: TipoConta;
  ativo: boolean;
  id_meio_pagamento: string | null;
  taxa_percentual: number;
  dias_liquidacao: number;
}

export async function listContasFinanceiras(): Promise<ContaFinanceira[]> {
  const { data, error } = await supabase
    .from("contas_financeiras")
    .select(
      "id, nome, saldo_atual, tipo_conta, ativo, id_meio_pagamento, taxa_percentual, dias_liquidacao",
    )
    .order("tipo_conta")
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    saldo_atual: Number(c.saldo_atual ?? 0),
    tipo_conta: c.tipo_conta as TipoConta,
    ativo: c.ativo ?? true,
    id_meio_pagamento: c.id_meio_pagamento ?? null,
    taxa_percentual: Number(c.taxa_percentual ?? 0),
    dias_liquidacao: Number(c.dias_liquidacao ?? 0),
  }));
}

export async function saveContaFinanceira(input: {
  id?: string | null;
  nome: string;
  tipo_conta: TipoConta;
  ativo: boolean;
  id_meio_pagamento: string | null;
  taxa_percentual: number;
  dias_liquidacao: number;
  saldo_atual?: number;
}): Promise<void> {
  const payload = {
    nome: input.nome.trim(),
    tipo_conta: input.tipo_conta,
    ativo: input.ativo,
    id_meio_pagamento: input.id_meio_pagamento,
    taxa_percentual: round2(input.taxa_percentual),
    dias_liquidacao: Math.max(0, Math.trunc(input.dias_liquidacao || 0)),
    ...(input.saldo_atual !== undefined
      ? { saldo_atual: round2(input.saldo_atual) }
      : {}),
  };
  if (input.id) {
    const { error } = await supabase
      .from("contas_financeiras")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("contas_financeiras")
      .insert({ ...payload, saldo_atual: round2(input.saldo_atual ?? 0) });
    if (error) throw error;
  }
}

export async function deleteContaFinanceira(id: string): Promise<void> {
  const { error } = await supabase
    .from("contas_financeiras")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Lançamentos de tesouraria                                           */
/* ------------------------------------------------------------------ */

export type TipoLancamento = "Entrada" | "Saída";

export interface Lancamento {
  id: string;
  id_conta_financeira: string;
  conta_nome: string;
  tipo: TipoLancamento;
  valor: number;
  categoria_fluxo: string;
  descricao: string;
  data_competencia: string;
  data_liquidacao: string;
}

export async function listLancamentos(limit = 200): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos_tesouraria")
    .select(
      "id, id_conta_financeira, tipo, valor, categoria_fluxo, descricao, data_competencia, data_liquidacao, contas_financeiras(nome)",
    )
    .order("data_liquidacao", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    id_conta_financeira: l.id_conta_financeira,
    conta_nome:
      (l.contas_financeiras as { nome?: string } | null)?.nome ?? "—",
    tipo: l.tipo as TipoLancamento,
    valor: Number(l.valor ?? 0),
    categoria_fluxo: l.categoria_fluxo ?? "",
    descricao: l.descricao ?? "",
    data_competencia: l.data_competencia,
    data_liquidacao: l.data_liquidacao,
  }));
}

/* ------------------------------------------------------------------ */
/* Painel financeiro & fluxo de caixa projetado                        */
/* ------------------------------------------------------------------ */

export interface ProjecaoDia {
  data: string; // ISO date (yyyy-mm-dd)
  label: string; // dd/mm
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

export interface PainelFinanceiro {
  contas: ContaFinanceira[];
  saldoConsolidado: number;
  recebiveisFuturos: number;
  projecao: ProjecaoDia[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Consolida os saldos de todas as contas e projeta o fluxo futuro (D+0 a D+30)
 * com base nas datas de liquidação dos recebíveis lançados na tesouraria.
 */
export async function fetchPainelFinanceiro(
  horizonteDias = 30,
): Promise<PainelFinanceiro> {
  const contas = await listContasFinanceiras();

  const hoje = startOfDay(new Date());
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + horizonteDias);

  const { data, error } = await supabase
    .from("lancamentos_tesouraria")
    .select("tipo, valor, data_liquidacao")
    .gte("data_liquidacao", hoje.toISOString())
    .lte("data_liquidacao", limite.toISOString())
    .order("data_liquidacao");
  if (error) throw error;

  // Saldo consolidado = soma de saldos das contas ativas (físico + banco).
  const saldoConsolidado = round2(
    contas
      .filter((c) => c.ativo && c.tipo_conta !== "Recebível_Futuro")
      .reduce((sum, c) => sum + c.saldo_atual, 0),
  );

  // Recebíveis futuros = entradas projetadas ainda não liquidadas.
  const recebiveisFuturos = round2(
    (data ?? [])
      .filter((l) => l.tipo === "Entrada")
      .reduce((s, l) => s + Number(l.valor ?? 0), 0),
  );

  // Buckets por dia.
  const map = new Map<string, { entradas: number; saidas: number }>();
  for (const l of data ?? []) {
    const d = startOfDay(new Date(l.data_liquidacao));
    const key = d.toISOString().slice(0, 10);
    const bucket = map.get(key) ?? { entradas: 0, saidas: 0 };
    if (l.tipo === "Entrada") bucket.entradas += Number(l.valor ?? 0);
    else bucket.saidas += Number(l.valor ?? 0);
    map.set(key, bucket);
  }

  const projecao: ProjecaoDia[] = [];
  let acumulado = saldoConsolidado;
  for (let i = 0; i <= horizonteDias; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const bucket = map.get(key) ?? { entradas: 0, saidas: 0 };
    acumulado += bucket.entradas - bucket.saidas;
    projecao.push({
      data: key,
      label: `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}`,
      entradas: round2(bucket.entradas),
      saidas: round2(bucket.saidas),
      saldoAcumulado: round2(acumulado),
    });
  }

  return { contas, saldoConsolidado, recebiveisFuturos, projecao };
}

/* ------------------------------------------------------------------ */
/* Entrada avulsa de estoque                                           */
/* ------------------------------------------------------------------ */

export interface ItemEntradaInput {
  id_insumo: string;
  quantidade: number;
  custo_unitario: number;
}

export async function registrarEntradaAvulsa(input: {
  id_fornecedor: string | null;
  id_conta_financeira: string | null;
  observacao: string;
  itens: ItemEntradaInput[];
}): Promise<number> {
  const itens = input.itens
    .filter((i) => i.id_insumo && i.quantidade > 0)
    .map((i) => ({
      id_insumo: i.id_insumo,
      quantidade: round2(i.quantidade),
      custo_unitario: round2(i.custo_unitario),
    }));
  if (itens.length === 0) {
    throw new Error("Adicione ao menos um insumo com quantidade válida.");
  }

  const { data, error } = await supabase.rpc("registrar_entrada_avulsa", {
    p_fornecedor: input.id_fornecedor,
    p_conta_financeira: input.id_conta_financeira,
    p_observacao: input.observacao,
    p_itens: itens,
  });
  if (error) {
    console.error("[registrarEntradaAvulsa]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  return Number(data ?? 0);
}

export interface EntradaAvulsa {
  id: string;
  numero_documento_interno: number;
  id_fornecedor: string | null;
  fornecedor_nome: string;
  valor_total: number;
  observacao: string;
  created_at: string;
}

export async function listEntradasAvulsas(limit = 50): Promise<EntradaAvulsa[]> {
  const { data, error } = await supabase
    .from("entradas_avulsas_estoque")
    .select(
      "id, numero_documento_interno, id_fornecedor, valor_total, observacao, created_at, fornecedores(fornecedor)",
    )
    .order("numero_documento_interno", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    numero_documento_interno: Number(e.numero_documento_interno ?? 0),
    id_fornecedor: e.id_fornecedor ?? null,
    fornecedor_nome:
      (e.fornecedores as { fornecedor?: string } | null)?.fornecedor ?? "—",
    valor_total: Number(e.valor_total ?? 0),
    observacao: e.observacao ?? "",
    created_at: e.created_at,
  }));
}
