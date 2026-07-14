import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Flag,
  Utensils,
  Plus,
  CheckCircle2,
  ReceiptText,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  getMesaSession,
  clearMesaSession,
  fetchComandaById,
  fetchComandaPedidos,
  fecharComanda,
  type ComandaAtiva,
  type ComandaPedido,
} from "@/lib/mesa";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/minha-comanda")({
  head: () => ({
    meta: [
      { title: "Minha comanda — acompanhe seu pedido na mesa" },
      {
        name: "description",
        content:
          "Acompanhe os itens enviados para a cozinha, o total parcial e feche a conta direto do celular.",
      },
    ],
  }),
  component: MinhaComandaPage,
});

function MinhaComandaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comanda, setComanda] = useState<ComandaAtiva | null>(null);
  const [pedidos, setPedidos] = useState<ComandaPedido[]>([]);
  const [closing, setClosing] = useState(false);
  const comandaIdRef = useRef<string | null>(null);


  const reload = useCallback(async (comandaId: string) => {
    try {
      const [c, p] = await Promise.all([
        fetchComandaById(comandaId),
        fetchComandaPedidos(comandaId),
      ]);
      setComanda(c);
      setPedidos(p);
      // Sessão encerrada pelo Caixa (conta paga/fechada): limpa o aparelho.
      if (c && (c.status === "fechada" || c.status === "cancelada")) {
        clearMesaSession();
      }
    } catch {
      /* mantém o último estado conhecido */
    }
  }, []);

  /* -------- Boot + realtime da comanda ------------------------------ */
  useEffect(() => {
    const session = getMesaSession();
    if (!session) {
      navigate({ to: "/", replace: true });
      return;
    }
    comandaIdRef.current = session.comandaId;

    void reload(session.comandaId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`comanda-${session.comandaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_ativa",
          filter: `id=eq.${session.comandaId}`,
        },
        () => void reload(session.comandaId),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `comanda_id=eq.${session.comandaId}`,
        },
        () => void reload(session.comandaId),
      )
      .subscribe();

    // Fallback leve de polling.
    const poll = setInterval(() => {
      if (comandaIdRef.current) void reload(comandaIdRef.current);
    }, 12000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [navigate, reload]);

  async function handleFechar() {
    if (!comanda) return;
    setClosing(true);
    try {
      await fecharComanda(comanda.id);
      toast.success("Conta solicitada! Um atendente já vai até você. 🧾");
      await reload(comanda.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível fechar a conta.",
      );
    } finally {
      setClosing(false);
    }
  }

  /* -------- Loading -------------------------------------------------- */
  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  /* -------- Conta encerrada → agradecimento ------------------------- */
  if (comanda && (comanda.status === "fechada" || comanda.status === "cancelada")) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-16 text-center">
          <CheckCircle2 className="h-14 w-14 text-success" />
          <h1 className="mt-4 font-display text-2xl font-bold">
            Conta encerrada
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Obrigado pela visita! Esperamos te ver de novo em breve. 🧡
          </p>
          <Button className="mt-8 w-full" onClick={() => navigate({ to: "/" })}>
            Voltar ao início
          </Button>
        </div>
      </Shell>
    );
  }

  const total = comanda?.total_parcial ?? 0;
  const aguardando = comanda?.status === "aguardando_fechamento";

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mesa {comanda?.numero_mesa ?? "—"}
          </p>
          <h1 className="font-display text-2xl font-bold">Minha Comanda</h1>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ReceiptText className="h-6 w-6" />
        </span>
      </div>

      {aguardando && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-warning" />
          <span>
            <strong>Conta solicitada.</strong> Um atendente está a caminho para
            finalizar o pagamento.
          </span>
        </div>
      )}

      {/* Itens enviados */}
      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <Utensils className="h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você ainda não enviou nenhum item.
            <br />
            Escolha algo delicioso no cardápio!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido, idx) => (
            <div
              key={pedido.id}
              className="rounded-2xl border border-border bg-card p-3.5 shadow-card"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  {idx + 1}ª rodada ·{" "}
                  {new Date(pedido.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs font-bold text-primary">
                  {formatBRL(pedido.total)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {pedido.items.map((it) => (
                  <li key={it.id} className="text-sm">
                    <span className="font-medium">
                      {it.quantity}× {it.product_name}
                      {it.size && it.size !== "Padrão" ? ` (${it.size})` : ""}
                      {it.second_flavor ? ` / ${it.second_flavor}` : ""}
                    </span>
                    {it.addons.length > 0 && (
                      <span className="block text-[11px] text-muted-foreground">
                        {it.addons
                          .map(
                            (a) =>
                              `+ ${a.name}${(a.quantity ?? 1) > 1 ? ` ×${a.quantity}` : ""}`,
                          )
                          .join(", ")}
                      </span>
                    )}
                    {it.remocoes.length > 0 && (
                      <span className="block text-[11px] font-semibold text-destructive">
                        {it.remocoes.map((r) => `Sem ${r}`).join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="mt-6 space-y-3">
        <Button asChild variant="outline" size="lg" className="w-full gap-2 rounded-2xl">
          <Link to="/">
            <Plus className="h-5 w-5" />
            Adicionar mais itens
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total parcial</span>
            <span className="font-display text-2xl font-bold text-primary">
              {formatBRL(total)}
            </span>
          </div>

          {payPix && comanda && mpConfig ? (
            <div className="space-y-3">
              <ComandaPixCharge
                comandaId={comanda.id}
                total={total}
                config={mpConfig}
                payerEmail={user?.email ?? undefined}
                onConfirmed={() => {
                  toast.success("Pagamento confirmado! Obrigado. 🧡");
                  void reload(comanda.id);
                }}
              />
              <Button
                variant="ghost"
                className="h-11 w-full rounded-xl text-muted-foreground"
                onClick={() => setPayPix(false)}
              >
                Voltar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {mpConfig?.ativo && mpConfig.aceita_pix_online && total > 0 && (
                <Button
                  size="lg"
                  className="h-14 w-full gap-2 rounded-2xl text-base font-bold"
                  disabled={pedidos.length === 0}
                  onClick={() => setPayPix(true)}
                >
                  <QrCode className="h-5 w-5" />
                  Pagar agora pelo PIX
                </Button>
              )}
              <Button
                size="lg"
                variant={
                  mpConfig?.ativo && mpConfig.aceita_pix_online
                    ? "outline"
                    : "default"
                }
                className="h-14 w-full gap-2 rounded-2xl text-base font-bold"
                disabled={closing || pedidos.length === 0 || aguardando}
                onClick={handleFechar}
              >
                {closing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Flag className="h-5 w-5" />
                )}
                {aguardando ? "Aguardando atendente…" : "🏁 Chamar atendente"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          aria-label="Voltar ao cardápio"
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
      <main className="mx-auto w-full max-w-md px-5 py-6 pb-24">{children}</main>
    </div>
  );
}
