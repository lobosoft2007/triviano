/**
 * Multi-tenant visual identity engine.
 *
 * Each franchise stores a primary color, a secondary color and a background
 * mode ('dark' | 'light'). These are injected as native CSS variables on the
 * DOM root so every Tailwind token (`bg-primary`, `text-primary`, `bg-card`…)
 * — which already resolves through `var(--primary)` etc. in styles.css —
 * instantly recolors. Neutrals are locked to two curated palettes (premium
 * dark or clean light) so a tenant can never ship an illegible background.
 */

export type ModoFundo = "dark" | "light";

export interface BrandTheme {
  cor_primaria: string;
  cor_secundaria: string;
  modo_fundo: ModoFundo;
}

export const DEFAULT_BRAND_THEME: BrandTheme = {
  cor_primaria: "#1FAA6A",
  cor_secundaria: "#F2B24C",
  modo_fundo: "dark",
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(v: string | null | undefined): v is string {
  return !!v && HEX_RE.test(v.trim());
}

export function normalizeHex(hex: string): string {
  let c = hex.trim().replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  return "#" + c.toLowerCase();
}

/** Relative luminance (WCAG) of a hex color, 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const c = normalizeHex(hex).slice(1);
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Returns near-black or white text that keeps AA contrast on `hex`. */
export function readableForeground(hex: string): string {
  return luminance(hex) > 0.42 ? "#0a0a0a" : "#ffffff";
}

/** Curated premium dark neutrals (current Netflix-style shell). */
const DARK_NEUTRALS: Record<string, string> = {
  "--background": "oklch(0 0 0)",
  "--foreground": "oklch(0.98 0 0)",
  "--card": "oklch(0.16 0.006 160)",
  "--card-foreground": "oklch(0.98 0 0)",
  "--popover": "oklch(0.16 0.006 160)",
  "--popover-foreground": "oklch(0.98 0 0)",
  "--secondary": "oklch(0.21 0.01 160)",
  "--secondary-foreground": "oklch(0.96 0 0)",
  "--muted": "oklch(0.19 0.008 160)",
  "--muted-foreground": "oklch(0.7 0.02 160)",
  "--border": "oklch(1 0 0 / 12%)",
  "--input": "oklch(1 0 0 / 14%)",
  "--sidebar": "oklch(0.1 0.005 160)",
  "--sidebar-foreground": "oklch(0.98 0 0)",
  "--sidebar-accent": "oklch(0.21 0.01 160)",
  "--sidebar-accent-foreground": "oklch(0.96 0 0)",
  "--sidebar-border": "oklch(1 0 0 / 12%)",
};

/** Curated clean/minimal light neutrals. */
const LIGHT_NEUTRALS: Record<string, string> = {
  "--background": "oklch(0.99 0 0)",
  "--foreground": "oklch(0.16 0 0)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.16 0 0)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.16 0 0)",
  "--secondary": "oklch(0.955 0 0)",
  "--secondary-foreground": "oklch(0.22 0 0)",
  "--muted": "oklch(0.955 0 0)",
  "--muted-foreground": "oklch(0.45 0 0)",
  "--border": "oklch(0 0 0 / 10%)",
  "--input": "oklch(0 0 0 / 12%)",
  "--sidebar": "oklch(0.97 0 0)",
  "--sidebar-foreground": "oklch(0.16 0 0)",
  "--sidebar-accent": "oklch(0.94 0 0)",
  "--sidebar-accent-foreground": "oklch(0.22 0 0)",
  "--sidebar-border": "oklch(0 0 0 / 10%)",
};

/** Normalizes any partial/invalid input into a safe brand theme. */
export function coerceBrandTheme(input: Partial<BrandTheme> | null | undefined): BrandTheme {
  return {
    cor_primaria: isValidHex(input?.cor_primaria)
      ? normalizeHex(input!.cor_primaria)
      : DEFAULT_BRAND_THEME.cor_primaria,
    cor_secundaria: isValidHex(input?.cor_secundaria)
      ? normalizeHex(input!.cor_secundaria)
      : DEFAULT_BRAND_THEME.cor_secundaria,
    modo_fundo: input?.modo_fundo === "light" ? "light" : "dark",
  };
}

/** Full CSS-variable map for a theme, usable as inline style or on the root. */
export function brandThemeVars(input: Partial<BrandTheme>): Record<string, string> {
  const t = coerceBrandTheme(input);
  const neutrals = t.modo_fundo === "light" ? LIGHT_NEUTRALS : DARK_NEUTRALS;
  return {
    ...neutrals,
    "--primary": t.cor_primaria,
    "--primary-foreground": readableForeground(t.cor_primaria),
    "--ring": t.cor_primaria,
    "--sidebar-primary": t.cor_primaria,
    "--sidebar-primary-foreground": readableForeground(t.cor_primaria),
    "--accent": t.cor_secundaria,
    "--accent-foreground": readableForeground(t.cor_secundaria),
  };
}

/** Applies a brand theme to the document root (or a given element). */
export function applyBrandTheme(
  input: Partial<BrandTheme>,
  el: HTMLElement | null = typeof document !== "undefined"
    ? document.documentElement
    : null,
): void {
  if (!el) return;
  const t = coerceBrandTheme(input);
  const vars = brandThemeVars(t);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  el.classList.toggle("dark", t.modo_fundo !== "light");
  el.classList.toggle("light", t.modo_fundo === "light");
}
