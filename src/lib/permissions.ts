import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** All permission flags governed by the dynamic access matrix. */
export type PermissionFlag =
  | "acesso_kds_cozinha"
  | "acesso_atendimento_balcao"
  | "acesso_mesas"
  | "acesso_delivery"
  | "acesso_entrada_estoque"
  | "acesso_sangria_suprimento"
  | "acesso_cadastro_produtos"
  | "acesso_financeiro";

export interface MyPermissions extends Record<PermissionFlag, boolean> {
  is_admin: boolean;
  is_funcionario: boolean;
}

const DENY_ALL: MyPermissions = {
  is_admin: false,
  is_funcionario: false,
  acesso_kds_cozinha: false,
  acesso_atendimento_balcao: false,
  acesso_mesas: false,
  acesso_delivery: false,
  acesso_entrada_estoque: false,
  acesso_sangria_suprimento: false,
  acesso_cadastro_produtos: false,
  acesso_financeiro: false,
};

export const PERMISSION_LABELS: { key: PermissionFlag; label: string }[] = [
  { key: "acesso_kds_cozinha", label: "Cozinha (KDS)" },
  { key: "acesso_atendimento_balcao", label: "Atendimento Balcão" },
  { key: "acesso_mesas", label: "Mesas" },
  { key: "acesso_delivery", label: "Delivery" },
  { key: "acesso_entrada_estoque", label: "Entrada de Estoque" },
  { key: "acesso_sangria_suprimento", label: "Sangria / Suprimento" },
  { key: "acesso_cadastro_produtos", label: "Cadastro de Produtos" },
  { key: "acesso_financeiro", label: "Financeiro" },
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
