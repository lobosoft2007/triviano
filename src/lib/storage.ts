import { supabase } from "@/integrations/supabase/client";

export const MENU_IMAGE_BUCKET = "imagens-cardapio";
export const CERT_BUCKET = "certificados-fiscais";

/**
 * Resolve the current admin's company id. Storage objects MUST be stored under
 * an `<empresa_id>/...` prefix so the tenant-scoped storage policies allow the
 * write and block cross-tenant access to another company's files.
 */
export async function currentEmpresaId(): Promise<string> {
  const { data, error } = await supabase.rpc("current_empresa_id");
  if (error) throw error;
  if (!data) throw new Error("Não foi possível identificar o estabelecimento atual.");
  return data as string;
}

/** Upload a digital A1 certificate (.pfx / .p12) to the secure private bucket. */
export async function uploadCertificate(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "pfx";
  const empresaId = await currentEmpresaId();
  const path = `${empresaId}/a1/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(CERT_BUCKET).upload(path, file, {
    cacheControl: "0",
    upsert: false,
    contentType: file.type || "application/x-pkcs12",
  });
  if (error) throw error;
  return path;
}

/** A value is an external/static URL if it's a full URL or an app asset path. */
export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//.test(value) || value.startsWith("/");
}

/**
 * Performance safety net: ask Supabase for a WebP variant capped at `width`px.
 * Public Storage URLs are routed through the image render (transformation)
 * endpoint so they are physically resized; private/signed URLs just receive the
 * hint params. Non-Supabase URLs (Unsplash, app assets) are returned untouched.
 * If the transformed request ever fails, ProductImage falls back to the plain
 * URL, so no real photo is ever lost.
 */
export function withImageTransform(url: string, width = 500): string {
  if (!url || !url.includes("/storage/v1/") || url.includes("/render/image/")) {
    return url;
  }
  const out = url.includes("/object/public/")
    ? url.replace("/object/public/", "/render/image/public/")
    : url;
  const sep = out.includes("?") ? "&" : "?";
  return `${out}${sep}width=${width}&format=webp`;
}

/**
 * Resolve stored image references into displayable URLs.
 * - External URLs (http/https or "/asset" paths) are returned as-is.
 * - Storage object paths are turned into signed URLs (bucket is private).
 */
export async function resolveImageUrls(
  refs: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const toSign: string[] = [];

  for (const ref of refs) {
    if (!ref) continue;
    if (isExternalUrl(ref)) {
      map[ref] = ref;
    } else if (!(ref in map)) {
      toSign.push(ref);
    }
  }

  if (toSign.length > 0) {
    const unique = Array.from(new Set(toSign));
    const { data } = await supabase.storage
      .from(MENU_IMAGE_BUCKET)
      .createSignedUrls(unique, 60 * 60 * 24 * 7); // 7 days
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
    }
  }

  return map;
}

/** Upload a local image file to the menu bucket and return its storage path. */
export async function uploadMenuImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const empresaId = await currentEmpresaId();
  const path = `${empresaId}/menu/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;
  return path;
}

/** Upload a company logo to the (private) menu bucket and return its storage path. */
export async function uploadEmpresaLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const empresaId = await currentEmpresaId();
  const path = `${empresaId}/logos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;
  return path;
}
