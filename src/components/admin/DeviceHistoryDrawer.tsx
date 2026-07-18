import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Activity } from "lucide-react";
import { fetchDeviceEvents } from "@/lib/pos-ops";

const TIPO_LABEL: Record<string, string> = {
  heartbeat: "Batimento",
  login: "Login",
  logout: "Logout",
  erro_sdk: "Erro SDK",
  erro_pix: "Erro PIX",
  erro_impressao: "Erro impressão",
  ota_aplicada: "OTA aplicada",
  config_alterada: "Config alterada",
  ping_ack: "Ping (ACK)",
  bloqueado: "Bloqueado",
  desbloqueado: "Desbloqueado",
};

const TIPO_COLOR: Record<string, string> = {
  erro_sdk: "text-destructive",
  erro_pix: "text-destructive",
  erro_impressao: "text-destructive",
  bloqueado: "text-amber-600",
  desbloqueado: "text-emerald-600",
};

export function DeviceHistoryDrawer({
  deviceId, nome, open, onOpenChange,
}: {
  deviceId: string; nome: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const q = useQuery({
    queryKey: ["pos-device-events", deviceId],
    queryFn: () => fetchDeviceEvents(deviceId, 80),
    enabled: open,
    refetchInterval: open ? 10_000 : false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Histórico — {nome}</DialogTitle>
          <DialogDescription>
            Últimos eventos (batimentos, erros, ações remotas). Atualiza a cada 10s.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
          {q.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Activity className="h-5 w-5" /> Nenhum evento registrado ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((e) => (
                <li key={e.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${TIPO_COLOR[e.tipo] ?? ""}`}>
                      {TIPO_LABEL[e.tipo] ?? e.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {e.payload && Object.keys(e.payload).length > 0 && (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 text-[11px] leading-snug">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Wrapper hook to control the drawer without lifting a ton of state up. */
export function useDeviceHistoryDrawer() {
  const [state, setState] = useState<{ id: string; nome: string } | null>(null);
  return {
    open: (id: string, nome: string) => setState({ id, nome }),
    close: () => setState(null),
    render: () =>
      state && (
        <DeviceHistoryDrawer
          deviceId={state.id}
          nome={state.nome}
          open={!!state}
          onOpenChange={(o) => !o && setState(null)}
        />
      ),
  };
}
