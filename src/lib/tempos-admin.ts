// ============================================================
// Admin CRUDs for the preparation-time engine
// ------------------------------------------------------------
// Tenant-scoped helpers around linhas_producao / zonas_entrega
// / categoria_etapas_preparo. All writes rely on RLS scoped by
// `can_manage_empresa` (already enforced by the database).
// ============================================================
import { supabase } from "@/integrations/supabase/client";
import { currentEmpresaId } from "@/lib/storage";

/* ---------------- Linhas de Produção ---------------- */

export interface LinhaProducao {
  id: string;
  nome: string;
  ativo: boolean;
}

export async function listLinhasProducao(): Promise<LinhaProducao[]> {
  const empresaId = await currentEmpresaId();
  const { data, error } = await supabase
    .from("linhas_producao")
    .select("id, nome, ativo")
    .eq("empresa_id", empresaId)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    ativo: Boolean(l.ativo),
  }));
}

export async function saveLinhaProducao(input: {
  id?: string | null;
  nome: string;
  ativo: boolean;
}): Promise<void> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Informe o nome da linha de produção.");
  if (input.id) {
    const { error } = await supabase
      .from("linhas_producao")
      .update({ nome, ativo: input.ativo })
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const empresaId = await currentEmpresaId();
    const { error } = await supabase
      .from("linhas_producao")
      .insert({ nome, ativo: input.ativo, empresa_id: empresaId });
    if (error) throw error;
  }
}

export async function deleteLinhaProducao(id: string): Promise<void> {
  const { error } = await supabase.from("linhas_producao").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Zonas de Entrega ---------------- */

export interface ZonaEntrega {
  id: string;
  nome: string;
  tempo_entrega_min: number;
  ativo: boolean;
}

export async function listZonasEntrega(): Promise<ZonaEntrega[]> {
  const empresaId = await currentEmpresaId();
  const { data, error } = await supabase
    .from("zonas_entrega")
    .select("id, nome, tempo_entrega_min, ativo")
    .eq("empresa_id", empresaId)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((z) => ({
    id: z.id,
    nome: z.nome,
    tempo_entrega_min: Number(z.tempo_entrega_min ?? 0),
    ativo: Boolean(z.ativo),
  }));
}

export async function saveZonaEntrega(input: {
  id?: string | null;
  nome: string;
  tempo_entrega_min: number;
  ativo: boolean;
}): Promise<void> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Informe o nome da zona.");
  const payload = {
    nome,
    tempo_entrega_min: Math.max(0, Math.round(input.tempo_entrega_min)),
    ativo: input.ativo,
  };
  if (input.id) {
    const { error } = await supabase
      .from("zonas_entrega")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const empresaId = await currentEmpresaId();
    const { error } = await supabase
      .from("zonas_entrega")
      .insert({ ...payload, empresa_id: empresaId });
    if (error) throw error;
  }
}

export async function deleteZonaEntrega(id: string): Promise<void> {
  const { error } = await supabase.from("zonas_entrega").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Etapas de preparo por categoria ---------------- */

export interface EtapaPreparo {
  id?: string;
  nome: string;
  duracao_min: number;
  ordem: number;
}

export async function listEtapasCategoria(
  categoriaId: string,
): Promise<EtapaPreparo[]> {
  const { data, error } = await supabase
    .from("categoria_etapas_preparo")
    .select("id, nome, duracao_min, ordem")
    .eq("categoria_id", categoriaId)
    .order("ordem");
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    nome: e.nome,
    duracao_min: Number(e.duracao_min ?? 0),
    ordem: Number(e.ordem ?? 0),
  }));
}

/**
 * Full replace: deletes any etapas removed by the operator and upserts the
 * remaining ones with the new order. Runs sequentially — the tables are
 * small (a handful of etapas per category).
 */
export async function saveEtapasCategoria(
  categoriaId: string,
  etapas: EtapaPreparo[],
): Promise<void> {
  // Clean slate: easier + safe (small rowset, cascades not needed).
  const { error: delErr } = await supabase
    .from("categoria_etapas_preparo")
    .delete()
    .eq("categoria_id", categoriaId);
  if (delErr) throw delErr;

  const rows = etapas
    .map((e, i) => ({
      categoria_id: categoriaId,
      nome: e.nome.trim(),
      duracao_min: Math.max(0, Math.round(Number(e.duracao_min) || 0)),
      ordem: i,
    }))
    .filter((r) => r.nome.length > 0);

  if (rows.length === 0) return;
  const { error } = await supabase
    .from("categoria_etapas_preparo")
    .insert(rows);
  if (error) throw error;
}

/* ---------------- Empresa: tempo de entrega padrão ---------------- */

export async function getTempoEntregaPadrao(): Promise<number> {
  const empresaId = await currentEmpresaId();
  const { data, error } = await supabase
    .from("empresas")
    .select("tempo_entrega_padrao_min")
    .eq("id", empresaId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.tempo_entrega_padrao_min ?? 20);
}

export async function setTempoEntregaPadrao(min: number): Promise<void> {
  const empresaId = await currentEmpresaId();
  const { error } = await supabase
    .from("empresas")
    .update({ tempo_entrega_padrao_min: Math.max(0, Math.round(min)) })
    .eq("id", empresaId);
  if (error) throw error;
}
