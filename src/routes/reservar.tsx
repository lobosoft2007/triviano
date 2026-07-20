import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  CalendarClock,
  Users,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/BrandLogo";
import { PoweredByBadge } from "@/components/PoweredByBadge";
import { useAuth } from "@/lib/auth";
import { empresaQueryOptions } from "@/lib/empresa";
import { fetchFullProfile } from "@/lib/profile";
import { formatBRL } from "@/lib/format";
import {
  reservaDisponibilidade,
  criarReserva,
  type DisponibilidadeSlot,
} from "@/lib/reservas";

export const Route = createFileRoute("/reservar")({
  head: () => ({
    meta: [
      { title: "Reservar mesa — escolha data, horário e tamanho do grupo" },
      {
        name: "description",
        content:
          "Faça sua reserva de mesa em segundos: escolha o dia, o horário e quantas pessoas. Confirmação imediata pelo WhatsApp.",
      },
    ],
  }),
  component: ReservarPage,
});

type Step = "form" | "slots" | "confirmar" | "done";

function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function ReservarPage() {
  const { user } = useAuth();
  const { data: empresa } = useQuery(empresaQueryOptions);

  const [step, setStep] = useState<Step>("form");
  const [data, setData] = useState<string>(todayISO());
  const [pessoas, setPessoas] = useState<number>(2);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [obs, setObs] = useState("");
  const [horaEscolhida, setHoraEscolhida] = useState<string>("");
  const [slots, setSlots] = useState<DisponibilidadeSlot[]>([]);
  const [busy, setBusy] = useState(false);

  // Pré-preenche o nome / telefone com o perfil quando disponível.
  useMemo(() => {
    if (!user?.id || nome || telefone) return;
    fetchFullProfile(user.id).then((p) => {
      if (!p) return;
      setNome((n) => n || p.full_name);
      const tel = [p.ddd, p.telefone].filter(Boolean).join(" ").trim();
      setTelefone((t) => t || tel);
    });
  }, [user?.id, nome, telefone]);

  // A configuração pública de reservas ainda não trafega via empresaQueryOptions
  // (RPC pública devolve apenas branding). Usamos defaults conservadores e o
  // servidor sempre valida o pedido dentro de `criar_reserva`.
  const reservaAtiva = true;
  const grupoMin = 1;
  const grupoMax = 12;
  const sinalAtivo = false;
  const sinalPorPessoa = 0;
  const sinalTotal = sinalAtivo ? sinalPorPessoa * pessoas : 0;

  const consultar = async () => {
    if (pessoas < grupoMin || pessoas > grupoMax) {
      toast.error(`Grupo deve ter entre ${grupoMin} e ${grupoMax} pessoas.`);
      return;
    }
    setBusy(true);
    try {
      const rows = await reservaDisponibilidade(data, pessoas);
      setSlots(rows);
      setStep("slots");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar horários.");
    } finally {
      setBusy(false);
    }
  };

  const escolherHora = (h: string) => {
    setHoraEscolhida(h);
    setStep("confirmar");
  };

  const confirmar = async () => {
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha nome e telefone.");
      return;
    }
    setBusy(true);
    try {
      await criarReserva({
        data,
        hora: horaEscolhida,
        pessoas,
        nome: nome.trim(),
        telefone: telefone.trim(),
        observacoes: obs.trim(),
      });
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar reserva.");
    } finally {
      setBusy(false);
    }
  };

  if (!reservaAtiva) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <BrandLogo showName imgClassName="h-16 w-auto" nameClassName="font-display text-lg font-bold" />
        <CalendarClock className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Este restaurante ainda não recebe reservas online. Fale com o estabelecimento.
        </p>
        <Button asChild variant="secondary">
          <Link to="/">Voltar ao cardápio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Button asChild size="icon" variant="ghost">
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Reservar mesa</p>
          <h1 className="truncate font-display text-xl font-bold">{empresa?.nome ?? "Restaurante"}</h1>
        </div>
      </header>

      {step === "form" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" min={todayISO()} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Quantas pessoas?</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPessoas((n) => Math.max(grupoMin, n - 1))}
              >
                −
              </Button>
              <div className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 py-2 font-semibold">
                <Users className="h-4 w-4" /> {pessoas}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPessoas((n) => Math.min(grupoMax, n + 1))}
              >
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Grupos de {grupoMin} a {grupoMax} pessoas.
            </p>
          </div>
          <Button onClick={consultar} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Ver horários disponíveis
          </Button>
        </section>
      )}

      {step === "slots" && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <h2 className="font-display text-base font-bold">Horários para {data}</h2>
          {slots.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum horário configurado para este dia.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <Button
                  key={s.hora}
                  variant={s.disponivel ? "default" : "secondary"}
                  disabled={!s.disponivel}
                  onClick={() => escolherHora(s.hora)}
                  className="flex h-auto flex-col gap-0.5 py-2"
                >
                  <span className="font-semibold">{s.hora.slice(0, 5)}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    {s.disponivel ? `${s.vagas} vagas` : "cheio"}
                  </span>
                </Button>
              ))}
            </div>
          )}
          <Button variant="ghost" className="w-full" onClick={() => setStep("form")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Trocar data / tamanho
          </Button>
        </section>
      )}

      {step === "confirmar" && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="rounded-lg bg-primary/10 p-3 text-sm">
            <p>
              <span className="font-semibold">Data:</span> {data} · <span className="font-semibold">{horaEscolhida.slice(0, 5)}</span>
            </p>
            <p>
              <span className="font-semibold">Pessoas:</span> {pessoas}
            </p>
            {sinalAtivo && sinalTotal > 0 && (
              <p className="mt-1 text-xs text-primary">
                Sinal para confirmar: <strong>{formatBRL(sinalTotal)}</strong>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Seu nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-1">
            <Label>WhatsApp</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(21) 9 9999-9999"
            />
          </div>
          <div className="space-y-1">
            <Label>Observações (opcional)</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setStep("slots")}>
              Voltar
            </Button>
            <Button onClick={confirmar} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              Confirmar reserva
            </Button>
          </div>
        </section>
      )}

      {step === "done" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold">Reserva confirmada!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviamos os detalhes para o seu WhatsApp. Chegue com até{" "}
              {empresa?.reserva_tolerancia_min ?? 15} min de tolerância.
            </p>
          </div>
          <Button asChild variant="secondary" className="w-full">
            <Link to="/">Voltar ao cardápio</Link>
          </Button>
        </section>
      )}

      <PoweredByBadge className="pt-4" />
    </div>
  );
}
