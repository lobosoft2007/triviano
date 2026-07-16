import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("is_local_admin");
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Acesso restrito a administradores.");
}

/** Generates a strong random throwaway password (client never sees it). */
function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Admin creates a full customer profile in auth.users + public.profiles.
 * The customer receives no password — they set one via the standard
 * "Forgot my password" flow on /auth.
 * Optionally emits a recovery link right away (send_reset=true).
 */
export const createClienteByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        full_name: z.string().trim().min(1).max(120),
        cep: z.string().trim().max(9).default(""),
        tipo_logradouro: z.string().trim().max(30).default(""),
        logradouro: z.string().trim().max(200).default(""),
        numero: z.string().trim().max(20).default(""),
        complemento: z.string().trim().max(100).default(""),
        bairro: z.string().trim().max(120).default(""),
        municipio: z.string().trim().max(120).default(""),
        estado: z.string().trim().max(2).default(""),
        ddd: z.string().trim().max(3).default(""),
        telefone: z.string().trim().max(20).default(""),
        latitude: z.number().nullable().default(null),
        longitude: z.number().nullable().default(null),
        send_reset: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: adminProf } = await context.supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", context.userId)
      .single();
    const empresa_id =
      (adminProf as { empresa_id?: string } | null)?.empresa_id ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const address = [
      [data.tipo_logradouro, data.logradouro].filter(Boolean).join(" "),
      data.numero,
      data.complemento,
      data.bairro,
      data.municipio,
      data.estado,
      data.cep ? `CEP ${data.cep}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const phone = [data.ddd, data.telefone].filter(Boolean).join(" ").trim();

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: data.full_name, empresa_id },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        throw new Error("Já existe uma conta com esse e-mail.");
      }
      throw new Error(error.message);
    }
    const uid = created.user?.id;
    if (!uid) throw new Error("Falha ao criar o cliente.");

    // handle_new_user trigger creates the profiles row; fill in the rest.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        empresa_id,
        address,
        phone,
        cep: data.cep,
        tipo_logradouro: data.tipo_logradouro,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        estado: data.estado,
        ddd: data.ddd,
        telefone: data.telefone,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      .eq("id", uid);
    if (upErr) {
      // Rollback the auth user so it doesn't linger without a profile.
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => undefined);
      throw new Error(upErr.message);
    }

    if (data.send_reset) {
      // Fires the standard recovery email through the auth hook (custom template).
      await supabaseAdmin.auth
        .resetPasswordForEmail(data.email)
        .catch(() => undefined);
    }

    return { ok: true, id: uid };
  });
