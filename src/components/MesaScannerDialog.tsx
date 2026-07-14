import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, QrCode, XCircle } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchFullProfile } from "@/lib/profile";
import {
  parseMesaQr,
  abrirSolicitacaoMesa,
  desistirSolicitacao,
  fetchSolicitacao,
  fetchMinhaComandaAberta,
  setMesaSession,
  type SolicitacaoMesaStatus,
} from "@/lib/mesa";
import { setStatusAtendimento } from "@/lib/atendimento";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Step = "scanning" | "waiting";

/**
 * Modal de leitura do QR da mesa disparado pelo ícone do Header (v1.6.0).
 *
 * Fluxo: abre câmera → lê QR (@zxing) → `abrir_solicitacao_mesa` (valida host +
 * token no servidor) → aguarda o "Visto" do Caixa por Realtime → ao liberar,
 * grava a sessão de mesa e muda o contexto para 'MESA' SILENCIOSAMENTE (sem
 * confirmação, sem navegação forçada). Os itens do carrinho permanecem.
 */
export function MesaScannerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("scanning");
  const [busy, setBusy] = useState(false);
  const [solicitacaoId, setSolicitacaoId] = useState<string | null>(null);
  const [numeroMesa, setNumeroMesa] = useState<number | null>(null);
  const [status, setStatus] = useState<SolicitacaoMesaStatus>("aguardando");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const nomeRef = useRef("");
  const telefoneRef = useRef("");

  const { data: profile } = useQuery({
    queryKey: ["mesa-scanner-profile", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchFullProfile(user!.id),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!profile) return;
    nomeRef.current = profile.full_name ?? "";
    telefoneRef.current = [profile.ddd, profile.telefone]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [profile]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  /* -------- Câmera / leitura do QR --------------------------------- */
  useEffect(() => {
    if (!open || step !== "scanning") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!videoRef.current || cancelled) return;
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
        onOpenChange(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  /* -------- Realtime: aguarda o "Visto" do caixa ------------------- */
  useEffect(() => {
    if (!open || step !== "waiting" || !solicitacaoId) return;

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
          const next = (payload.new as { status?: SolicitacaoMesaStatus }).status;
          if (next) setStatus(next);
        },
      )
      .subscribe();

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
  }, [open, step, solicitacaoId]);

  /* -------- Reage à mudança de status ------------------------------ */
  useEffect(() => {
    if (!open || step !== "waiting") return;
    if (status === "liberada") {
      void handleLiberada();
    } else if (status === "recusada" || status === "expirada") {
      toast.error(
        status === "recusada"
          ? "O caixa não liberou esta mesa. Fale com um atendente."
          : "A solicitação da mesa expirou. Tente novamente.",
      );
      reset();
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, step, open]);

  async function handleLiberada() {
    try {
      if (numeroMesa != null) {
        const comanda = await fetchMinhaComandaAberta(numeroMesa);
        if (comanda) {
          setMesaSession(comanda.id, numeroMesa);
          // Troca de contexto SILENCIOSA — sem confirmar, sem navegar.
          setStatusAtendimento("MESA");
        }
      }
    } catch {
      /* segue mesmo assim */
    }
    toast.success(
      numeroMesa != null
        ? `Mesa ${numeroMesa} liberada! Agora é só pedir 🍽️`
        : "Mesa liberada! Agora é só pedir 🍽️",
    );
    reset();
    onOpenChange(false);
  }

  async function submitSolicitacao(numero: number, token: string) {
    setBusy(true);
    try {
      const id = await abrirSolicitacaoMesa(
        numero,
        token,
        nomeRef.current.trim() || "Cliente",
        telefoneRef.current.trim(),
      );
      setSolicitacaoId(id);
      setNumeroMesa(numero);
      setStatus("aguardando");
      setStep("waiting");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível abrir a mesa.",
      );
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDesistir() {
    if (solicitacaoId) {
      setBusy(true);
      try {
        await desistirSolicitacao(solicitacaoId);
      } catch {
        /* ignore */
      } finally {
        setBusy(false);
      }
    }
    reset();
    onOpenChange(false);
  }

  function reset() {
    stopCamera();
    setStep("scanning");
    setSolicitacaoId(null);
    setNumeroMesa(null);
    setStatus("aguardando");
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <QrCode className="h-5 w-5 text-primary" />
            {step === "scanning" ? "Ler QR-Code da mesa" : "Aguardando o Caixa…"}
          </DialogTitle>
          <DialogDescription>
            {step === "scanning"
              ? "Aponte a câmera para o código que está na sua mesa."
              : "Assim que o operador confirmar, seu cardápio muda para o modo mesa automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {step === "scanning" ? (
          <div className="text-center">
            <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-2xl border-2 border-primary/60 bg-black">
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
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
              <Loader2 className="h-14 w-14 animate-spin text-primary" />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {numeroMesa != null ? `Mesa ${numeroMesa} · ` : ""}
              Aguardando liberação do Caixa…
            </p>
            <Button
              variant="outline"
              className="mt-6 w-full"
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
      </DialogContent>
    </Dialog>
  );
}
