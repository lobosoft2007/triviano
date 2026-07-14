import { APP_VERSION } from "@/lib/version";

/**
 * Rótulo discreto exibido em formulários e diálogos-chave (v1.7.2).
 * Ex.: "Desenvolvido por Triviano — v1.7.2".
 */
export function PoweredByBadge({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-center text-[10px] font-medium tracking-wide text-muted-foreground ${className}`}
    >
      Desenvolvido por Triviano — v{APP_VERSION}
    </p>
  );
}
