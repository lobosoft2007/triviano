import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/lib/storage";
import { DEFAULT_BRAND_THEME, type ModoFundo } from "@/lib/theme";

/** UUID fixo da empresa raiz (Clube 23). Usado como tenant padrão. */
export const DEFAULT_EMPRESA_ID = "00000000-0000-0000-0000-000000000023";

export interface Empresa {
  id: string;
  nome_fantasia: string;
  /** Storage path OR external URL as stored in the database. */
  logotipo_url: string;
  taxa_servico_mesa: number;
  dominio_customizado: string | null;
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
}

export interface EmpresaBranding extends Empresa {
  /** Displayable (signed / external) URL resolved from logotipo_url. */
  logo_display_url: string;
}

/**

 * Branding-only column set. This is the ONLY set anonymous visitors are
 * allowed to read from `empresas` (service fee + full address are hidden from
 * anon via column-level grants). Used by the public/shared branding query.
 * Includes the visual-identity columns so the PWA can theme for anon visitors.
 */
const EMPRESA_BRANDING_COLS =
  "id, nome_fantasia, logotipo_url, dominio_customizado, ativo, cor_primaria, cor_secundaria, modo_fundo";


/**
 * Fetch the active company branding (name, logo, domain) and resolve a
 * displayable logo URL. Safe for anonymous visitors — never selects the
 * service fee or address columns. Sensitive config (taxa/endereço) is loaded
 * separately by authenticated flows via {@link fetchEmpresaConfig}.
 */
export async function fetchActiveEmpresa(): Promise<EmpresaBranding> {
  const { data, error } = await supabase
    .from("empresas_public_branding")
    .select(EMPRESA_BRANDING_COLS)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const empresa: Empresa = data
    ? {
        id: data.id ?? DEFAULT_EMPRESA_ID,
        nome_fantasia: data.nome_fantasia ?? "",
        logotipo_url: data.logotipo_url ?? "/logo.png",
        // Sensitive config is not exposed by the branding query.
        taxa_servico_mesa: 0,
        dominio_customizado: data.dominio_customizado ?? null,
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
      }
    : {
        id: DEFAULT_EMPRESA_ID,
        nome_fantasia: "",
        logotipo_url: "/logo.png",
        taxa_servico_mesa: 0,
        dominio_customizado: null,
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
    dominio_customizado: row?.dominio_customizado ?? null,
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
    dominio_customizado: row?.dominio_customizado ?? null,
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
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  percentual_cashback: number;
  cashback_ativo: boolean;
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
