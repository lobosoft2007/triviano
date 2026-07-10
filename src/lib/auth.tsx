import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { currentHost } from "@/lib/empresa";

/**
 * Tenant claim on login: bind the freshly signed-in account to the company that
 * serves the CURRENT host. Runs on every SIGNED_IN event (password, OTP, magic
 * link, future OAuth). All guards live server-side in `claim_tenant_by_host`:
 * it only re-binds new customer accounts (no prior orders), never staff/admins,
 * and does nothing on preview/dev hosts where no tenant is resolvable.
 */
const claimTenantForCurrentHost = () => {
  const host = currentHost();
  if (!host) return;
  void supabase.rpc("claim_tenant_by_host", { p_host: host });
};

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isCheckoutPath = () =>
  typeof window !== "undefined" && window.location.pathname === "/checkout";

const clearAuthStorage = () => {
  if (typeof window === "undefined") return;
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") || key.includes("supabase") || key.includes("auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore storage errors */
  }
};

const isInvalidAuthError = (error: unknown) => {
  const maybeError = error as { message?: string; status?: number; code?: string; name?: string } | null;
  const message = String(maybeError?.message ?? error ?? "").toLowerCase();
  return (
    maybeError?.status === 400 ||
    maybeError?.status === 401 ||
    maybeError?.code === "refresh_token_not_found" ||
    maybeError?.code === "invalid_grant" ||
    message.includes("refresh_token") ||
    message.includes("refresh token") ||
    message.includes("invalid refresh") ||
    message.includes("jwt")
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingSignedOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSignedOut = () => {
    if (pendingSignedOutRef.current) {
      clearTimeout(pendingSignedOutRef.current);
      pendingSignedOutRef.current = null;
    }
  };

  useEffect(() => {
    let active = true;

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      cancelPendingSignedOut();
      setSession(nextSession);
      setLoading(false);
    };

    const delayCheckoutSignedOut = () => {
      if (!isCheckoutPath()) {
        applySession(null);
        return;
      }
      cancelPendingSignedOut();
      pendingSignedOutRef.current = setTimeout(() => {
        applySession(null);
      }, 3000);
    };

    const validateSession = (nextSession: Session | null) => {
      if (!nextSession) {
        applySession(null);
        return;
      }

      void supabase.auth.getUser().then(({ data, error }) => {
        if (!active) return;
        if (error || !data.user) {
          if (isInvalidAuthError(error)) clearAuthStorage();
          applySession(null);
          return;
        }
        applySession({ ...nextSession, user: data.user });
      });
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        if (isInvalidAuthError(error)) clearAuthStorage();
        applySession(null);
        return;
      }
      validateSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        // Bind a fresh account to the tenant of the current host on login.
        if (event === "SIGNED_IN") claimTenantForCurrentHost();
        validateSession(newSession);
        return;
      }

      // PASSIVE PROVIDER: this listener NEVER navigates or redirects. It only
      // reports session state (user/session/loading). Redirect decisions live
      // exclusively in the route guards under src/routes/.

      // Mobile/PWA returns from a bank app can briefly emit SIGNED_OUT before
      // the stored session is recovered. Do not tear down checkout/cart on that
      // transient frame; confirm the session is still gone after a short grace.
      if (event === "SIGNED_OUT") {
        delayCheckoutSignedOut();
        return;
      }

      applySession(null);
    });

    return () => {
      active = false;
      cancelPendingSignedOut();
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    cancelPendingSignedOut();
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
