import { supabase } from "@/integrations/supabase/client";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface InsumoAjuste {
  id: string;
  nome: string;
  unidade_estoque: string;
  saldo_estoque: number;
  controlado: boolean;
}

export interface AjusteEstoque {
  id: string;
  insumo_id: string;
  insumo_nome: string;
  unidade_estoque: string;
  tipo: string;
  quantidade: number;
  status: "Provisorio" | "Conciliado";
  observacao: string | null;
  nf_referencia: string | null;
  quantidade_nf: number | null;
  ajuste_fino: number | null;
  saldo_apos: number | null;
  created_at: string;
  conciliado_at: string | null;
}

/** Insumos disponíveis para ajuste rápido (com saldo e unidade de estoque). */
export async function listInsumosParaAjuste(): Promise<InsumoAjuste[]> {
  const { data, error } = await supabase
    .from("insumos")
    .select("id, nome, unidade_estoque, unidade_medida, saldo_estoque, controlado")
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    unidade_estoque:
      (i as { unidade_estoque?: string | null }).unidade_estoque ??
      i.unidade_medida ??
      "un",
    saldo_estoque: Number(i.saldo_estoque ?? 0),
    controlado: Boolean((i as { controlado?: boolean }).controlado),
  }));
}

/** Entrada emergencial: libera o saldo na hora e grava kardex Provisório. */
export async function ajusteRapidoEstoque(input: {
  insumo_id: string;
  quantidade: number;
  observacao?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("ajuste_rapido_estoque", {
    p_insumo_id: input.insumo_id,
    p_quantidade: round3(input.quantidade),
    p_observacao: input.observacao ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Conciliação de NF: aplica só o ajuste fino e marca como Conciliado. */
export async function conciliarAjusteNf(input: {
  ajuste_id: string;
  quantidade_nf: number;
  nf_referencia?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("conciliar_ajuste_nf", {
    p_ajuste_id: input.ajuste_id,
    p_quantidade_nf: round3(input.quantidade_nf),
    p_nf_referencia: input.nf_referencia ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Histórico (kardex) de ajustes, mais recentes primeiro. */
export async function listAjustesEstoque(limit = 60): Promise<AjusteEstoque[]> {
  const { data, error } = await supabase
    .from("ajustes_estoque")
    .select(
      "id, insumo_id, tipo, quantidade, status, observacao, nf_referencia, quantidade_nf, ajuste_fino, saldo_apos, created_at, conciliado_at, insumos(nome, unidade_estoque, unidade_medida)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((a) => {
    const ins = a.insumos as
      | { nome?: string; unidade_estoque?: string | null; unidade_medida?: string | null }
      | null;
    return {
      id: a.id,
      insumo_id: a.insumo_id,
      insumo_nome: ins?.nome ?? "—",
      unidade_estoque: ins?.unidade_estoque ?? ins?.unidade_medida ?? "un",
      tipo: a.tipo ?? "Entrada Emergencial",
      quantidade: Number(a.quantidade ?? 0),
      status: (a.status as "Provisorio" | "Conciliado") ?? "Provisorio",
      observacao: a.observacao ?? null,
      nf_referencia: a.nf_referencia ?? null,
      quantidade_nf: a.quantidade_nf != null ? Number(a.quantidade_nf) : null,
      ajuste_fino: a.ajuste_fino != null ? Number(a.ajuste_fino) : null,
      saldo_apos: a.saldo_apos != null ? Number(a.saldo_apos) : null,
      created_at: a.created_at,
      conciliado_at: a.conciliado_at ?? null,
    };
  });
}
