import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  RespostaEmissao,
  TipoDocumentoFiscal,
  TipoEventoManifestacao,
} from "@/lib/fiscal/types";

export const emitirNFCePorPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { empresa_id: string; order_id: string }) => input,
  )
  .handler(async ({ data, context }): Promise<RespostaEmissao> => {
    const { emitirNotaFiscalPorPedido } = await import("@/lib/fiscal/engine");
    const empresaId = data.empresa_id;
    const orderId = data.order_id;

    // Verifica se o usuário é admin da empresa
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Acesso restrito a administradores.");
    }

    return emitirNotaFiscalPorPedido(empresaId, orderId, "NFCE");
  });

export const emitirNFePorPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { empresa_id: string; order_id: string }) => input,
  )
  .handler(async ({ data, context }): Promise<RespostaEmissao> => {
    const { emitirNotaFiscalPorPedido } = await import("@/lib/fiscal/engine");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Acesso restrito a administradores.");
    }
    return emitirNotaFiscalPorPedido(data.empresa_id, data.order_id, "NFE");
  });

export const consultarDFe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { empresa_id: string; cnpj: string; ultimo_nsu?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { consultarDFe: engineConsultar } = await import("@/lib/fiscal/engine");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Acesso restrito a administradores.");
    }
    return engineConsultar(data.empresa_id, data.cnpj, data.ultimo_nsu);
  });

export const manifestarNFe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      empresa_id: string;
      chave_acesso: string;
      tipo_evento: TipoEventoManifestacao;
      justificativa?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { manifestarNFe: engineManifestar } = await import("@/lib/fiscal/engine");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Acesso restrito a administradores.");
    }
    return engineManifestar(
      data.empresa_id,
      data.chave_acesso,
      data.tipo_evento,
      data.justificativa,
    );
  });

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

export const pingProvedorFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { empresa_id: string }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { pingProvedor } = await import("@/lib/fiscal/engine");
    return pingProvedor(data.empresa_id);
  });

export const sincronizarEmpresaFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { empresa_id: string }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { sincronizarEmpresaFiscal: run } = await import("@/lib/fiscal/engine");
    return run(data.empresa_id);
  });

export const sincronizarCertificadoFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { empresa_id: string }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { sincronizarCertificadoFiscal: run } = await import("@/lib/fiscal/engine");
    return run(data.empresa_id);
  });

export const emitirNFCeTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { empresa_id: string }) => input)
  .handler(async ({ data, context }): Promise<RespostaEmissao> => {
    await ensureAdmin(context);
    const { emitirNFCeTeste: run } = await import("@/lib/fiscal/engine");
    return run(data.empresa_id);
  });
