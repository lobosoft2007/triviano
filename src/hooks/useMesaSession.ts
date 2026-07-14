import { useEffect, useState } from "react";
import {
  getMesaSession,
  MESA_SESSION_EVENT,
  type MesaSession,
} from "@/lib/mesa";

/**
 * Sessão de mesa ativa neste aparelho (comanda liberada pelo Caixa).
 * Reage a mudanças via evento `MESA_SESSION_EVENT` — assim o carrinho e a
 * home sabem, em tempo real, que o app está em "modo mesa".
 */
export function useMesaSession(): {
  session: MesaSession | null;
  hydrated: boolean;
} {
  const [session, setSession] = useState<MesaSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setSession(getMesaSession());
    sync();
    setHydrated(true);
    window.addEventListener(MESA_SESSION_EVENT, sync);
    // Sincroniza entre abas do mesmo aparelho.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MESA_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { session, hydrated };
}
