import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertManager(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  // Master admin OR Admin Local (manager). Both are scoped to their own empresa
  // by the empresa_id filters below and can only grant the "admin" role.
  const { data, error } = await context.supabase.rpc("is_local_admin");
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (!data) throw new Error("Acesso restrito. Apenas administradores da empresa.");
}

/** Admin cria uma conta de funcionário e vincula a um nível de acesso. */
export const createFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        nivel_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context);

    const { data: prof } = await context.supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", context.userId)
      .single();
    const empresa_id = (prof as { empresa_id?: string } | null)?.empresa_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, empresa_id },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Falha ao criar o funcionário.");

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ nivel_id: data.nivel_id, empresa_id, full_name: data.full_name })
      .eq("id", uid);
    if (upErr) throw new Error(upErr.message);

    // Grant the operational role so the staff member can use the Caixa/back-office
    // RPCs. UI access is still governed by the level's permission matrix, and the
    // permissions/employees screens remain locked to the master admin (no level).
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(roleErr.message);

    return { id: uid };
  });

/** Admin remove definitivamente a conta de um funcionário da sua empresa. */
export const deleteFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);

    const { data: adminProf } = await context.supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", context.userId)
      .single();
    const adminEmpresa = (adminProf as { empresa_id?: string } | null)?.empresa_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("empresa_id, nivel_id")
      .eq("id", data.user_id)
      .single();
    const targetRow = target as { empresa_id?: string; nivel_id?: string | null } | null;
    if (!targetRow || targetRow.empresa_id !== adminEmpresa) {
      throw new Error("Funcionário não encontrado nesta empresa.");
    }
    if (!targetRow.nivel_id) {
      throw new Error("Este usuário não é um funcionário.");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
