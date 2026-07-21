import { supabase } from "@/integrations/supabase/client";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface RecebimentoItemInput {
  id_item_ordem: string | null;
  tipo: "insumo" | "produto" | "livre";
  ref_id: string | null;
  nome: string;
  quantidade: number;
  custo_unitario: number;
}

export interface RecebimentoCabecalhoInput {
  com_nf: boolean;
  numero_nf?: string | null;
  serie_nf?: string | null;
  chave_acesso?: string | null;
  data_emissao?: string | null; // yyyy-mm-dd
  data_entrada?: string | null;
  id_fornecedor?: string | null;
  id_conta_financeira?: string | null;
  observacao?: string;
}

export async function receberOrdemCompra(input: {
  ordem_id: string;
  cabecalho: RecebimentoCabecalhoInput;
  itens: RecebimentoItemInput[];
}): Promise<number> {
  const itens = input.itens
    .filter((i) => i.quantidade > 0)
    .map((i) => ({
      id_item_ordem: i.id_item_ordem,
      tipo: i.tipo,
      ref_id: i.ref_id,
      nome: i.nome,
      quantidade: round3(i.quantidade),
      custo_unitario: round3(i.custo_unitario),
    }));
  if (itens.length === 0) {
    throw new Error("Nenhum item recebido — informe quantidade em pelo menos uma linha.");
  }
  const { data, error } = await supabase.rpc("receber_ordem_compra", {
    p_ordem_id: input.ordem_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_cabecalho: input.cabecalho as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_itens: itens as any,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export interface RecebimentoItem {
  id: string;
  tipo: string;
  ref_id: string | null;
  nome: string;
  quantidade_recebida: number;
  custo_unitario_pago: number;
  subtotal: number;
  custo_anterior: number | null;
  saldo_apos: number | null;
}

export interface Recebimento {
  id: string;
  numero: number;
  com_nf: boolean;
  numero_nf: string | null;
  serie_nf: string | null;
  chave_acesso: string | null;
  data_emissao: string | null;
  data_entrada: string;
  observacao: string;
  valor_total: number;
  id_conta_financeira: string | null;
  conta_nome: string | null;
  fornecedor_nome: string | null;
  created_at: string;
  itens: RecebimentoItem[];
}

export async function listRecebimentosOrdem(ordemId: string): Promise<Recebimento[]> {
  const { data, error } = await supabase.rpc("get_recebimentos_ordem", {
    p_ordem_id: ordemId,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    numero: Number(r.numero ?? 0),
    com_nf: Boolean(r.com_nf),
    numero_nf: (r.numero_nf as string | null) ?? null,
    serie_nf: (r.serie_nf as string | null) ?? null,
    chave_acesso: (r.chave_acesso as string | null) ?? null,
    data_emissao: (r.data_emissao as string | null) ?? null,
    data_entrada: String(r.data_entrada),
    observacao: String(r.observacao ?? ""),
    valor_total: Number(r.valor_total ?? 0),
    id_conta_financeira: (r.id_conta_financeira as string | null) ?? null,
    conta_nome: (r.conta_nome as string | null) ?? null,
    fornecedor_nome: (r.fornecedor_nome as string | null) ?? null,
    created_at: String(r.created_at),
    itens: ((r.itens as Record<string, unknown>[] | null) ?? []).map((i) => ({
      id: String(i.id),
      tipo: String(i.tipo ?? "insumo"),
      ref_id: (i.ref_id as string | null) ?? null,
      nome: String(i.nome ?? ""),
      quantidade_recebida: Number(i.quantidade_recebida ?? 0),
      custo_unitario_pago: Number(i.custo_unitario_pago ?? 0),
      subtotal: Number(i.subtotal ?? 0),
      custo_anterior: i.custo_anterior != null ? Number(i.custo_anterior) : null,
      saldo_apos: i.saldo_apos != null ? Number(i.saldo_apos) : null,
    })),
  }));
}

export async function encerrarOrdemCompra(ordemId: string): Promise<void> {
  const { error } = await supabase.rpc("encerrar_ordem_compra", { p_ordem_id: ordemId });
  if (error) throw error;
}
