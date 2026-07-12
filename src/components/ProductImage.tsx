import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FOOD_PLACEHOLDER,
  categoryFallbackImage,
  resolveInitialImage,
} from "@/lib/imageFallback";
import { withImageTransform } from "@/lib/storage";

interface Props {
  /** Real product image URL (may be empty/null). */
  src: string | undefined | null;
  alt: string;
  categorySlug: string | undefined | null;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
}

/**
 * Product image with three qualities:
 *  1. Performance — native lazy loading + a WebP/500px transform request.
 *  2. No layout jump — a pulsing skeleton fills the exact box until the photo
 *     decodes, then the image fades in smoothly.
 *  3. Never broken — a fallback chain: transformed → original → category stock
 *     image → generic food placeholder.
 */
export function ProductImage({
  src,
  alt,
  categorySlug,
  className,
  width,
  height,
  loading = "lazy",
}: Props) {
  // Ordered candidates the <img> will try, cheapest/best first.
  const chain = useMemo(() => {
    const base = resolveInitialImage(src, categorySlug);
    const transformed = withImageTransform(base, width ?? 500);
    const catFb = categoryFallbackImage(categorySlug);
    const list: string[] = [];
    for (const url of [transformed, base, catFb, FOOD_PLACEHOLDER]) {
      if (url && !list.includes(url)) list.push(url);
    }
    return list;
  }, [src, categorySlug, width]);

  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Reset whenever the source set changes.
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [chain]);

  return (
    <span className={cn("relative block overflow-hidden", className)}>
      {!loaded && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}
      <img
        src={chain[idx]}
        alt={alt}
        loading={loading}
        width={width}
        height={height}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setIdx((prev) => (prev < chain.length - 1 ? prev + 1 : prev));
        }}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
