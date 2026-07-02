import { useQuery } from "@tanstack/react-query";
import { empresaQueryOptions } from "@/lib/empresa";

interface BrandLogoProps {
  /** Show the company name next to the logo. */
  showName?: boolean;
  className?: string;
  imgClassName?: string;
  nameClassName?: string;
}

/**
 * Dynamic company branding (logo + name) sourced from the active empresa row.
 * Falls back gracefully while loading so the layout never jumps.
 */
export function BrandLogo({
  showName = true,
  className = "",
  imgClassName = "",
  nameClassName = "",
}: BrandLogoProps) {
  const { data: empresa } = useQuery(empresaQueryOptions);
  const name = empresa?.nome_fantasia || "";
  const logo = empresa?.logo_display_url || "/logo.png";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logo}
        alt={name || "Logotipo"}
        className={imgClassName || "h-8 w-8 rounded-lg object-contain"}
      />
      {showName && (
        <span className={nameClassName || "font-display text-xl font-bold leading-tight text-white"}>
          {name}
        </span>
      )}
    </div>
  );
}
