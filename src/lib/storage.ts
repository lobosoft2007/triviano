import { supabase } from "@/integrations/supabase/client";

export const MENU_IMAGE_BUCKET = "imagens-cardapio";
export const CERT_BUCKET = "certificados-fiscais";

/** Upload a digital A1 certificate (.pfx / .p12) to the secure private bucket. */
export async function uploadCertificate(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "pfx";
  const path = `a1/${crypto.randomUUID()}.${ext}`;
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
  const path = `menu/${crypto.randomUUID()}.${ext}`;
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
