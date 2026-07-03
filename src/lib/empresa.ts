import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/lib/storage";

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
}

export interface EmpresaBranding extends Empresa {
  /** Displayable (signed / external) URL resolved from logotipo_url. */
  logo_display_url: string;
}

/** Full column set — readable only by authenticated users (RLS + grants). */
const EMPRESA_COLS =
  "id, nome_fantasia, logotipo_url, taxa_servico_mesa, dominio_customizado, cep, logradouro, numero, complemento, bairro, cidade, estado, ativo";

/**
 * Branding-only column set. This is the ONLY set anonymous visitors are
 * allowed to read from `empresas` (service fee + full address are hidden from
 * anon via column-level grants). Used by the public/shared branding query.
 */
const EMPRESA_BRANDING_COLS =
  "id, nome_fantasia, logotipo_url, dominio_customizado, ativo";

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

export const empresaQueryOptions = queryOptions({
  queryKey: ["empresa-ativa"],
  queryFn: fetchActiveEmpresa,
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
