import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { empresaQueryOptions } from "@/lib/empresa";
import { applyBrandTheme } from "@/lib/theme";

/**
 * Reads the active tenant's visual identity and injects it as native CSS
 * variables on the document root, recoloring the whole PWA instantly. Renders
 * nothing. Safe for anonymous visitors (branding query only).
 */
export function BrandThemeInjector() {
  const { data: empresa } = useQuery(empresaQueryOptions);

  useEffect(() => {
    if (!empresa) return;
    applyBrandTheme({
      cor_primaria: empresa.cor_primaria,
      cor_secundaria: empresa.cor_secundaria,
      modo_fundo: empresa.modo_fundo,
    });
  }, [empresa?.cor_primaria, empresa?.cor_secundaria, empresa?.modo_fundo]);

  return null;
}
