import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** All permission flags governed by the dynamic access matrix. */
export type PermissionFlag =
  | "acesso_kds_cozinha"
  | "acesso_bar"
  | "acesso_atendimento_balcao"
  | "acesso_mesas"
  | "acesso_delivery"
  | "acesso_entregas"
  | "acesso_entrada_estoque"
  | "acesso_sangria_suprimento"
  | "acesso_cadastro_produtos"
  | "acesso_financeiro"
  | "acesso_rh"
  | "acesso_abrir_fechar_caixa";

export interface MyPermissions extends Record<PermissionFlag, boolean> {
  is_admin: boolean;
  /** Admin Local: full manager of their own company (e.g. "Proprietário"). */
  is_manager: boolean;
  is_funcionario: boolean;
}

const DENY_ALL: MyPermissions = {
  is_admin: false,
  is_manager: false,
  is_funcionario: false,
  acesso_kds_cozinha: false,
  acesso_bar: false,
  acesso_atendimento_balcao: false,
  acesso_mesas: false,
  acesso_delivery: false,
  acesso_entregas: false,
  acesso_entrada_estoque: false,
  acesso_sangria_suprimento: false,
  acesso_cadastro_produtos: false,
  acesso_financeiro: false,
  acesso_rh: false,
  acesso_abrir_fechar_caixa: false,
};

export const PERMISSION_LABELS: { key: PermissionFlag; label: string }[] = [
  { key: "acesso_kds_cozinha", label: "Cozinha (KDS)" },
  { key: "acesso_bar", label: "Bar" },
  { key: "acesso_atendimento_balcao", label: "Atendimento Balcão" },
  { key: "acesso_mesas", label: "Mesas" },
  { key: "acesso_delivery", label: "Delivery" },
  { key: "acesso_entregas", label: "Entregas (Entregador)" },
  { key: "acesso_entrada_estoque", label: "Entrada de Estoque" },
  { key: "acesso_sangria_suprimento", label: "Sangria / Suprimento" },
  { key: "acesso_abrir_fechar_caixa", label: "Abrir / Fechar Caixa" },
  { key: "acesso_cadastro_produtos", label: "Cadastro de Produtos" },
  { key: "acesso_financeiro", label: "Financeiro" },
  { key: "acesso_rh", label: "RH / Gestão de Equipe" },
];

/** Effective permissions for the logged-in user. Admins bypass the matrix. */
export function usePermissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MyPermissions> => {
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as MyPermissions) ?? DENY_ALL;
    },
  });
}

/** True when the user may reach the Caixa/Retaguarda area at all. */
export function canEnterCaixa(p: MyPermissions | undefined): boolean {
  if (!p) return false;
  return (
    p.is_admin ||
    p.acesso_atendimento_balcao ||
    p.acesso_mesas ||
    p.acesso_delivery ||
    p.acesso_financeiro ||
    p.acesso_sangria_suprimento
  );
}

/** True when the user is staff (admin or funcionário with a level). */
export function isStaff(p: MyPermissions | undefined): boolean {
  return !!p && (p.is_admin || p.is_funcionario);
}

/**
 * True when the user is a full manager of their own company: the master admin
 * (Triviano-flagged / nivel_id NULL) OR an "Admin Local" level (e.g.
 * "Proprietário"). Managers unlock every master-gated module, still scoped to
 * their own empresa_id by RLS.
 */
export function isManager(p: MyPermissions | undefined): boolean {
  return !!p && (p.is_admin || p.is_manager);
}

/** True when the user may reach the Retaguarda (/admin) area at all. */
export function canEnterAdmin(p: MyPermissions | undefined): boolean {
  if (!p) return false;
  return (
    p.is_admin ||
    p.is_manager ||
    p.acesso_cadastro_produtos ||
    p.acesso_financeiro ||
    p.acesso_entrada_estoque
  );
}

/** Standard message shown whenever a user hits a forbidden surface/module. */
export const ACCESS_DENIED_MSG =
  "Acesso negado: sua função não permite esta operação.";

/** Tabs of the Caixa panel and the matrix flag (or "master") each one requires. */
export type CaixaTab =
  | "delivery"
  | "mesas"
  | "balcao"
  | "config"
  | "fiado"
  | "clientes";

export const CAIXA_TAB_FLAG: Record<CaixaTab, PermissionFlag | "master"> = {
  delivery: "acesso_delivery",
  mesas: "acesso_mesas",
  balcao: "acesso_atendimento_balcao",
  config: "master",
  fiado: "acesso_financeiro",
  clientes: "master",
};

/** Display order used to pick the first Caixa tab a user is allowed to open. */
export const CAIXA_TAB_ORDER: CaixaTab[] = [
  "delivery",
  "mesas",
  "balcao",
  "fiado",
  "config",
  "clientes",
];

/** True when the given Caixa tab is allowed for the user's permission set. */
export function caixaTabAllowed(p: MyPermissions | undefined, key: CaixaTab): boolean {
  if (!p) return false;
  // Master admin and Admin Local (manager) reach every tab, including "master".
  if (p.is_admin || p.is_manager) return true;
  const flag = CAIXA_TAB_FLAG[key];
  return flag !== "master" && Boolean(p[flag]);
}

/**
 * Smart default landing: the best surface a user can actually reach, so a
 * staff member without access to the default page is routed to their first
 * permitted module instead of a dead end. Super admin is handled separately
 * in the route guard (it depends on the user_roles table, not the matrix).
 */
export function firstAllowedRoute(
  p: MyPermissions | undefined,
): "/" | "/caixa" | "/admin" {
  if (canEnterCaixa(p)) return "/caixa";
  if (canEnterAdmin(p)) return "/admin";
  return "/";
}
