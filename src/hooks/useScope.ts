import { useEffect, useState } from "react";
import { resolveCurrentScope, type ResolvedScope } from "@/lib/scope";

/**
 * Escopo do app resolvido no cliente (após hidratação, para evitar mismatch
 * de SSR). Enquanto não hidrata, retorna `hydrated: false` e escopo "unknown".
 */
export function useScope(): ResolvedScope & { hydrated: boolean } {
  const [state, setState] = useState<ResolvedScope>({
    scope: "unknown",
    tenantSlug: null,
    hostname: "",
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(resolveCurrentScope());
    setHydrated(true);
  }, []);

  return { ...state, hydrated };
}
