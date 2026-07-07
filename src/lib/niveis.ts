import { supabase } from "@/integrations/supabase/client";
import type { PermissionFlag } from "@/lib/permissions";

export interface Nivel {
  id: string;
  nome_nivel: string;
}

export interface Matriz extends Record<PermissionFlag, boolean> {
  nivel_id: string;
}

export interface NivelComMatriz extends Nivel {
  matriz: Matriz;
}

const FLAGS: PermissionFlag[] = [
  "acesso_kds_cozinha",
  "acesso_atendimento_balcao",
  "acesso_mesas",
  "acesso_delivery",
  "acesso_entrada_estoque",
  "acesso_sangria_suprimento",
  "acesso_cadastro_produtos",
  "acesso_financeiro",
];

/** Loads every access level of the admin's company with its permission matrix. */
export async function fetchNiveis(): Promise<NivelComMatriz[]> {
  const { data: niveis, error } = await supabase
    .from("niveis_acesso")
    .select("id, nome_nivel")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const { data: matrizes, error: mErr } = await supabase
    .from("permissoes_matriz")
    .select("*");
  if (mErr) throw mErr;

  const byNivel = new Map((matrizes ?? []).map((m) => [m.nivel_id, m]));
  return (niveis ?? []).map((n) => {
    const raw = byNivel.get(n.id);
    const matriz = { nivel_id: n.id } as Matriz;
    for (const f of FLAGS) matriz[f] = Boolean(raw?.[f]);
    return { id: n.id, nome_nivel: n.nome_nivel, matriz };
  });
}

export async function createNivel(nome_nivel: string): Promise<void> {
  const { error } = await supabase.from("niveis_acesso").insert({ nome_nivel });
  if (error) throw error;
}

export async function renameNivel(id: string, nome_nivel: string): Promise<void> {
  const { error } = await supabase.from("niveis_acesso").update({ nome_nivel }).eq("id", id);
  if (error) throw error;
}

export async function deleteNivel(id: string): Promise<void> {
  const { error } = await supabase.from("niveis_acesso").delete().eq("id", id);
  if (error) throw error;
}

export async function setFlag(
  nivel_id: string,
  flag: PermissionFlag,
  value: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("permissoes_matriz")
    .update({ [flag]: value })
    .eq("nivel_id", nivel_id);
  if (error) throw error;
}

export interface Funcionario {
  id: string;
  full_name: string | null;
  nivel_id: string | null;
  nome_nivel: string | null;
}

export async function fetchFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase.rpc("admin_list_funcionarios");
  if (error) throw error;
  return (data ?? []) as Funcionario[];
}

export async function setFuncionarioNivel(user_id: string, nivel_id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_funcionario_nivel", {
    p_user_id: user_id,
    p_nivel_id: nivel_id,
  });
  if (error) throw error;
}
