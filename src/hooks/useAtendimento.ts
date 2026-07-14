import { useEffect, useState } from "react";
import {
  getStatusAtendimento,
  setStatusAtendimento as writeStatus,
  ATENDIMENTO_EVENT,
  type StatusAtendimento,
} from "@/lib/atendimento";

/**
 * Contexto de atendimento ativo neste aparelho ('DELIVERY' | 'MESA').
 * Reage ao evento `ATENDIMENTO_EVENT` e ao `storage` (sincroniza abas),
 * espelhando o padrão de `useMesaSession`.
 */
export function useAtendimento(): {
  status: StatusAtendimento;
  setStatus: (s: StatusAtendimento) => void;
  hydrated: boolean;
} {
  const [status, setStatus] = useState<StatusAtendimento>("DELIVERY");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setStatus(getStatusAtendimento());
    sync();
    setHydrated(true);
    window.addEventListener(ATENDIMENTO_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ATENDIMENTO_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { status, setStatus: writeStatus, hydrated };
}
