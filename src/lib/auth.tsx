import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isCheckoutPath = () =>
  typeof window !== "undefined" && window.location.pathname === "/checkout";

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

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        applySession(newSession);
        return;
      }

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
