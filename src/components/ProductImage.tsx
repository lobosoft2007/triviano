import { useEffect, useState } from "react";
import {
  FOOD_PLACEHOLDER,
  categoryFallbackImage,
  resolveInitialImage,
} from "@/lib/imageFallback";

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
 * Product image with a 2-stage fallback: real image → category stock image →
 * generic food placeholder. Guarantees the app never renders a broken image.
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
  const [imgSrc, setImgSrc] = useState(() =>
    resolveInitialImage(src, categorySlug),
  );

  useEffect(() => {
    setImgSrc(resolveInitialImage(src, categorySlug));
  }, [src, categorySlug]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading={loading}
      width={width}
      height={height}
      className={className}
      onError={() =>
        setImgSrc((prev) => {
          if (prev === FOOD_PLACEHOLDER) return prev;
          const fb = categoryFallbackImage(categorySlug);
          return prev !== fb ? fb : FOOD_PLACEHOLDER;
        })
      }
    />
  );
}
