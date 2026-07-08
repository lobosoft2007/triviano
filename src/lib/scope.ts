/**
 * Roteamento por escopo baseado em subdomínio (Fase 1).
 *
 * O sistema interpreta o hostname para decidir QUAL universo renderizar:
 *
 *  Universo            | Padrão Triviano                    | Padrão domínio próprio do cliente
 *  --------------------|------------------------------------|-----------------------------------
 *  Delivery (PWA)      | <slug>-app.triviano.com.br         | dominio.com.br | www. | app.
 *  Gerência (retaguarda)| <slug>-adm.triviano.com.br        | adm.dominio.com.br
 *  Caixa/PDV           | <slug>-pdv.triviano.com.br         | pdv.dominio.com.br
 *  Holding (site)      | triviano.com.br / www.             | —
 *  Holding (superadmin)| adm.triviano.com.br                | —
 *
 * A sessão/cookies já ficam naturalmente isolados por subdomínio, pois o
 * Supabase guarda o token em localStorage por origem (cada subdomínio é uma
 * origem distinta). Nenhum trabalho extra é necessário para o isolamento.
 */

export type AppScope =
  | "delivery"
  | "gerencia"
  | "pdv"
  | "holding-site"
  | "holding-adm"
  | "unknown";

export interface ResolvedScope {
  scope: AppScope;
  /** Slug do restaurante (tenant) extraído do subdomínio, quando aplicável. */
  tenantSlug: string | null;
  hostname: string;
}

/** Apex/host da holding Triviano (o "Banco 1" mora em outro projeto). */
const TRIVIANO_APEX = ["triviano.com.br"];

/** Hosts de desenvolvimento/preview onde não há subdomínio real de escopo. */
function isDevOrPreviewHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".local") ||
    host.includes("id-preview--") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com")
  );
}

/** Remove porta e normaliza para minúsculas. */
function normalizeHost(hostname: string): string {
  return hostname.split(":")[0].trim().toLowerCase();
}

/** Verifica se o host pertence ao apex da Triviano (holding namespace). */
function matchTrivianoApex(host: string): string | null {
  for (const apex of TRIVIANO_APEX) {
    if (host === apex || host.endsWith(`.${apex}`)) return apex;
  }
  return null;
}

/**
 * Resolve o escopo e o tenant a partir de um hostname puro (sem override).
 * Função pura — segura para SSR (recebe o host explicitamente).
 */
export function resolveScopeFromHost(hostname: string): ResolvedScope {
  const host = normalizeHost(hostname);

  // Ambientes de preview/dev não têm subdomínio de escopo real: comportam-se
  // como o delivery padrão (todos os atalhos visíveis para facilitar o teste).
  if (isDevOrPreviewHost(host)) {
    return { scope: "unknown", tenantSlug: null, hostname: host };
  }

  const apex = matchTrivianoApex(host);
  const firstLabel = host.split(".")[0];

  // ---- Namespace da holding Triviano ----------------------------------------
  if (apex) {
    // triviano.com.br (raiz) ou www. → site institucional / SaaS
    if (host === apex || firstLabel === "www") {
      return { scope: "holding-site", tenantSlug: null, hostname: host };
    }
    // adm.triviano.com.br → painel corporativo master (Superadmin)
    if (firstLabel === "adm") {
      return { scope: "holding-adm", tenantSlug: null, hostname: host };
    }
    // <slug>-app / <slug>-adm / <slug>-pdv .triviano.com.br → operação do tenant
    const opMatch = firstLabel.match(/^(.+)-(app|adm|pdv)$/);
    if (opMatch) {
      const [, slug, kind] = opMatch;
      return {
        scope: kind === "app" ? "delivery" : kind === "adm" ? "gerencia" : "pdv",
        tenantSlug: slug,
        hostname: host,
      };
    }
    // Qualquer outro subdomínio da Triviano cai no site institucional.
    return { scope: "holding-site", tenantSlug: null, hostname: host };
  }

  // ---- Domínio próprio do cliente (ex.: clube23.com.br) ----------------------
  // adm.dominio → gerência | pdv.dominio → caixa | raiz/www/app → delivery
  if (firstLabel === "adm") {
    return { scope: "gerencia", tenantSlug: null, hostname: host };
  }
  if (firstLabel === "pdv") {
    return { scope: "pdv", tenantSlug: null, hostname: host };
  }
  return { scope: "delivery", tenantSlug: null, hostname: host };
}

const OVERRIDE_KEY = "scope_override";
const VALID_OVERRIDES: AppScope[] = [
  "delivery",
  "gerencia",
  "pdv",
  "holding-site",
  "holding-adm",
];

/**
 * Override manual de escopo (apenas ambientes sem subdomínio real, como o
 * preview). Persistido em sessionStorage via `?scope=pdv|gerencia|delivery`.
 * Retorna null fora do browser.
 */
function readScopeOverride(): AppScope | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("scope");
    if (fromQuery && VALID_OVERRIDES.includes(fromQuery as AppScope)) {
      sessionStorage.setItem(OVERRIDE_KEY, fromQuery);
      return fromQuery as AppScope;
    }
    const stored = sessionStorage.getItem(OVERRIDE_KEY);
    if (stored && VALID_OVERRIDES.includes(stored as AppScope)) {
      return stored as AppScope;
    }
  } catch {
    /* ignore storage/URL errors */
  }
  return null;
}

/**
 * Resolve o escopo atual no browser (host real + override de preview).
 * Deve ser chamado apenas no cliente (após hidratação) para evitar mismatch.
 */
export function resolveCurrentScope(): ResolvedScope {
  if (typeof window === "undefined") {
    return { scope: "unknown", tenantSlug: null, hostname: "" };
  }
  const base = resolveScopeFromHost(window.location.hostname);
  const override = readScopeOverride();
  if (override && (base.scope === "unknown" || base.scope !== override)) {
    // Só permitimos override em hosts sem escopo real (preview/dev).
    if (base.scope === "unknown") {
      return { ...base, scope: override };
    }
  }
  return base;
}
