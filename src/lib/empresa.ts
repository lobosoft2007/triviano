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
}

export interface EmpresaBranding extends Empresa {
  /** Displayable (signed / external) URL resolved from logotipo_url. */
  logo_display_url: string;
}

/** Full column set — readable only by authenticated users (RLS + grants). */
const EMPRESA_COLS =
  "id, nome_fantasia, logotipo_url, taxa_servico_mesa, dominio_customizado, cep, logradouro, numero, complemento, bairro, cidade, estado, ativo, cor_primaria, cor_secundaria, modo_fundo";

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
    .from("empresas")
    .select(EMPRESA_BRANDING_COLS)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const empresa: Empresa = data
    ? {
        id: data.id,
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
 * Fetch the FULL active company config (service fee + address) for
 * authenticated flows only (checkout service fee, admin config form).
 * Anonymous visitors cannot read these columns (RLS + column grants).
 */
export async function fetchEmpresaConfig(): Promise<EmpresaBranding> {
  const { data, error } = await supabase
    .from("empresas")
    .select(EMPRESA_COLS)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const empresa: Empresa = data
    ? {
        id: data.id,
        nome_fantasia: data.nome_fantasia ?? "",
        logotipo_url: data.logotipo_url ?? "/logo.png",
        taxa_servico_mesa: Number(data.taxa_servico_mesa ?? 0),
        dominio_customizado: data.dominio_customizado ?? null,
        cep: data.cep ?? "",
        logradouro: data.logradouro ?? "",
        numero: data.numero ?? "",
        complemento: data.complemento ?? "",
        bairro: data.bairro ?? "",
        cidade: data.cidade ?? "",
        estado: data.estado ?? "",
        ativo: data.ativo ?? true,
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
}

/** Update the active company configuration (admin only, enforced by RLS). */
export async function updateEmpresa(id: string, patch: EmpresaUpdate): Promise<void> {
  const { error } = await supabase.from("empresas").update(patch).eq("id", id);
  if (error) throw error;
}
