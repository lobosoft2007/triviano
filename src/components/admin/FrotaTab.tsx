import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Battery, BatteryLow, Wifi, WifiOff, Printer, Radio, AlertTriangle,
  History, Ban, CheckCircle2, LogOut, Bell, Filter, Loader2, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  fetchFleetKpis, fetchFleetDevices, sendPosCommand, isOnline, timeAgo,
  type PosDeviceHealth, type PosCommand,
} from "@/lib/pos-ops";
import { useDeviceHistoryDrawer } from "@/components/admin/DeviceHistoryDrawer";

const FLAVOR_LABEL: Record<string, string> = {
  rede: "Rede",
  pagseguro: "PagSeguro",
  infinitepay: "InfinitePay",
};

type FilterKind = "todos" | "offline" | "erro" | "bateria";

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "danger" | "ok" }) {
  const toneCls =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function DeviceCard({
  d, onCommand, onHistory,
}: {
  d: PosDeviceHealth;
  onCommand: (id: string, cmd: PosCommand) => void;
  onHistory: (id: string, nome: string) => void;
}) {
  const online = isOnline(d.last_seen_at);
  const batt = d.battery_pct;
  const battTone = batt == null ? "text-muted-foreground" : batt < 20 ? "text-destructive" : batt < 40 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className={`flex flex-col rounded-xl border p-4 ${d.revogado_em ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{d.nome}</span>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          </div>
          <div className="text-xs text-muted-foreground">{FLAVOR_LABEL[d.flavor] ?? d.flavor}</div>
        </div>
        <div className="text-right text-xs">
          {d.revogado_em ? (
            <span className="rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">Revogada</span>
          ) : !d.ativo ? (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">Bloqueada</span>
          ) : online ? (
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">Online</span>
          ) : (
            <span className="rounded bg-muted px-2 py-0.5 font-semibold text-muted-foreground">Offline</span>
          )}
          <div className="mt-1 text-muted-foreground">há {timeAgo(d.last_seen_at)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className={`flex items-center gap-1 ${battTone}`}>
          {batt != null && batt < 20 ? <BatteryLow className="h-3.5 w-3.5" /> : <Battery className="h-3.5 w-3.5" />}
          {batt != null ? `${batt}%` : "bateria n/d"}
        </div>
        <div className="flex items-center gap-1">
          {d.network_type && d.network_type !== "offline" ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
          {d.network_type ?? "rede n/d"}
        </div>
        <div className={`flex items-center gap-1 ${d.printer_ok === false ? "text-destructive" : ""}`}>
          <Printer className="h-3.5 w-3.5" /> {d.printer_ok == null ? "impressora n/d" : d.printer_ok ? "impressora ok" : "impressora com erro"}
        </div>
        <div className={`flex items-center gap-1 ${d.nfc_ok === false ? "text-destructive" : ""}`}>
          <Radio className="h-3.5 w-3.5" /> {d.nfc_ok == null ? "NFC n/d" : d.nfc_ok ? "NFC ok" : "NFC indisponível"}
        </div>
        <div className="col-span-2 text-muted-foreground">
          app v{d.app_version ?? "?"} · SO {d.os_version ?? "?"} {d.sdk_provider_ativo ? ` · SDK ${d.sdk_provider_ativo}` : ""}
        </div>
        {d.last_error && (
          <div className="col-span-2 flex items-start gap-1 text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{d.last_error}</span>
          </div>
        )}
      </div>

      {!d.revogado_em && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => onCommand(d.id, "ping")}>
            <Bell className="mr-1 h-3.5 w-3.5" /> Ping
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onCommand(d.id, "reimprimir_ultimo")}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Reimprimir
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onCommand(d.id, "limpar_fila_offline")}>
            <Activity className="mr-1 h-3.5 w-3.5" /> Limpar fila
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onCommand(d.id, "forcar_logout")}>
            <LogOut className="mr-1 h-3.5 w-3.5" /> Deslogar
          </Button>
          {d.ativo ? (
            <Button size="sm" variant="destructive" onClick={() => onCommand(d.id, "bloquear")}>
              <Ban className="mr-1 h-3.5 w-3.5" /> Bloquear
            </Button>
          ) : (
            <Button size="sm" onClick={() => onCommand(d.id, "desbloquear")}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Desbloquear
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onHistory(d.id, d.nome)}>
            <History className="mr-1 h-3.5 w-3.5" /> Histórico
          </Button>
        </div>
      )}
    </div>
  );
}

export function FrotaTab() {
  const qc = useQueryClient();
  const drawer = useDeviceHistoryDrawer();

  const kpisQ = useQuery({ queryKey: ["pos-fleet-kpis"], queryFn: fetchFleetKpis, refetchInterval: 30_000 });
  const devsQ = useQuery({ queryKey: ["pos-fleet-devs"], queryFn: fetchFleetDevices, refetchInterval: 15_000 });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("todos");

  const mut = useMutation({
    mutationFn: ({ id, cmd }: { id: string; cmd: PosCommand }) => sendPosCommand(id, cmd),
    onSuccess: (_, v) => {
      toast.success(`Comando "${v.cmd}" enviado.`);
      qc.invalidateQueries({ queryKey: ["pos-fleet-devs"] });
      qc.invalidateQueries({ queryKey: ["pos-fleet-kpis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = useMemo(() => {
    const src = devsQ.data ?? [];
    return src.filter((d) => {
      if (search && !d.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "offline") return !isOnline(d.last_seen_at) && !d.revogado_em;
      if (filter === "erro") return !!d.last_error;
      if (filter === "bateria") return d.battery_pct != null && d.battery_pct < 20;
      return true;
    });
  }, [devsQ.data, search, filter]);

  const kpis = kpisQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold">Frota de maquininhas</h2>
        <p className="text-sm text-muted-foreground">
          Monitore em tempo real cada dispositivo Tap/POS, envie comandos remotos e acompanhe erros.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Online agora" value={`${kpis?.online ?? 0}/${kpis?.total ?? 0}`} tone="ok" />
        <Kpi label="Bateria < 20%" value={String(kpis?.bateria_baixa ?? 0)} tone={kpis && kpis.bateria_baixa > 0 ? "warn" : "default"} />
        <Kpi label="Erros nas últimas 24h" value={String(kpis?.erros_24h ?? 0)} tone={kpis && kpis.erros_24h > 0 ? "danger" : "default"} />
        <Kpi label="Transacionado hoje" value={fmtBRL(kpis?.transacionado_hoje ?? 0)} />
        <Kpi label="Total pareado" value={String(kpis?.total ?? 0)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome…"
          className="max-w-xs"
        />
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterKind)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="offline">Offline no momento</SelectItem>
              <SelectItem value="erro">Com erro recente</SelectItem>
              <SelectItem value="bateria">Bateria &lt; 20%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {devsQ.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum dispositivo encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <DeviceCard
              key={d.id}
              d={d}
              onCommand={(id, cmd) => mut.mutate({ id, cmd })}
              onHistory={drawer.open}
            />
          ))}
        </div>
      )}

      {drawer.render()}
    </div>
  );
}
