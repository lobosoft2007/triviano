import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/pos/branding/:slug
 * Header: x-build-token: <POS_BUILD_TOKEN>
 * Retorna { empresaId, subdominio, appLabel, packageSuffix, iconUrl, updatedAt }
 * Usado pelo pipeline de build do APK Tap (repo triviano-tap) para gerar
 * automaticamente o ícone e o app_name de cada empresa-cliente.
 */
export const Route = createFileRoute("/api/public/pos/branding/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ params, request }) => {
        const token = process.env.POS_BUILD_TOKEN;
        if (!token) return json({ error: "build token não configurado" }, 500);
        const provided = request.headers.get("x-build-token") ?? "";
        if (provided !== token) return json({ error: "unauthorized" }, 401);

        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!slug) return json({ error: "slug obrigatório" }, 400);

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin.rpc(
          "get_pos_build_branding",
          { p_subdominio: slug },
        );
        if (error) return json({ error: error.message }, 500);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return json({ error: "empresa não encontrada" }, 404);

        let iconUrl: string | null = null;
        if (row.icon_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("pos-app-icons")
            .createSignedUrl(row.icon_path, 60 * 60);
          iconUrl = signed?.signedUrl ?? null;
        }

        // sanitize suffix: letras/números apenas, para applicationId Android
        const packageSuffix = slug.replace(/[^a-z0-9]/g, "");

        return json({
          empresaId: row.empresa_id,
          subdominio: row.subdominio,
          appLabel: row.app_label,
          packageSuffix,
          applicationId: `com.triviano.tap.${packageSuffix}`,
          iconUrl,
          updatedAt: row.updated_at,
        });
      },
    },
  },
});

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-build-token",
  };
}
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...cors() },
  });
}
