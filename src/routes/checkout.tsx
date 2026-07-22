import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MapPin, QrCode, Banknote, CreditCard, Wallet, Coins } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { fetchProfile, placeOrder, discardUnpaidDrafts } from "@/lib/orders";
import { fetchEsgotadoIds } from "@/lib/menu";
import { empresaConfigQueryOptions } from "@/lib/empresa";
import { formatBRL } from "@/lib/format";
import { fetchMpPublicConfig } from "@/lib/mercadopago";
import { fetchMeiosPagamento } from "@/lib/caixa";
import { MercadoPagoCheckout } from "@/components/checkout/MercadoPagoCheckout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";
import { PoweredByBadge } from "@/components/PoweredByBadge";
import type { AppliedCombo } from "@/lib/combos";

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

const CHECKOUT_AUTH_LATCH_KEY = "checkout_auth_latch_v1";
const CHECKOUT_SNAPSHOT_KEY = "checkout_payment_snapshot_v1";
const CHECKOUT_PENDING_PAYMENT_KEY = "checkout_pending_payment_v1";
const CHECKOUT_AUTH_LATCH_TTL = 30 * 60 * 1000;

type PayMethod =
  | "PIX"
  | "Dinheiro"
  | "Cartão de Crédito"
  | "Cartão de Débito"
  | "Conta Corrente";

const PAY_METHODS: { value: PayMethod; label: string; hint: string }[] = [
  { value: "PIX", label: "PIX", hint: "QR Code na hora" },
  { value: "Dinheiro", label: "Dinheiro", hint: "Pague na entrega" },
  { value: "Cartão de Crédito", label: "Crédito", hint: "Maquininha na entrega" },
  { value: "Cartão de Débito", label: "Débito", hint: "Maquininha na entrega" },
];

interface CheckoutSnapshot {
  at: number;
  items: CartItem[];
  subtotal: number;
  discount: number;
  appliedCombos: AppliedCombo[];
  totalPrice: number;
  canCheckout: boolean;
  shortfalls: { slug: string; name: string; required: number; missing: number }[];
  tipo: "Delivery" | "Presencial";
  mesa: string;
  address: string;
  phone: string;
  notes: string;
  useCashback: boolean;
  payMethod: PayMethod;
  trocoPara: string;
}

interface PendingPaymentSnapshot {
  at: number;
  orderId: string;
  total: number;
  tipo: "Delivery" | "Presencial";
  mesa: string;
  address: string;
  phone: string;
  notes: string;
  payMethod: PayMethod;
  trocoPara: string;
}

function readCheckoutAuthLatch() {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_AUTH_LATCH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: number };
    return typeof parsed.at === "number" && Date.now() - parsed.at < CHECKOUT_AUTH_LATCH_TTL;
  } catch {
    return false;
  }
}

function writeCheckoutAuthLatch(userId: string) {
  try {
    sessionStorage.setItem(
      CHECKOUT_AUTH_LATCH_KEY,
      JSON.stringify({ userId, at: Date.now() }),
    );
  } catch {
    /* ignore storage errors */
  }
}

function readCheckoutSnapshot(): CheckoutSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutSnapshot;
    if (!parsed?.at || Date.now() - parsed.at > CHECKOUT_AUTH_LATCH_TTL) return null;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCheckoutSnapshot(snapshot: CheckoutSnapshot) {
  try {
    sessionStorage.setItem(CHECKOUT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore storage errors */
  }
}

function clearCheckoutSnapshot() {
  try {
    sessionStorage.removeItem(CHECKOUT_AUTH_LATCH_KEY);
    sessionStorage.removeItem(CHECKOUT_SNAPSHOT_KEY);
    sessionStorage.removeItem(CHECKOUT_PENDING_PAYMENT_KEY);
    localStorage.removeItem(CHECKOUT_PENDING_PAYMENT_KEY);
  } catch {
    /* ignore storage errors */
  }
}

function readPendingPaymentSnapshot(): PendingPaymentSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(CHECKOUT_PENDING_PAYMENT_KEY) ||
      localStorage.getItem(CHECKOUT_PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPaymentSnapshot;
    if (!parsed?.at || Date.now() - parsed.at > CHECKOUT_AUTH_LATCH_TTL) return null;
    if (!parsed.orderId || !Number.isFinite(Number(parsed.total)) || Number(parsed.total) <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePendingPaymentSnapshot(snapshot: PendingPaymentSnapshot) {
  try {
    const value = JSON.stringify(snapshot);
    sessionStorage.setItem(CHECKOUT_PENDING_PAYMENT_KEY, value);
    localStorage.setItem(CHECKOUT_PENDING_PAYMENT_KEY, value);
  } catch {
    /* ignore storage errors */
  }
}

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
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
  const [checkoutSnapshot, setCheckoutSnapshot] = useState(readCheckoutSnapshot);
  const [pendingPayment, setPendingPayment] = useState(readPendingPaymentSnapshot);
  const [submitting, setSubmitting] = useState(false);
  // Legado removido (v1.6.0): o checkout é exclusivamente DELIVERY. O contexto
  // de MESA nunca chega aqui — pedidos de mesa vão por `enviar_pedido_mesa`.
  const tipo: "Delivery" | "Presencial" = "Delivery";
  const mesa = "";
  const [address, setAddress] = useState(checkoutSnapshot?.address ?? "");
  const [phone, setPhone] = useState(checkoutSnapshot?.phone ?? "");
  const [notes, setNotes] = useState(checkoutSnapshot?.notes ?? "");
  const [useCashback, setUseCashback] = useState(checkoutSnapshot?.useCashback ?? false);
  const [payMethod, setPayMethod] = useState<PayMethod>(
    checkoutSnapshot?.payMethod ?? "PIX",
  );
  const [trocoPara, setTrocoPara] = useState(checkoutSnapshot?.trocoPara ?? "");

  // Session latch: once an authenticated user has been seen on this screen we
  // never tear the payment screen down again over a TRANSIENT auth blip.
  // Paying via PIX means the customer leaves to their bank app and comes back;
  // on return Supabase re-validates the session and can briefly emit a
  // SIGNED_OUT/SIGNED_IN pair. Without this latch that blip flips `user` to
  // null for a frame — the render guard falls back to the loader (the QR
  // "some em 0,5s") and the redirect effect below ejects the customer to
  // /auth mid-payment. The latch keeps the screen mounted through the blip;
  // AuthProvider recovers the session on its own moments later.
  const [everAuthed, setEverAuthed] = useState(readCheckoutAuthLatch);
  useEffect(() => {
    if (!user) return;
    writeCheckoutAuthLatch(user.id);
    if (!everAuthed) setEverAuthed(true);
  }, [user, everAuthed]);

  // Higiene defensiva: só PIX e Cartão (via MP) têm tela de pagamento pendente.
  // Um snapshot de outra forma (Fiado/Dinheiro/Cartão na entrega) é resíduo de
  // uma versão anterior do checkout e envenena o próximo pedido — descarta.
  useEffect(() => {
    if (!pendingPayment) return;
    const isPendingScreen =
      pendingPayment.payMethod === "PIX" ||
      pendingPayment.payMethod === "Cartão de Crédito" ||
      pendingPayment.payMethod === "Cartão de Débito";
    if (!isPendingScreen) {
      clearCheckoutSnapshot();
      setPendingPayment(null);
    }
  }, [pendingPayment]);


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
    enabled: hydrated && !!user,
  });

  const { data: empresa } = useQuery(empresaConfigQueryOptions);

  // Configuração pública do Mercado Pago do tenant do host atual (só chave
  // pública). Quando ativa, PIX e Cartão são processados online via MP.
  const { data: mpConfig, isLoading: mpConfigLoading } = useQuery({
    queryKey: ["mp-public-config"],
    queryFn: fetchMpPublicConfig,
    staleTime: 5 * 60 * 1000,
  });
  const mpActive = !!mpConfig?.ativo;

  // Percentual de cashback por meio de pagamento (v1.4.0). Alimenta a frase de
  // incentivo dinâmica exibida ao escolher a forma de pagamento no checkout.
  const { data: meiosCashback } = useQuery({
    queryKey: ["meios-cashback-checkout"],
    queryFn: () => fetchMeiosPagamento(true),
    staleTime: 5 * 60 * 1000,
  });
  // Panoramas de flexibilidade. PIX só pode aparecer quando o MP do tenant já
  // foi carregado e está ativo; o PIX estático não tem webhook e não pode mais
  // registrar pedido que depende de confirmação bancária.
  const allowPixOnline = mpConfig ? mpConfig.aceita_pix_online : true;
  const allowCardOnline = mpConfig ? mpConfig.aceita_cartao_online : true;
  const allowNaEntrega = mpConfig ? mpConfig.aceita_na_entrega : true;
  const visibleMethods = PAY_METHODS.filter((m) => {
    if (m.value === "PIX") return mpConfigLoading || (mpActive && allowPixOnline);
    if (m.value === "Dinheiro") return allowNaEntrega;
    if (m.value === "Cartão de Crédito" || m.value === "Cartão de Débito") {
      return mpActive ? allowCardOnline : allowNaEntrega;
    }
    return true;
  });

  /**
   * Whether the selected method is settled ONLINE (PIX/card via Mercado Pago).
   * Only online payments are created hidden from the Caixa/KDS until the MP
   * webhook confirms; cash and maquininha-on-delivery stay visible as before.
   */
  const isOnlinePayment =
    payMethod === "PIX" ||
    (mpActive &&
      (payMethod === "Cartão de Crédito" || payMethod === "Cartão de Débito") &&
      allowCardOnline);





  const liveCheckoutState = useMemo(
    () => ({
      items: safeItems,
      subtotal,
      discount,
      appliedCombos,
      totalPrice,
      canCheckout,
      shortfalls,
    }),
    [safeItems, subtotal, discount, appliedCombos, totalPrice, canCheckout, shortfalls],
  );

  const effectiveCheckoutState =
    safeItems.length > 0
      ? liveCheckoutState
      : everAuthed && checkoutSnapshot
        ? checkoutSnapshot
        : liveCheckoutState;

  const effectiveItems = effectiveCheckoutState.items;
  const effectiveSubtotal = effectiveCheckoutState.subtotal;
  const effectiveDiscount = effectiveCheckoutState.discount;
  const effectiveAppliedCombos = effectiveCheckoutState.appliedCombos;
  const effectiveTotalPrice = effectiveCheckoutState.totalPrice;
  const effectiveCanCheckout = effectiveCheckoutState.canCheckout;
  const effectiveShortfalls = effectiveCheckoutState.shortfalls;

  useEffect(() => {
    if (!hydrated || safeItems.length === 0) return;
    const nextSnapshot: CheckoutSnapshot = {
      ...liveCheckoutState,
      at: Date.now(),
      tipo,
      mesa,
      address,
      phone,
      notes,
      useCashback,
      payMethod,
      trocoPara,
    };
    writeCheckoutSnapshot(nextSnapshot);
    setCheckoutSnapshot(nextSnapshot);
  }, [
    address,
    hydrated,
    liveCheckoutState,
    mesa,
    notes,
    phone,
    safeItems.length,
    tipo,
    useCashback,
    payMethod,
    trocoPara,
  ]);





  // Checkout é exclusivamente delivery (v1.6.0) — sem taxa de serviço de mesa.
  const serviceFee = 0;

  const baseTotal = Math.round((effectiveTotalPrice + serviceFee) * 100) / 100;
  const saldoCashback = profile?.saldo_cashback ?? 0;
  const cashbackApplied = useCashback
    ? Math.min(Math.round(saldoCashback * 100), Math.round(baseTotal * 100)) /
      100
    : 0;
  const calculatedFinalTotal = Math.round((baseTotal - cashbackApplied) * 100) / 100;
  const finalTotal = pendingPayment?.total ?? calculatedFinalTotal;

  /* ---- Conta corrente (fiado) — permissão e saldo do cliente -------------- */
  // Espelha a trava do motor financeiro do caixa (finalize_order_paid valida o
  // limite no servidor). Aqui garantimos que o cliente só consiga escolher
  // "Lançar na Conta" quando está autorizado E tem crédito suficiente.
  const fiadoAutorizado = profile?.fiado_autorizado ?? false;
  const limiteFiado = profile?.limite_fiado ?? 0;
  const saldoDevedorFiado = profile?.saldo_devedor_fiado ?? 0;
  const creditoDisponivel =
    Math.round((limiteFiado - saldoDevedorFiado) * 100) / 100;
  const contaCorrenteDisponivel =
    fiadoAutorizado && creditoDisponivel + 1e-9 >= finalTotal;

  // Forma de pagamento efetiva (ao reabrir a tela de pagamento pendente,
  // usamos o método já registrado no pedido).
  const effectivePayMethod = pendingPayment?.payMethod ?? payMethod;
  const effectiveTroco = pendingPayment?.trocoPara ?? trocoPara;

  // Cashback dinâmico (v1.4.0): percentual do meio escolhido × total do pedido.
  // "Conta Corrente" (Fiado) nunca gera cashback. Respeita o interruptor geral
  // da empresa (cashback_ativo).
  const cashbackAtivo = empresa?.cashback_ativo ?? true;
  const pctCashbackSelecionado =
    effectivePayMethod === "Conta Corrente"
      ? 0
      : (meiosCashback?.find((m) => m.nome === effectivePayMethod)
          ?.percentual_cashback ?? 0);
  const cashbackAGanhar =
    cashbackAtivo && pctCashbackSelecionado > 0
      ? Math.round(finalTotal * pctCashbackSelecionado) / 100
      : 0;


  // Troco: só faz sentido para pagamento em dinheiro.
  const trocoParaNum = Number(String(effectiveTroco).replace(",", "."));
  const trocoValido =
    effectivePayMethod === "Dinheiro" &&
    Number.isFinite(trocoParaNum) &&
    trocoParaNum >= finalTotal;
  const trocoValor = trocoValido
    ? Math.round((trocoParaNum - finalTotal) * 100) / 100
    : 0;

  useEffect(() => {
    if (profile) {
      setAddress((a) => a || profile.address);
      setPhone((p) => p || profile.phone);
    }
  }, [profile]);

  // Se o cliente tinha "Conta Corrente" selecionado mas perdeu a permissão ou
  // ficou sem crédito (ex.: total mudou), voltamos para PIX para nunca enviar
  // um pedido com forma de pagamento inválida. Não mexe em pedidos já pagos.
  useEffect(() => {
    if (
      !pendingPayment &&
      payMethod === "Conta Corrente" &&
      !contaCorrenteDisponivel
    ) {
      setPayMethod("PIX");
    }
  }, [pendingPayment, payMethod, contaCorrenteDisponivel]);

  // Se a forma escolhida deixou de ser oferecida (panoramas de flexibilidade),
  // seleciona a primeira forma disponível.
  useEffect(() => {
    if (pendingPayment || payMethod === "Conta Corrente") return;
    const stillVisible = visibleMethods.some((m) => m.value === payMethod);
    if (!stillVisible && visibleMethods[0]) {
      setPayMethod(visibleMethods[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayment, payMethod, visibleMethods.length]);



  // Rota liberada: não existe redirecionamento automático por autenticação.


  // NOTE: we deliberately do NOT auto-navigate to "/" when the cart looks
  // empty. That silent redirect used to fire during transient states (cart
  // re-hydration or a Supabase auth refresh that invalidates queries a few
  // seconds after mount), making the payment screen "flash" and dump the user
  // back home with no message. Instead we render a loading state until the
  // cart is restored and only then show a friendly empty state (see below).
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveCanCheckout) {
      toast.error("Revise as regras do pedido antes de finalizar.");
      return;
    }
    // Delivery-only (v1.6.0): valida o endereço de entrega. Mesa nunca chega aqui.
    const mesaNumber: number | null = null;
    const parsedAddr = schema.shape.address.safeParse(address);
    if (!parsedAddr.success) {
      toast.error(parsedAddr.error.issues[0].message);
      return;
    }
    const parsed = schema.safeParse({
      address,
      phone,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    // Validação do troco para pagamento em dinheiro (opcional; se informado,
    // deve ser suficiente para cobrir o total).
    if (payMethod === "Dinheiro" && trocoPara.trim() !== "") {
      const troco = Number(trocoPara.replace(",", "."));
      if (!Number.isFinite(troco) || troco < finalTotal) {
        toast.error("O valor para troco deve ser igual ou maior que o total.");
        return;
      }
    }
    // Trava da conta corrente (fiado): revalida permissão e crédito no envio,
    // espelhando a checagem do motor financeiro. O caixa ainda revalida no
    // servidor ao liquidar (finalize_order_paid).
    if (payMethod === "Conta Corrente") {
      if (!fiadoAutorizado) {
        toast.error("Sua conta corrente não está autorizada para lançamentos.");
        return;
      }
      if (finalTotal > creditoDisponivel + 1e-9) {
        toast.error(
          `Crédito insuficiente na conta. Disponível: ${formatBRL(
            Math.max(0, creditoDisponivel),
          )}.`,
        );
        return;
      }
    }
    if (authLoading) {
      toast.info("Carregando sua sessão. Tente novamente em instantes.");
      return;
    }
    if (!user) {
      toast.error("Faça login para registrar o pedido.");
      return;
    }
    if (payMethod === "PIX") {
      if (mpConfigLoading) {
        toast.info("Carregando pagamento PIX. Tente novamente em instantes.");
        return;
      }
      if (!mpActive || !mpConfig?.public_key || !allowPixOnline) {
        toast.error("PIX online indisponível para esta loja no momento.");
        return;
      }
    }

    setSubmitting(true);
    // Preventive race check: an item may have sold out while browsing.
    try {
      const esgotados = await fetchEsgotadoIds();
      const blocked = effectiveItems.find((i) => esgotados.has(i.productId));
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
    // Higiene de rascunhos: antes de registrar um novo pedido, arquiva
    // qualquer rascunho de pagamento anterior do próprio cliente que ficou
    // sem pagar (marca como 'pagamento_abandonado' para o BI de desistência).
    // Best-effort: nunca bloqueia o checkout se falhar.
    try {
      await discardUnpaidDrafts();
    } catch {
      /* arquivamento de abandono é best-effort; não bloqueia o checkout */
    }
    try {
      // Registra a forma de pagamento escolhida nas observações para que a
      // cozinha e o operador do caixa saibam como o cliente vai pagar.
      const paymentLabel =
        payMethod === "Dinheiro"
          ? trocoPara.trim() !== ""
            ? `Dinheiro (troco para ${formatBRL(Number(trocoPara.replace(",", ".")))})`
            : "Dinheiro (sem troco)"
          : payMethod === "Conta Corrente"
            ? "Conta Corrente (Lançar na Conta / Fiado)"
            : payMethod;
      const composedNotes = [
        `Forma de pagamento: ${paymentLabel}`,
        (parsed.data.notes ?? "").trim(),
      ]
        .filter(Boolean)
        .join(" — ");

      const orderId = await placeOrder({
        userId: user.id,
        items: effectiveItems,
        total: finalTotal,
        discount: effectiveDiscount,
        deliveryAddress: parsed.data.address,
        phone: parsed.data.phone,
        notes: composedNotes,
        tipoAtendimento: tipo,
        numeroMesa: mesaNumber,
        cashbackUsed: cashbackApplied,
        pagamentoOnline: isOnlinePayment,
      });

      if (isOnlinePayment) {
        const paymentSnapshot: PendingPaymentSnapshot = {
          at: Date.now(),
          orderId,
          total: finalTotal,
          tipo,
          mesa,
          address,
          phone: parsed.data.phone,
          notes: parsed.data.notes ?? "",
          payMethod,
          trocoPara,
        };
        writePendingPaymentSnapshot(paymentSnapshot);
        setPendingPayment(paymentSnapshot);
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        toast.success(
          payMethod === "PIX"
            ? "PIX gerado. Seu carrinho será limpo após a confirmação do pagamento."
            : "Pagamento iniciado. Seu carrinho será limpo após a confirmação.",
        );
        setSubmitting(false);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Fluxos sem pagamento pendente (Fiado, Dinheiro, Cartão na entrega):
        // o pedido já foi registrado e não há tela de pagamento para renderizar.
        // Limpamos carrinho e snapshots do checkout e levamos o cliente para
        // a lista de pedidos, evitando que uma revisita ao /checkout recupere
        // um snapshot antigo e "envenene" o próximo pedido.
        clear();
        clearCheckoutSnapshot();
        setPendingPayment(null);
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        toast.success(
          payMethod === "Conta Corrente"
            ? "Pedido registrado e lançado na sua conta corrente!"
            : "Pedido registrado! Confira as instruções de pagamento.",
        );
        setSubmitting(false);
        navigate({ to: "/orders", replace: true });
      }
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

  // While the session or the cart is FIRST settling, show a stable loader
  // instead of rendering (and then tearing down) the payment screen. Once the
  // customer has been authenticated on this screen (everAuthed) we keep the
  // page mounted through any transient auth blip so the QR never disappears.
  if (!hydrated) {
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
  if (effectiveItems.length === 0 && !pendingPayment) {
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
              {effectiveItems.map((i) => (
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
                <span className="tabular-nums">{formatBRL(effectiveSubtotal)}</span>
              </div>
              {effectiveAppliedCombos.map((c) => (
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
              {effectiveDiscount > 0 && effectiveAppliedCombos.length === 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Desconto combo</span>
                  <span className="tabular-nums">− {formatBRL(effectiveDiscount)}</span>
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


          {effectiveShortfalls.map((s) => (
            <p
              key={s.slug}
              className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              Pedido mínimo de {s.required} unidades em {s.name}. Adicione mais{" "}
              {s.missing} antes de finalizar.
            </p>
          ))}

          {pendingPayment && effectivePayMethod === "PIX" ? (
            <section className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-1 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <h2 className="font-display text-base font-bold">
                  Pagamento via PIX
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Pagamento em andamento. Escaneie o QR Code ou use o código Copia e Cola. O valor de{" "}
                <span className="font-semibold text-foreground">
                  {formatBRL(finalTotal)}
                </span>{" "}
                já vem preenchido.
              </p>

              {mpConfigLoading ? (
                <div className="mt-4 flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm">Carregando pagamento PIX…</p>
                </div>
              ) : mpActive && mpConfig && pendingPayment?.orderId ? (
                <div className="mt-4">
                  <MercadoPagoCheckout
                    orderId={pendingPayment.orderId}
                    total={finalTotal}
                    method="pix"
                    config={mpConfig}
                    payerEmail={user?.email ?? undefined}
                    onPaid={() => {
                      clear();
                      clearCheckoutSnapshot();
                      queryClient.invalidateQueries({ queryKey: ["orders"] });
                      navigate({ to: "/orders", replace: true });
                    }}
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  PIX online indisponível para este pedido. Volte ao cardápio e escolha outra forma de pagamento.
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                className="mt-4 h-12 w-full rounded-2xl"
                onClick={() => {
                  clearCheckoutSnapshot();
                  navigate({ to: "/", replace: true });
                }}
              >
                Voltar ao cardápio
              </Button>
            </section>
          ) : pendingPayment &&
            mpActive &&
            mpConfig &&
            (effectivePayMethod === "Cartão de Crédito" ||
              effectivePayMethod === "Cartão de Débito") ? (
            <section className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-display text-base font-bold">
                  Pagamento com cartão
                </h2>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Preencha os dados do cartão para pagar{" "}
                <span className="font-semibold text-foreground">
                  {formatBRL(finalTotal)}
                </span>{" "}
                com segurança.
              </p>
              <MercadoPagoCheckout
                orderId={pendingPayment.orderId}
                total={finalTotal}
                method="card"
                config={mpConfig}
                payerEmail={user?.email ?? undefined}
                onPaid={() => {
                  clear();
                  clearCheckoutSnapshot();
                  queryClient.invalidateQueries({ queryKey: ["orders"] });
                  navigate({ to: "/orders", replace: true });
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-12 w-full rounded-2xl"
                onClick={() => {
                  clearCheckoutSnapshot();
                  navigate({ to: "/", replace: true });
                }}
              >
                Voltar ao cardápio
              </Button>
            </section>
          ) : pendingPayment ? (
            <section className="mb-5 rounded-2xl border border-success/30 bg-success/5 p-4">
              <div className="mb-1 flex items-center gap-2">
                {effectivePayMethod === "Dinheiro" ? (
                  <Banknote className="h-5 w-5 text-success" />
                ) : effectivePayMethod === "Conta Corrente" ? (
                  <Wallet className="h-5 w-5 text-success" />
                ) : (
                  <CreditCard className="h-5 w-5 text-success" />
                )}
                <h2 className="font-display text-base font-bold">
                  Pedido confirmado!
                </h2>
              </div>
              {effectivePayMethod === "Conta Corrente" ? (
                <p className="text-xs text-muted-foreground">
                  Seu pedido foi registrado na cozinha e o valor de{" "}
                  <span className="font-semibold text-foreground">
                    {formatBRL(finalTotal)}
                  </span>{" "}
                  foi lançado na sua{" "}
                  <span className="font-semibold text-foreground">
                    conta corrente
                  </span>
                  .
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Seu pedido foi registrado na cozinha. O pagamento de{" "}
                  <span className="font-semibold text-foreground">
                    {formatBRL(finalTotal)}
                  </span>{" "}
                  será feito{" "}
                  {tipo === "Delivery" ? "na entrega" : "na retirada"} com{" "}
                  <span className="font-semibold text-foreground">
                    {effectivePayMethod}
                  </span>
                  .
                </p>
              )}

              {effectivePayMethod === "Dinheiro" && (
                <p className="mt-2 rounded-xl bg-background/60 px-3 py-2 text-xs">
                  {trocoValido ? (
                    <>
                      Você pediu troco para{" "}
                      <span className="font-semibold text-foreground">
                        {formatBRL(trocoParaNum)}
                      </span>
                      . Leve o valor certo — o entregador levará{" "}
                      <span className="font-semibold text-success">
                        {formatBRL(trocoValor)}
                      </span>{" "}
                      de troco.
                    </>
                  ) : (
                    "Você não pediu troco. Tenha o valor exato em mãos."
                  )}
                </p>
              )}
              {(effectivePayMethod === "Cartão de Crédito" ||
                effectivePayMethod === "Cartão de Débito") && (
                <p className="mt-2 rounded-xl bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  A maquininha estará disponível no momento{" "}
                  {tipo === "Delivery" ? "da entrega" : "da retirada"}.
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                className="mt-4 h-12 w-full rounded-2xl"
                onClick={() => {
                  clearCheckoutSnapshot();
                  navigate({ to: "/", replace: true });
                }}
              >
                Voltar ao cardápio
              </Button>
            </section>
          ) : (
            <section className="mb-5 rounded-2xl border border-primary/20 bg-card p-4 text-sm text-muted-foreground">
              Escolha a forma de pagamento e confirme abaixo. PIX e cartão online
              só entram na cozinha depois da confirmação do pagamento.
            </section>
          )}


          {/* Order form */}
          {!pendingPayment && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Dados da entrega — checkout exclusivamente delivery (v1.6.0) */}
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Dados da entrega
            </div>

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

            {/* Forma de pagamento */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Banknote className="h-4 w-4 text-primary" />
                Forma de pagamento
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleMethods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPayMethod(m.value)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      payMethod === m.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.hint}
                    </span>
                  </button>
                ))}
              </div>

              {/* Incentivo de cashback dinâmico (v1.4.0) */}
              {cashbackAGanhar > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary">
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>
                    Pague com {effectivePayMethod} e ganhe{" "}
                    {formatBRL(cashbackAGanhar)} de volta!
                  </span>
                </div>
              )}



              {/* Conta corrente (fiado): só aparece para clientes autorizados */}
              {fiadoAutorizado && (
                <button
                  type="button"
                  onClick={() =>
                    contaCorrenteDisponivel && setPayMethod("Conta Corrente")
                  }
                  disabled={!contaCorrenteDisponivel}
                  aria-pressed={payMethod === "Conta Corrente"}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    payMethod === "Conta Corrente"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  }`}
                >
                  <Wallet className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      Lançar na Conta
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Conta corrente • disponível{" "}
                      {formatBRL(Math.max(0, creditoDisponivel))}
                    </span>
                  </span>
                </button>
              )}

              {fiadoAutorizado && !contaCorrenteDisponivel && (
                <p className="text-[11px] text-destructive">
                  Crédito insuficiente na conta corrente para este pedido
                  (disponível {formatBRL(Math.max(0, creditoDisponivel))}).
                </p>
              )}

              {payMethod === "Dinheiro" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="troco">Troco para quanto? (opcional)</Label>
                  <Input
                    id="troco"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={trocoPara}
                    onChange={(e) => setTrocoPara(e.target.value)}
                    placeholder={`Ex: ${Math.ceil(finalTotal / 10) * 10}`}
                    className="h-12 rounded-xl"
                  />
                  {trocoValido && trocoValor > 0 ? (
                    <p className="text-xs text-success">
                      Troco: {formatBRL(trocoValor)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco se tiver o valor exato.
                    </p>
                  )}
                </div>
              )}
            </div>


            <div className="flex w-full gap-3 mt-2">
              {/* Botão de Confirmar (66% da largura) */}
              <Button
                type="submit"
                size="lg"
                className="h-13 flex-[2] rounded-2xl py-3.5 text-base"
                disabled={submitting || !effectiveCanCheckout || mpConfigLoading}
              >
                {mpConfigLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando...
                  </>
                ) : submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `Confirmar • ${formatBRL(finalTotal)}`
                )}
              </Button>

              {/* Botão de Voltar ao Cardápio (34% da largura) */}
              <Link
                to="/"
                replace
                className="h-13 flex-[1] rounded-2xl bg-black text-white hover:bg-[#F97316] hover:text-white transition-all duration-300 flex items-center justify-center text-sm font-semibold border-none no-underline"
              >
                Voltar
              </Link>
            </div>
          </form>
          )}
          <PoweredByBadge className="pt-6" />
          </main>
        </ShellBody>
    </AppShell>
  );
}
