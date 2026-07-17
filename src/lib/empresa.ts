import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/lib/storage";
import { DEFAULT_BRAND_THEME, type ModoFundo } from "@/lib/theme";

/** UUID fixo da empresa raiz (Clube 23). Usado como tenant padrão. */
export const DEFAULT_EMPRESA_ID = "00000000-0000-0000-0000-000000000023";

/**
 * Slug do tenant de STAGING (sandbox). Todos os hosts nativos da Lovable
 * (preview + URL publicada *.lovable.app) e o localhost são resolvidos para
 * ESTA empresa, isolando os testes dos dados de produção. A produção real só
 * responde em domínios próprios (ex.: app.clube23.com.br).
 *
 * Empresa correspondente: "Pizzaria Teste" (subdominio = "pizzaria-teste").
 */
const STAGING_TENANT_SLUG = "pizzaria-teste";

/** Hosts nativos da Lovable (preview/publicação) e de desenvolvimento local. */
function isStagingHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("127.") ||
    h.endsWith(".local") ||
    h.includes("id-preview--") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovable.dev") ||
    h.endsWith(".lovableproject.com")
  );
}

/**
 * Hostname usado para resolver o tenant (branding, menu, combos e claim de
 * login). Em produção retorna o host real (domínio próprio do cliente). Em
 * qualquer host de STAGING da Lovable retorna um host sintético que o banco
 * resolve para o tenant sandbox "Pizzaria Teste" — assim o ambiente de Preview
 * fica 100% isolado dos dados de produção. No SSR retorna "".
 */
export function currentHost(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (isStagingHost(host)) {
    // Host sintético cujo primeiro rótulo é o slug do tenant de teste; o
    // resolve_empresa_id_by_host casa pelo subdominio "pizzaria-teste".
    return `${STAGING_TENANT_SLUG}.triviano.com.br`;
  }
  return host;
}

/**
 * Ambiente de pagamento detectado AUTOMATICAMENTE a partir do host REAL do
 * navegador (nunca do host sintético de tenant). Regra:
 *  - Staging/Preview/local (localhost, *.lovable.app, id-preview--…) → "test"
 *  - Domínios próprios de produção (*.com.br / *.com) → "prod"
 *
 * Assim o operador cadastra as duas credenciais uma única vez e o software
 * escolhe sozinho qual usar dependendo de onde está rodando. Não confundir com
 * currentHost(), que mascara os hosts de staging como tenant sandbox.
 */
export function currentEnv(): "prod" | "test" {
  if (typeof window === "undefined") return "test";
  return isStagingHost(window.location.hostname) ? "test" : "prod";
}


export interface Empresa {
  id: string;
  nome_fantasia: string;
  /** Storage path OR external URL as stored in the database. */
  logotipo_url: string;
  taxa_servico_mesa: number;
  /** Taxa de entrega FIXA em R$ para pedidos de delivery. 0 = desligada. */
  taxa_entrega_valor: number;
  dominio_customizado: string | null;
  /** Tenant subdomain slug registered for this company (multi-tenant guard). */
  subdominio: string | null;
  /** Dados fiscais da empresa. */
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  /** Visual identity (multi-tenant theming). */
  cor_primaria: string;
  cor_secundaria: string;
  modo_fundo: ModoFundo;
  /** Cashback engine. */
  percentual_cashback: number;
  cashback_ativo: boolean;
  /**
   * Hybrid production routing per sector. When ON, orders go straight to the
   * digital KDS monitor for that sector (no physical coupon). When OFF, the
   * production coupon prints on the sector's thermal printer.
   */
  monitor_cozinha: boolean;
  monitor_bar: boolean;
  monitor_pizzaria: boolean;
  /** AI model used by the Reports Assistant. */
  ai_report_model: string;
  /** AI provider used by the Reports Assistant: 'lovable' | 'openai' | 'google'. */
  ai_report_provider: "lovable" | "openai" | "google";
  /** True when this empresa has a BYO API key stored (raw key never sent to the browser). */
  ai_report_has_key: boolean;
  /** iFood pricing markup percentage (per-channel pricing). */
  markup_ifood_percentual: number;
}


export interface EmpresaBranding extends Empresa {
  /** Displayable (signed / external) URL resolved from logotipo_url. */
  logo_display_url: string;
}




/**
 * Fetch the active company branding (name, logo, domain) and resolve a
 * displayable logo URL. Safe for anonymous visitors — never selects the
 * service fee or address columns. Sensitive config (taxa/endereço) is loaded
 * separately by authenticated flows via {@link fetchEmpresaConfig}.
 */
export async function fetchActiveEmpresa(): Promise<EmpresaBranding> {
  // Anonymous visitors can no longer read the empresas base table (which would
  // expose address + service fee). Public branding is served by a SECURITY
  // DEFINER function that resolves the correct tenant from the current host
  // (custom domain OR subdomain). Falls back to the first active company when
  // no domain matches (preview/dev), preserving single-tenant behavior.
  const { data: rows, error } = await supabase.rpc("get_public_branding_by_host", {
    p_host: currentHost(),
  });
  if (error) throw error;
  const data = (rows ?? [])[0] ?? null;

  const empresa: Empresa = data
    ? {
        id: data.id ?? DEFAULT_EMPRESA_ID,
        nome_fantasia: data.nome_fantasia ?? "",
        logotipo_url: data.logotipo_url ?? "/logo.png",
        // Sensitive config is not exposed by the branding query.
        taxa_servico_mesa: 0,
        taxa_entrega_valor: 0,

        dominio_customizado: data.dominio_customizado ?? null,
        subdominio: data.subdominio ?? null,
        cnpj: "",
        inscricao_estadual: "",
        regime_tributario: "simples_nacional",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        ativo: data.ativo ?? true,
        cor_primaria: data.cor_primaria ?? DEFAULT_BRAND_THEME.cor_primaria,
        cor_secundaria: data.cor_secundaria ?? DEFAULT_BRAND_THEME.cor_secundaria,
        modo_fundo: (data.modo_fundo as ModoFundo) ?? DEFAULT_BRAND_THEME.modo_fundo,
        percentual_cashback: 5,
        cashback_ativo: true,
        monitor_cozinha: false,
        monitor_bar: false,
        monitor_pizzaria: false,
        ai_report_model: "openai/gpt-5.5",
        markup_ifood_percentual: 0,
      }
    : {
        id: DEFAULT_EMPRESA_ID,
        nome_fantasia: "",
        logotipo_url: "/logo.png",
        taxa_servico_mesa: 0,
        taxa_entrega_valor: 0,

        dominio_customizado: null,
        subdominio: null,
        cnpj: "",
        inscricao_estadual: "",
        regime_tributario: "simples_nacional",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        ativo: true,
        cor_primaria: DEFAULT_BRAND_THEME.cor_primaria,
        cor_secundaria: DEFAULT_BRAND_THEME.cor_secundaria,
        modo_fundo: DEFAULT_BRAND_THEME.modo_fundo,
        percentual_cashback: 5,
        cashback_ativo: true,
        monitor_cozinha: false,
        monitor_bar: false,
        monitor_pizzaria: false,
        ai_report_model: "openai/gpt-5.5",
        markup_ifood_percentual: 0,
      };

  const urlMap = await resolveImageUrls([empresa.logotipo_url]);
  return {
    ...empresa,
    logo_display_url: urlMap[empresa.logotipo_url] ?? empresa.logotipo_url,
  };
}

export const empresaQueryOptions = queryOptions({
  queryKey: ["empresa-ativa"],
  queryFn: fetchActiveEmpresa,
  staleTime: 5 * 60 * 1000,
});

/**
 * Fetch the checkout-safe company config for logged-in customers. Reads only
 * the service fee + branding columns (address & cashback config are hidden from
 * regular authenticated users via column-level grants). Used by the checkout
 * total. Admin/config screens must use {@link fetchEmpresaAdminConfig}.
 */
export async function fetchEmpresaConfig(): Promise<EmpresaBranding> {
  // The mesa service fee is no longer readable directly from the empresas table
  // by regular authenticated users. It is served (together with branding) by a
  // role-neutral SECURITY DEFINER function scoped to the active company.
  const { data, error } = await supabase.rpc("get_empresa_checkout_config");
  if (error) throw error;
  const row = (data ?? [])[0];

  const empresa: Empresa = {
    id: row?.id ?? DEFAULT_EMPRESA_ID,
    nome_fantasia: row?.nome_fantasia ?? "",
    logotipo_url: row?.logotipo_url ?? "/logo.png",
    taxa_servico_mesa: Number(row?.taxa_servico_mesa ?? 0),
    taxa_entrega_valor: 0,

    dominio_customizado: row?.dominio_customizado ?? null,
    subdominio: null,
    // Fiscal data is not exposed to regular customers.
    cnpj: "",
    inscricao_estadual: "",
    regime_tributario: "simples_nacional",
    // Address & cashback columns are not readable by regular customers.
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    ativo: row?.ativo ?? true,
    cor_primaria: row?.cor_primaria ?? DEFAULT_BRAND_THEME.cor_primaria,
    cor_secundaria: row?.cor_secundaria ?? DEFAULT_BRAND_THEME.cor_secundaria,
    modo_fundo: (row?.modo_fundo as ModoFundo) ?? DEFAULT_BRAND_THEME.modo_fundo,
    percentual_cashback: 5,
    cashback_ativo: true,
    monitor_cozinha: false,
    monitor_bar: false,
    monitor_pizzaria: false,
    ai_report_model: "openai/gpt-5.5",
    markup_ifood_percentual: 0,
  };

  const urlMap = await resolveImageUrls([empresa.logotipo_url]);
  return {
    ...empresa,
    logo_display_url: urlMap[empresa.logotipo_url] ?? empresa.logotipo_url,
  };
}

export const empresaConfigQueryOptions = queryOptions({
  queryKey: ["empresa-config"],
  queryFn: fetchEmpresaConfig,
  staleTime: 5 * 60 * 1000,
});

/**
 * Fetch the FULL active company config (service fee + address + cashback) for
 * admin/super-admin screens only. Backed by a role-guarded database function so
 * the sensitive columns are never exposed through the public Data API.
 */
export async function fetchEmpresaAdminConfig(): Promise<EmpresaBranding> {
  const { data, error } = await supabase.rpc("admin_get_empresa_config");
  if (error) throw error;
  const row = (data ?? [])[0];

  const empresa: Empresa = {
    id: row?.id ?? DEFAULT_EMPRESA_ID,
    nome_fantasia: row?.nome_fantasia ?? "",
    logotipo_url: row?.logotipo_url ?? "/logo.png",
    taxa_servico_mesa: Number(row?.taxa_servico_mesa ?? 0),
    taxa_entrega_valor: Number((row as { taxa_entrega_valor?: number })?.taxa_entrega_valor ?? 0),

    dominio_customizado: row?.dominio_customizado ?? null,
    subdominio: null,
    cnpj: row?.cnpj ?? "",
    inscricao_estadual: row?.inscricao_estadual ?? "",
    regime_tributario: row?.regime_tributario ?? "simples_nacional",
    cep: row?.cep ?? "",
    logradouro: row?.logradouro ?? "",
    numero: row?.numero ?? "",
    complemento: row?.complemento ?? "",
    bairro: row?.bairro ?? "",
    cidade: row?.cidade ?? "",
    estado: row?.estado ?? "",
    ativo: row?.ativo ?? true,
    cor_primaria: row?.cor_primaria ?? DEFAULT_BRAND_THEME.cor_primaria,
    cor_secundaria: row?.cor_secundaria ?? DEFAULT_BRAND_THEME.cor_secundaria,
    modo_fundo: (row?.modo_fundo as ModoFundo) ?? DEFAULT_BRAND_THEME.modo_fundo,
    percentual_cashback: Number(row?.percentual_cashback ?? 5),
    cashback_ativo: row?.cashback_ativo ?? true,
    monitor_cozinha: row?.monitor_cozinha ?? false,
    monitor_bar: row?.monitor_bar ?? false,
    monitor_pizzaria: row?.monitor_pizzaria ?? false,
    ai_report_model: row?.ai_report_model ?? "openai/gpt-5.5",
    markup_ifood_percentual: Number(row?.markup_ifood_percentual ?? 0),
  };

  const urlMap = await resolveImageUrls([empresa.logotipo_url]);
  return {
    ...empresa,
    logo_display_url: urlMap[empresa.logotipo_url] ?? empresa.logotipo_url,
  };
}

export const empresaAdminConfigQueryOptions = queryOptions({
  queryKey: ["empresa-admin-config"],
  queryFn: fetchEmpresaAdminConfig,
  staleTime: 5 * 60 * 1000,
});

export interface EmpresaUpdate {
  nome_fantasia: string;
  logotipo_url: string;
  taxa_servico_mesa: number;
  taxa_entrega_valor: number;
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  percentual_cashback: number;
  cashback_ativo: boolean;
  /** Hybrid KDS-monitor vs physical-print routing per sector. */
  monitor_cozinha: boolean;
  monitor_bar: boolean;
  monitor_pizzaria: boolean;
  /** AI model used by the Reports Assistant (Lovable AI Gateway). */
  ai_report_model: string;
}


/** Update the active company configuration (admin only, enforced by RLS). */
export async function updateEmpresa(id: string, patch: EmpresaUpdate): Promise<void> {
  const { error } = await supabase.from("empresas").update(patch).eq("id", id);
  if (error) throw error;
}

export interface EmpresaThemeUpdate {
  cor_primaria: string;
  cor_secundaria: string;
  modo_fundo: ModoFundo;
}

/** Update only the visual-identity columns (admin only, enforced by RLS). */
export async function updateEmpresaTheme(
  id: string,
  patch: EmpresaThemeUpdate,
): Promise<void> {
  const { error } = await supabase.from("empresas").update(patch).eq("id", id);
  if (error) throw error;
}
