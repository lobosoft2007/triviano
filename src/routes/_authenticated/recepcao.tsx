import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  MoveRight,
  Plus,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/permissions";
import {
  cancelarReserva,
  darEntradaReserva,
  filaAdicionar,
  filaAvisar,
  filaSentar,
  listFila,
  listMesasFisicas,
  listReservasDoDia,
} from "@/lib/reservas";

export const Route = createFileRoute("/_authenticated/recepcao")({
  head: () => ({
    meta: [
      { title: "Recepção — Reservas e Fila de Espera" },
      { name: "description", content: "Painel da recepção: gerenciamento de reservas do dia e fila walk-in." },
    ],
  }),
  component: RecepcaoPage,
});

function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function RecepcaoPage() {
  const qc = useQueryClient();
  const { data: perms, isLoading: permsLoading } = usePermissions();
  const [dataFiltro, setDataFiltro] = useState<string>(todayISO());

  const podeAcessar =
    perms?.is_admin || perms?.is_manager || perms?.acesso_recepcao || perms?.acesso_mesas;

  const { data: reservas, isLoading: rLoading } = useQuery({
    queryKey: ["recepcao-reservas", dataFiltro],
    queryFn: () => listReservasDoDia(dataFiltro),
    enabled: !!podeAcessar,
    refetchInterval: 15000,
  });
  const { data: fila, isLoading: fLoading } = useQuery({
    queryKey: ["recepcao-fila"],
    queryFn: listFila,
    enabled: !!podeAcessar,
    refetchInterval: 15000,
  });
  const { data: mesas } = useQuery({
    queryKey: ["mesas-fisicas"],
    queryFn: listMesasFisicas,
    enabled: !!podeAcessar,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["recepcao-reservas"] });
    qc.invalidateQueries({ queryKey: ["recepcao-fila"] });
  };

  if (permsLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!podeAcessar) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <BellRing className="h-10 w-10 text-muted-foreground" />
        <div>
          <h1 className="font-display text-lg font-bold">Recepção</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu nível de acesso não permite abrir o painel da recepção.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/caixa">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <AppShell className="h-[100dvh]">
      <ShellHeader className="border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/caixa">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Recepção</p>
            <h1 className="truncate font-display text-xl font-bold leading-tight">
              Reservas & Fila de Espera
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </ShellHeader>

      <ShellBody className="grid gap-6 px-4 py-5 lg:grid-cols-2 lg:px-8">
        {/* Reservas do dia */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="font-display text-base font-bold">Reservas de {dataFiltro}</h2>
          </div>
          {rLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (reservas ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma reserva para este dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {(reservas ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-11 w-14 flex-col items-center justify-center rounded-md bg-primary/10 font-mono text-sm font-bold text-primary">
                      {r.hora.slice(0, 5)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.pessoas} pessoa{r.pessoas > 1 ? "s" : ""} · {r.telefone || "sem telefone"}
                        {r.observacoes && <span> · “{r.observacoes}”</span>}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  {(r.status === "confirmada" || r.status === "aguardando_pagamento") && (
                    <div className="flex gap-2">
                      <SentarSelect
                        mesas={(mesas ?? []).map((m) => ({ numero: m.numero, capacidade: m.capacidade }))}
                        onPick={async (n) => {
                          try {
                            await darEntradaReserva(r.id, n);
                            toast.success(`Reserva sentada na Mesa ${n}.`);
                            invalidateAll();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao sentar.");
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          if (!confirm(`Cancelar a reserva de ${r.nome}?`)) return;
                          try {
                            await cancelarReserva(r.id);
                            invalidateAll();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao cancelar.");
                          }
                        }}
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Fila de espera */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-base font-bold">Fila de Espera</h2>
          </div>

          <NovaFilaForm onDone={invalidateAll} />

          {fLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (fila ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Fila vazia.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(fila ?? []).map((f) => (
                <li
                  key={f.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {f.posicao}º
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.pessoas} pessoa{f.pessoas > 1 ? "s" : ""} · {f.telefone || "sem telefone"}
                      </p>
                    </div>
                    <FilaStatusPill status={f.status} />
                  </div>
                  <div className="flex gap-2">
                    {f.status === "aguardando" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await filaAvisar(f.id);
                            toast.success("Aviso enviado.");
                            invalidateAll();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao avisar.");
                          }
                        }}
                      >
                        <BellRing className="mr-1 h-4 w-4" /> Avisar
                      </Button>
                    )}
                    <SentarSelect
                      mesas={(mesas ?? []).map((m) => ({ numero: m.numero, capacidade: m.capacidade }))}
                      onPick={async (n) => {
                        try {
                          await filaSentar(f.id, n);
                          toast.success(`Cliente sentado na Mesa ${n}.`);
                          invalidateAll();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha ao sentar.");
                        }
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ShellBody>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmada: { label: "Confirmada", cls: "bg-green-100 text-green-700" },
    aguardando_pagamento: { label: "Aguardando sinal", cls: "bg-amber-100 text-amber-700" },
    atendida: { label: "Atendida", cls: "bg-blue-100 text-blue-700" },
    cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
    no_show: { label: "No-show", cls: "bg-destructive/10 text-destructive" },
  };
  const m = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function FilaStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    aguardando: { label: "Aguardando", cls: "bg-secondary text-muted-foreground" },
    avisado: { label: "Avisado", cls: "bg-amber-100 text-amber-700" },
  };
  const m = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function SentarSelect({
  mesas,
  onPick,
}: {
  mesas: { numero: number; capacidade: number }[];
  onPick: (n: number) => void;
}) {
  const [val, setVal] = useState<string>("");
  return (
    <Select
      value={val}
      onValueChange={(v) => {
        setVal("");
        onPick(Number(v));
      }}
    >
      <SelectTrigger className="h-9 w-40">
        <SelectValue placeholder="Sentar em..." />
      </SelectTrigger>
      <SelectContent>
        {mesas.length === 0 && (
          <SelectItem value="__none" disabled>
            Nenhuma mesa cadastrada
          </SelectItem>
        )}
        {mesas.map((m) => (
          <SelectItem key={m.numero} value={String(m.numero)}>
            Mesa {m.numero} · {m.capacidade} lugares
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NovaFilaForm({ onDone }: { onDone: () => void }) {
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [pes, setPes] = useState("2");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const n = nome.trim();
    const pessoas = Number(pes);
    if (!n || pessoas <= 0) {
      toast.error("Informe nome e quantidade.");
      return;
    }
    setBusy(true);
    try {
      await filaAdicionar(n, tel.trim(), pessoas);
      setNome("");
      setTel("");
      setPes("2");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_120px_90px_auto]">
      <Input placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input placeholder="Telefone" value={tel} onChange={(e) => setTel(e.target.value)} />
      <Input
        type="number"
        min={1}
        placeholder="Pessoas"
        value={pes}
        onChange={(e) => setPes(e.target.value)}
      />
      <Button onClick={add} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
        Colocar na fila
      </Button>
    </div>
  );
}
