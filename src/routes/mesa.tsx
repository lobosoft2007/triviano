import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  QrCode,
  Camera,
  ArrowLeft,
  Armchair,
  CheckCircle2,
  XCircle,
  LogIn,
} from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { empresaQueryOptions } from "@/lib/empresa";
import { fetchFullProfile } from "@/lib/profile";
import {
  parseMesaQr,
  abrirSolicitacaoMesa,
  desistirSolicitacao,
  fetchSolicitacao,
  fetchMinhaComandaAberta,
  MESA_COMANDA_KEY,
  MESA_NUMERO_KEY,
  type SolicitacaoMesaStatus,
} from "@/lib/mesa";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/mesa")({
  head: () => ({
    meta: [
      { title: "Consumir na mesa — peça pelo QR-Code" },
      {
        name: "description",
        content:
          "Escaneie o QR-Code da sua mesa, confirme seus dados e faça seu pedido direto do celular.",
      },
    ],
  }),
  component: MesaPage,
});

type Step = "form" | "scanning" | "waiting" | "result";

function MesaPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: empresa } = useQuery(empresaQueryOptions);

  const [step, setStep] = useState<Step>("form");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  const [solicitacaoId, setSolicitacaoId] = useState<string | null>(null);
  const [numeroMesa, setNumeroMesa] = useState<number | null>(null);
  const [status, setStatus] = useState<SolicitacaoMesaStatus>("aguardando");
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  /* -------- Prefill nome/telefone do perfil ------------------------- */
  useEffect(() => {
    if (!user?.id || prefilled) return;
    let alive = true;
    fetchFullProfile(user.id)
      .then((p) => {
        if (!alive || !p) return;
        setNome((n) => n || p.full_name);
        const tel = [p.ddd, p.telefone].filter(Boolean).join(" ").trim();
        setTelefone((t) => t || tel);
        setPrefilled(true);
      })
      .catch(() => {
        /* ignore — usuário digita manualmente */
      });
    return () => {
      alive = false;
    };
  }, [user?.id, prefilled]);

  /* -------- Realtime: aguarda o "Visto" do caixa -------------------- */
  useEffect(() => {
    if (step !== "waiting" || !solicitacaoId) return;

    const channel = supabase
      .channel(`solicitacao-${solicitacaoId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "solicitacoes_mesa",
          filter: `id=eq.${solicitacaoId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: SolicitacaoMesaStatus })
            .status;
          if (next) setStatus(next);
        },
      )
      .subscribe();

    // Fallback de polling (caso o realtime demore a conectar).
    const poll = setInterval(async () => {
      try {
        const s = await fetchSolicitacao(solicitacaoId);
        if (s) setStatus(s.status);
      } catch {
        /* ignore */
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [step, solicitacaoId]);

  /* -------- Reage à mudança de status ------------------------------- */
  useEffect(() => {
    if (step !== "waiting") return;
    if (status === "liberada") {
      void handleLiberada();
    } else if (status === "recusada" || status === "expirada") {
      setStep("result");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, step]);

  async function handleLiberada() {
    try {
      if (numeroMesa != null) {
        const comanda = await fetchMinhaComandaAberta(numeroMesa);
        if (comanda) {
          setMesaSession(comanda.id, numeroMesa);
        }
      }
    } catch {
      /* segue mesmo assim */
    }
    toast.success("Mesa liberada! Bom apetite 🍽️");
    navigate({ to: "/", replace: true });
  }

  /* -------- Câmera / leitura do QR --------------------------------- */
  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startScanning() {
    if (!nome.trim()) {
      toast.error("Informe seu nome para continuar.");
      return;
    }
    setStep("scanning");
    // aguarda o <video> montar
    setTimeout(async () => {
      if (!videoRef.current) return;
      try {
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            const parsed = parseMesaQr(result.getText());
            if (parsed) {
              stopCamera();
              void submitSolicitacao(parsed.numero, parsed.token);
            }
          },
        );
      } catch {
        toast.error(
          "Não foi possível acessar a câmera. Autorize o acesso e tente novamente.",
        );
        setStep("form");
      }
    }, 120);
  }

  async function submitSolicitacao(numero: number, token: string) {
    setBusy(true);
    try {
      const id = await abrirSolicitacaoMesa(
        numero,
        token,
        nome.trim(),
        telefone.trim(),
      );
      setSolicitacaoId(id);
      setNumeroMesa(numero);
      setStatus("aguardando");
      setStep("waiting");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível abrir a mesa.",
      );
      setStep("form");
    } finally {
      setBusy(false);
    }
  }

  async function handleDesistir() {
    if (!solicitacaoId) {
      setStep("form");
      return;
    }
    setBusy(true);
    try {
      await desistirSolicitacao(solicitacaoId);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
      setSolicitacaoId(null);
      setStep("form");
      setStatus("aguardando");
    }
  }

  /* -------- Não autenticado ---------------------------------------- */
  if (!loading && !user) {
    return (
      <Shell empresaNome={empresa?.nome_fantasia}>
        <div className="text-center">
          <Armchair className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">
            Consumir na mesa
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre na sua conta para abrir a mesa e pedir pelo celular.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              try {
                sessionStorage.setItem("post_login_redirect", "/mesa");
              } catch {
                /* ignore */
              }
              navigate({ to: "/auth" });
            }}
          >
            <LogIn className="h-4 w-4" />
            Entrar para continuar
          </Button>
        </div>
      </Shell>
    );
  }

  /* -------- Render por etapa --------------------------------------- */
  return (
    <Shell empresaNome={empresa?.nome_fantasia}>
      {step === "form" && (
        <div>
          <div className="text-center">
            <Armchair className="mx-auto h-11 w-11 text-primary" />
            <h1 className="mt-3 font-display text-2xl font-bold">
              Consumir na mesa
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirme seus dados e leia o QR-Code da mesa.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Seu nome
              </span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Telefone (WhatsApp)
              </span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <Button className="mt-6 w-full" onClick={startScanning} disabled={busy}>
            <QrCode className="h-4 w-4" />
            Ler QR-Code da mesa
          </Button>
        </div>
      )}

      {step === "scanning" && (
        <div className="text-center">
          <h2 className="font-display text-xl font-bold">Aponte para o QR</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enquadre o código que está na mesa.
          </p>
          <div className="relative mx-auto mt-5 aspect-square w-full max-w-xs overflow-hidden rounded-2xl border-2 border-primary/60 bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
          </div>
          {busy && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando mesa…
            </div>
          )}
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => {
              stopCamera();
              setStep("form");
            }}
          >
            <Camera className="h-4 w-4" />
            Cancelar leitura
          </Button>
        </div>
      )}

      {step === "waiting" && (
        <div className="text-center">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
            <Loader2 className="h-14 w-14 animate-spin text-primary" />
          </div>
          <h2 className="mt-6 font-display text-xl font-bold">
            Aguardando liberação do Caixa…
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {numeroMesa != null ? `Mesa ${numeroMesa} · ` : ""}
            Assim que o operador confirmar, seu cardápio será liberado
            automaticamente.
          </p>
          <Button
            variant="outline"
            className="mt-8 w-full"
            onClick={handleDesistir}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Desistir
          </Button>
        </div>
      )}

      {step === "result" && (
        <div className="text-center">
          {status === "liberada" ? (
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
          ) : (
            <XCircle className="mx-auto h-14 w-14 text-destructive" />
          )}
          <h2 className="mt-4 font-display text-xl font-bold">
            {status === "recusada"
              ? "Solicitação recusada"
              : "Solicitação encerrada"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "recusada"
              ? "O caixa não liberou esta mesa. Fale com um atendente."
              : "Você desistiu da abertura da mesa."}
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              setSolicitacaoId(null);
              setStatus("aguardando");
              setStep("form");
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Shell — moldura simples e centrada                                  */
/* ------------------------------------------------------------------ */

function Shell({
  children,
  empresaNome,
}: {
  children: React.ReactNode;
  empresaNome?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <BrandLogo
          showName
          imgClassName="h-7 w-7 rounded-lg object-contain"
          nameClassName="font-display text-base font-bold"
        />
        <span className="w-9" />
      </header>
      <main className="mx-auto w-full max-w-md px-5 py-8">
        {empresaNome ? null : null}
        {children}
      </main>
    </div>
  );
}
