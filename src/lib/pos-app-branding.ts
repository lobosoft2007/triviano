import { supabase } from "@/integrations/supabase/client";
import { currentEmpresaId } from "@/lib/storage";

export const POS_APP_ICON_BUCKET = "pos-app-icons";

export interface PosAppBranding {
  empresa_id: string;
  app_label: string;
  icon_path: string | null;
  icon_display_url: string | null;
  updated_at: string | null;
}

/** Loads the current empresa's Tap app branding (label + icon signed URL). */
export async function fetchPosAppBranding(): Promise<PosAppBranding | null> {
  const { data, error } = await supabase.rpc("admin_get_pos_branding");
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;

  let icon_display_url: string | null = null;
  if (row.icon_path) {
    const { data: signed } = await supabase.storage
      .from(POS_APP_ICON_BUCKET)
      .createSignedUrl(row.icon_path, 60 * 60 * 24 * 7);
    icon_display_url = signed?.signedUrl ?? null;
  }

  return {
    empresa_id: row.empresa_id,
    app_label: row.app_label,
    icon_path: row.icon_path,
    icon_display_url,
    updated_at: row.updated_at,
  };
}

/** Upload a new source icon (>= 512x512 PNG) and return its storage path. */
export async function uploadPosAppIcon(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const empresaId = await currentEmpresaId();
  const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(POS_APP_ICON_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });
  if (error) throw error;
  return path;
}

/** Upsert the empresa's Tap app branding (label + optional new icon path). */
export async function savePosAppBranding(input: {
  app_label: string;
  icon_path: string | null;
}): Promise<void> {
  const empresaId = await currentEmpresaId();
  const label = input.app_label.trim();
  if (label.length < 1 || label.length > 30) {
    throw new Error("O nome do aplicativo deve ter entre 1 e 30 caracteres.");
  }
  const { error } = await supabase
    .from("pos_app_branding")
    .upsert(
      {
        empresa_id: empresaId,
        app_label: label,
        icon_path: input.icon_path,
      },
      { onConflict: "empresa_id" },
    );
  if (error) throw error;
}

/**
 * Client-side validation: file must be a PNG at least 512x512. Returns the
 * loaded HTMLImageElement so the caller can build previews.
 */
export function validatePosAppIcon(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!/^image\/png$/i.test(file.type)) {
      reject(new Error("O ícone precisa estar no formato PNG."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < 512 || img.height < 512) {
        reject(new Error("O ícone precisa ter no mínimo 512x512 pixels."));
        return;
      }
      if (img.width !== img.height) {
        reject(new Error("O ícone precisa ser quadrado (largura = altura)."));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler o arquivo enviado."));
    };
    img.src = url;
  });
}
