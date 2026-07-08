import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Loader2, MapPin, Copy, Check, QrCode } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { fetchProfile, placeOrder } from "@/lib/orders";
import { fetchEsgotadoIds } from "@/lib/menu";
import { empresaConfigQueryOptions } from "@/lib/empresa";
import { formatBRL } from "@/lib/format";
import { usePixPayment } from "@/hooks/usePixPayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";

export const Route = createFileRoute("/checkout")({
  ssr: false,
  errorComponent: CheckoutError,
  component: CheckoutPage,
});

function CheckoutError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the full error server-side/console only; never surface raw text to the user.
    console.error("ERRO CRÍTICO NA TELA DE CHECKOUT:", error);
    toast.error("Algo deu errado ao abrir o pagamento. Tente novamente.");
  }, [error]);

  return (
    <AppShell>
      <ShellHeader className="border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-3.5">
          <Link
            to="/"
            aria-label="Voltar à início"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Finalizar pedido</h1>
        </div>
      </ShellHeader>
      <ShellBody>
        <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
          <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <h2 className="font-display text-base font-bold text-destructive">
              Falha ao abrir o pagamento
            </h2>
            <p className="mt-2 break-words text-sm text-destructive">
              Algo deu errado. Tente novamente ou volte ao início.
            </p>
          </section>
          <Button type="button" onClick={reset} className="h-12 rounded-2xl">
            Tentar novamente
          </Button>
        </main>
      </ShellBody>
    </AppShell>
  );
}


const schema = z.object({
  address: z.string().trim().min(5, { message: "Informe o endereço de entrega" }).max(300),
  phone: z.string().trim().min(8, { message: "Informe um telefone válido" }).max(20),
  notes: z.string().trim().max(300).optional(),
});

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    console.log("[CHECKOUT] 🟢 CheckoutPage MONTADO");
    return () => console.log("[CHECKOUT] 🔴 CheckoutPage DESMONTADO");
  }, []);
  const {
    items,
    hydrated,
    subtotal,
    discount,
    appliedCombos,
    totalPrice,
    canCheckout,
    shortfalls,
    clear,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [tipo, setTipo] = useState<"Delivery" | "Presencial">("Delivery");
  const [mesa, setMesa] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [useCashback, setUseCashback] = useState(false);

  const safeItems = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          ...item,
          name: item.name || item.productName || "Produto",
          productName: item.productName || item.name || "Produto",
          addons: Array.isArray(item.addons) ? item.addons : [],
          remocoes: Array.isArray(item.remocoes) ? item.remocoes : [],
          unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0,
          quantity: Number.isFinite(Number(item.quantity))
            ? Math.max(1, Number(item.quantity))
            : 1,
        })),
    [items],
  );

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });

  const { data: empresa } = useQuery(empresaConfigQueryOptions);

  // Taxa de serviço aplicada automaticamente em pedidos presenciais (mesa).
  const serviceRate = empresa?.taxa_servico_mesa ?? 0;
  const serviceFee =
    tipo === "Presencial" && serviceRate > 0
      ? Math.round(subtotal * serviceRate) / 100
      : 0;

  const baseTotal = Math.round((totalPrice + serviceFee) * 100) / 100;
  const saldoCashback = profile?.saldo_cashback ?? 0;
  const cashbackApplied = useCashback
    ? Math.min(Math.round(saldoCashback * 100), Math.round(baseTotal * 100)) /
      100
    : 0;
  const finalTotal = Math.round((baseTotal - cashbackApplied) * 100) / 100;

  const {
    payload: pixPayload,
    copied,
    copy: copyPixPayload,
    merchantName: pixMerchantName,
    merchantCity: pixMerchantCity,
  } = usePixPayment(finalTotal);



  useEffect(() => {
    if (profile) {
      setAddress((a) => a || profile.address);
      setPhone((p) => p || profile.phone);
    }
  }, [profile]);

  useEffect(() => {
    console.log("[CHECKOUT] guard auth →", { authLoading, hasUser: !!user });
    if (authLoading) return;
    if (!user) {
      console.warn("[CHECKOUT] ⚠️ sem usuário → redirecionando para /auth");
      try {
        sessionStorage.setItem("post_login_redirect", "/checkout");
      } catch {
        /* ignore storage errors */
      }
      navigate({ to: "/auth", replace: true });
    }
  }, [authLoading, user, navigate]);

  // NOTE: we deliberately do NOT auto-navigate to "/" when the cart looks
  // empty. That silent redirect used to fire during transient states (cart
  // re-hydration or a Supabase auth refresh that invalidates queries a few
  // seconds after mount), making the payment screen "flash" and dump the user
  // back home with no message. Instead we render a loading state until the
  // cart is restored and only then show a friendly empty state (see below).


  async function copyPix() {
    const ok = await copyPixPayload();
    if (ok) {
      toast.success("Código copiado com sucesso!");
    } else {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCheckout) {
      toast.error("Revise as regras do pedido antes de finalizar.");
      return;
    }
    let mesaNumber: number | null = null;
    if (tipo === "Presencial") {
      mesaNumber = parseInt(mesa, 10);
      if (Number.isNaN(mesaNumber) || mesaNumber <= 0) {
        toast.error("Informe o número da mesa para pedidos presenciais.");
        return;
      }
    } else {
      const parsedAddr = schema.shape.address.safeParse(address);
      if (!parsedAddr.success) {
        toast.error(parsedAddr.error.issues[0].message);
        return;
      }
    }
    const parsed = schema.safeParse({
      address: tipo === "Presencial" ? "Mesa " + mesa : address,
      phone,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (authLoading) {
      toast.info("Carregando sua sessão. Tente novamente em instantes.");
      return;
    }
    if (!user) {
      try {
        sessionStorage.setItem("post_login_redirect", "/checkout");
      } catch {
        /* ignore storage errors */
      }
      toast.error("Faça login para finalizar o pedido.");
      navigate({ to: "/auth" });
      return;
    }
    setSubmitting(true);
    // Preventive race check: an item may have sold out while browsing.
    try {
      const esgotados = await fetchEsgotadoIds();
      const blocked = safeItems.find((i) => esgotados.has(i.productId));
      if (blocked) {
        toast.error(
          `Lamento! ${blocked.name} acabou de esgotar em nossa cozinha. Por favor, altere o pedido para prosseguir.`,
          { duration: 8000 },
        );
        setSubmitting(false);
        return;
      }
    } catch {
      /* availability is best-effort; never block checkout on its failure */
    }
    try {
      await placeOrder({
        userId: user.id,
        items: safeItems,
        total: finalTotal,
        discount,
        deliveryAddress: parsed.data.address,
        phone: parsed.data.phone,
        notes: parsed.data.notes ?? "",
        tipoAtendimento: tipo,
        numeroMesa: mesaNumber,
        cashbackUsed: cashbackApplied,
      });
      clear();
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido realizado com sucesso!");
      navigate({ to: "/", replace: true });
    } catch (err) {
      // Log the full error for observability; never surface raw DB/gateway text.
      console.error("Falha ao finalizar o pedido:", err);
      const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
      // Whitelist only user-friendly messages raised intentionally by the RPC.
      const isSafe = /^(Lamento|Pedido|Revise|Informe|Faça|Não foi possível|Saldo|Cliente|Endereço|Mesa)/.test(
        raw.trim(),
      );
      toast.error(isSafe ? raw : "Não foi possível finalizar o pedido. Tente novamente.");
      setSubmitting(false);
    }
  }

  // While the session or the cart is still settling, show a stable loader
  // instead of rendering (and then tearing down) the payment screen. This
  // prevents the "QR flashes for a few seconds then disappears" behaviour.
  console.log("[CHECKOUT] render →", {
    authLoading,
    hydrated,
    hasUser: !!user,
    itemCount: safeItems.length,
    finalTotal,
  });
  if (authLoading || !hydrated || !user) {
    console.log("[CHECKOUT] 🌀 render LOADER (aguardando sessão/carrinho)");
    return (
      <AppShell>
        <ShellHeader className="border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-3.5">
            <Link
              to="/"
              aria-label="Voltar à início"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-display text-xl font-bold">Finalizar pedido</h1>
          </div>
        </ShellHeader>
        <ShellBody>
          <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </ShellBody>
      </AppShell>
    );
  }

  // Cart is restored and the user is authenticated: if there is genuinely
  // nothing to pay for, guide the customer back to the menu instead of
  // silently redirecting them.
  if (safeItems.length === 0) {
    console.warn("[CHECKOUT] 🧺 render CARRINHO VAZIO");
    return (
      <AppShell>
        <ShellHeader className="border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-3.5">
            <Link
              to="/"
              aria-label="Voltar à início"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-display text-xl font-bold">Finalizar pedido</h1>
          </div>
        </ShellHeader>
        <ShellBody>
          <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Seu carrinho está vazio.
              <br />
              Adicione itens do cardápio para finalizar o pedido.
            </p>
            <Button asChild size="lg" className="h-12 rounded-2xl">
              <Link to="/">Voltar ao cardápio</Link>
            </Button>
          </main>
        </ShellBody>
      </AppShell>
    );
  }

  console.log("[CHECKOUT] ✅ render TELA DE PAGAMENTO (QR + formulário)");
  return (

    <AppShell>
        <ShellHeader className="border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-3.5">
          <Link
            to="/"
            aria-label="Voltar à início"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Finalizar pedido</h1>
          </div>
        </ShellHeader>

        <ShellBody>
          <main className="mx-auto max-w-md px-5 py-5">
          {/* Order summary */}
          <section className="mb-5 rounded-2xl bg-card p-4 shadow-card">
            <h2 className="mb-3 font-display text-base font-bold">
              Resumo do pedido
            </h2>
            <ul className="space-y-2">
              {safeItems.map((i) => (
                <li key={i.lineId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    {i.quantity}× {i.name}
                    {i.addons.length > 0 && (
                      <span className="block text-[11px]">
                        {i.addons.map((a) => `+ ${a.name}`).join(", ")}
                      </span>
                    )}
                    {i.remocoes.length > 0 && (
                      <span className="block text-[11px] font-semibold text-destructive">
                        {i.remocoes.map((r) => `Sem ${r}`).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums">
                    {formatBRL(i.unitPrice * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              {appliedCombos.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between text-sm text-success"
                >
                  <span className="min-w-0 truncate pr-2">
                    Desconto aplicado: {c.nome_combo}
                    {c.vezes > 1 ? ` (${c.vezes}x)` : ""}
                  </span>
                  <span className="tabular-nums whitespace-nowrap">
                    − {formatBRL(c.valor_desconto)}
                  </span>
                </div>
              ))}
              {discount > 0 && appliedCombos.length === 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Desconto combo</span>
                  <span className="tabular-nums">− {formatBRL(discount)}</span>
                </div>
              )}
              {serviceFee > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Taxa de serviço ({serviceRate}%)</span>
                  <span className="tabular-nums">+ {formatBRL(serviceFee)}</span>
                </div>
              )}
              {cashbackApplied > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Cashback aplicado</span>
                  <span className="tabular-nums">
                    − {formatBRL(cashbackApplied)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="font-semibold">Total</span>
                <span className="font-display text-lg font-bold text-primary">
                  {formatBRL(finalTotal)}
                </span>
              </div>
            </div>

            {saldoCashback > 0 && (
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                <span className="text-sm">
                  <span className="font-semibold text-foreground">
                    Usar meu cashback
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Saldo disponível: {formatBRL(saldoCashback)}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={useCashback}
                  onChange={(e) => setUseCashback(e.target.checked)}
                  className="h-5 w-5 accent-[hsl(var(--primary))]"
                />
              </label>
            )}
          </section>


          {shortfalls.map((s) => (
            <p
              key={s.slug}
              className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              Pedido mínimo de {s.required} unidades em {s.name}. Adicione mais{" "}
              {s.missing} antes de finalizar.
            </p>
          ))}

          {/* PIX payment — BR Code (Copia e Cola) + QR Code dinâmico */}
          <section className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-bold">
                Pagamento via PIX
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Escaneie o QR Code ou use o código Copia e Cola. O valor de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(finalTotal)}
              </span>{" "}
              já vem preenchido.
            </p>

            <div className="mt-4 flex flex-col items-center">
              <div className="rounded-2xl bg-white p-3 shadow-card">
                <QRCodeCanvas
                  value={pixPayload}
                  size={196}
                  level="M"
                  marginSize={1}
                  aria-label="QR Code para pagamento PIX"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={copyPix}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Código copiado com sucesso!" : "Copiar Código PIX (Copia e Cola)"}
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Favorecido:{" "}
              <span className="font-medium text-foreground">
                {pixMerchantName}
              </span>{" "}
              • {pixMerchantCity}
            </p>
          </section>


          {/* Order form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Attendance type */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
              <button
                type="button"
                onClick={() => setTipo("Delivery")}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tipo === "Delivery"
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setTipo("Presencial")}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tipo === "Presencial"
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Presencial (mesa)
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              {tipo === "Delivery" ? "Dados da entrega" : "Dados do atendimento"}
            </div>

            {tipo === "Presencial" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mesa">Número da mesa</Label>
                <Input
                  id="mesa"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  placeholder="Ex: 7"
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  O garçom levará o pedido até a sua mesa.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="address">Endereço de entrega</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, complemento"
                  className="h-12 rounded-xl"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: sem cebola, troco para R$ 50..."
                className="min-h-20 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-2 h-13 rounded-2xl py-3.5 text-base"
              disabled={submitting || !canCheckout}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `Confirmar pedido • ${formatBRL(finalTotal)}`
              )}
            </Button>
          </form>
          </main>
        </ShellBody>
    </AppShell>
  );
}
