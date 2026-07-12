import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  canEnterAdmin,
  canEnterCaixa,
  firstAllowedRoute,
  type MyPermissions,
} from "@/lib/permissions";

/** Fetches the effective permission matrix for the logged-in user. */
async function loadPermissions(): Promise<MyPermissions | undefined> {
  const { data, error } = await supabase.rpc("get_my_permissions");
  if (error) return undefined;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MyPermissions) ?? undefined;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    const userRole =
      (data.user as { role?: string } | null)?.role ??
      (data.user?.app_metadata as { role?: string } | undefined)?.role;

    // Fast path: empresa admin flagged in app_metadata bypasses the matrix.
    if (userRole === "admin") return { user: data.user };

    if (error || !data.user) {
      const path = location.pathname;
      if (path === "/caixa" || path === "/admin") {
        try {
          sessionStorage.setItem("post_login_redirect", path);
        } catch {
          /* ignore storage errors */
        }
      }
      throw redirect({ to: "/auth" });
    }

    // --- Camada 1: guarda de porta por superfície sensível --------------
    const path = location.pathname;

    if (path === "/superadmin") {
      const { data: sa } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!sa) {
        const perms = await loadPermissions();
        throw redirect({
          to: firstAllowedRoute(perms),
          search: { denied: "superadmin" },
        });
      }
      return { user: data.user };
    }

    if (path === "/caixa" || path === "/admin") {
      const perms = await loadPermissions();
      // Master admin (matrix bypass) always passes.
      if (perms?.is_admin) return { user: data.user };

      if (path === "/caixa" && !canEnterCaixa(perms)) {
        throw redirect({
          to: firstAllowedRoute(perms),
          search: { denied: "caixa" },
        });
      }
      if (path === "/admin" && !canEnterAdmin(perms)) {
        throw redirect({
          to: firstAllowedRoute(perms),
          search: { denied: "admin" },
        });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
