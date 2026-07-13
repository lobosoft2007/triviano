import type { PermissionFlag } from "@/lib/permissions";

/**
 * Modelos de cargo prontos. Ao criar um nível de acesso, o Master pode partir
 * de um preset que já liga as permissões típicas daquele cargo. Depois é só
 * ajustar qualquer chave manualmente na matriz.
 */
export interface CargoPreset {
  id: string;
  nome: string;
  descricao: string;
  /** When true, the level becomes an Admin Local (full manager of the company). */
  is_admin_local?: boolean;
  flags: Partial<Record<PermissionFlag, boolean>>;
}

const ALL_FLAGS_TRUE: Partial<Record<PermissionFlag, boolean>> = {
  acesso_kds_cozinha: true,
  acesso_bar: true,
  acesso_atendimento_balcao: true,
  acesso_mesas: true,
  acesso_delivery: true,
  acesso_entregas: true,
  acesso_entrada_estoque: true,
  acesso_sangria_suprimento: true,
  acesso_cadastro_produtos: true,
  acesso_financeiro: true,
  acesso_rh: true,
  acesso_abrir_fechar_caixa: true,
};

export const CARGO_PRESETS: CargoPreset[] = [
  {
    id: "proprietario",
    nome: "Proprietário",
    descricao: "Admin Local — acesso total à empresa",
    is_admin_local: true,
    flags: ALL_FLAGS_TRUE,
  },
  {
    id: "admin",
    nome: "Admin",
    descricao: "Acesso total à empresa",
    flags: {
      acesso_kds_cozinha: true,
      acesso_bar: true,
      acesso_atendimento_balcao: true,
      acesso_mesas: true,
      acesso_delivery: true,
      acesso_entregas: true,
      acesso_entrada_estoque: true,
      acesso_sangria_suprimento: true,
      acesso_cadastro_produtos: true,
      acesso_financeiro: true,
      acesso_rh: true,
      acesso_abrir_fechar_caixa: true,
    },
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Financeiro e sangria/suprimento",
    flags: { acesso_financeiro: true, acesso_sangria_suprimento: true },
  },
  {
    id: "rh",
    nome: "RH",
    descricao: "Gestão de equipe",
    flags: { acesso_rh: true },
  },
  {
    id: "cozinheiro",
    nome: "Cozinheiro",
    descricao: "Tela da cozinha (KDS)",
    flags: { acesso_kds_cozinha: true },
  },
  {
    id: "garcom",
    nome: "Garçom",
    descricao: "Mesas e atendimento de balcão",
    flags: { acesso_mesas: true, acesso_atendimento_balcao: true },
  },
  {
    id: "barman",
    nome: "Barman",
    descricao: "Tela do bar",
    flags: { acesso_bar: true },
  },
  {
    id: "entregador",
    nome: "Entregador",
    descricao: "Painel de entregas e delivery",
    flags: { acesso_entregas: true, acesso_delivery: true },
  },
];

export const CUSTOM_PRESET_ID = "custom";
