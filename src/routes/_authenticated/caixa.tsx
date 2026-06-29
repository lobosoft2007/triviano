import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Lock,
  ShieldAlert,
  Bike,
  UtensilsCrossed,
  Printer,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  DoorClosed,
  ChefHat,
  Volume2,
  VolumeX,
  Settings,
  Usb,
  Network,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import {
  addMovimentacao,
  closeCaixa,
  fetchCaixaOrders,
  fetchMovimentacoes,
  fetchOpenCaixa,
  markPrintedConta,
  markPrintedCozinha,
  openCaixa,
  saldoAtual,
  updateOrderStatus,
  type CaixaOrder,
  type CaixaOrderItem,
  type MovimentacaoTipo,
} from "@/lib/caixa";
import {
  fetchPrinters,
  fetchCategoriesRouting,
  setCategoryPrinter,
  updatePrinter,
  makeSectorResolver,
  type Printer as PrinterConfig,
  type ResolvedSector,
} from "@/lib/printers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/caixa")({
  component: CaixaPage,
});

const PIX_KEY = "21993383918";
const PIX_NAME = "Marcello Ribeiro Lobo Assumpção";
const RESTAURANT = "Sabor Express — Clube23";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available; ignore
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function CaixaPage() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);

  const { data: caixa, isLoading: caixaLoading } = useQuery({
    queryKey: ["caixa-open"],
    queryFn: fetchOpenCaixa,
    enabled: isAdmin === true,
  });

  if (roleLoading || (isAdmin && caixaLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="font-display text-xl font-bold">Acesso restrito</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          O painel CAIXA é exclusivo para operadores autorizados.
        </p>
        <Link
          to="/menu"
          className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  return caixa ? <OperationalPanel caixaId={caixa.id} /> : <LockScreen userId={user!.id} />;
}

/* ------------------------------------------------------------------ */
/* Lock screen (caixa fechado)                                         */
/* ------------------------------------------------------------------ */

function LockScreen({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [valor, setValor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(valor.replace(",", "."));
    if (Number.isNaN(v) || v < 0) {
      toast.error("Informe um valor de abertura válido.");
      return;
    }
    setSubmitting(true);
    try {
      await openCaixa({ userId, valorAbertura: v });
      await queryClient.invalidateQueries({ queryKey: ["caixa-open"] });
      toast.success("Caixa aberto!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível abrir o caixa.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-card">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="font-display text-2xl font-bold">Caixa fechado</h1>
          <p className="text-sm text-muted-foreground">
            Informe o valor de abertura para iniciar o turno.
          </p>
        </div>

        <form onSubmit={handleOpen} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Operador</Label>
            <Input
              value={user?.email ?? "Operador autenticado"}
              disabled
              className="h-12 rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abertura">Valor de abertura (R$)</Label>
            <Input
              id="abertura"
              inputMode="decimal"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="h-12 rounded-xl text-lg"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-12 rounded-2xl text-base"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Abrir caixa"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Operational panel (caixa aberto)                                    */
/* ------------------------------------------------------------------ */

function OperationalPanel({ caixaId }: { caixaId: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"delivery" | "mesas" | "config">("delivery");
  const [soundOn, setSoundOn] = useState(true);
  const [printNode, setPrintNode] = useState<ReactNode>(null);
  const prevIdsRef = useRef<Set<string> | null>(null);

  const { data: caixa } = useQuery({
    queryKey: ["caixa-open"],
    queryFn: fetchOpenCaixa,
  });
  const { data: movs } = useQuery({
    queryKey: ["caixa-movs", caixaId],
    queryFn: () => fetchMovimentacoes(caixaId),
  });
  const { data: orders } = useQuery({
    queryKey: ["caixa-orders"],
    queryFn: fetchCaixaOrders,
    refetchInterval: 20000,
  });
  const { data: printers } = useQuery({
    queryKey: ["printers"],
    queryFn: fetchPrinters,
  });
  const { data: catRouting } = useQuery({
    queryKey: ["categories-routing"],
    queryFn: fetchCategoriesRouting,
  });

  const resolveSector = useMemo(
    () => makeSectorResolver(printers ?? [], catRouting ?? []),
    [printers, catRouting],
  );

  // Realtime: refresh orders + beep on new ones.
  useEffect(() => {
    const channel = supabase
      .channel("caixa-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Detect new orders to play the alert.
  useEffect(() => {
    if (!orders) return;
    const ids = new Set(orders.map((o) => o.id));
    const prev = prevIdsRef.current;
    if (prev) {
      const hasNew = orders.some((o) => !prev.has(o.id));
      if (hasNew && soundOn) playBeep();
    }
    prevIdsRef.current = ids;
  }, [orders, soundOn]);

  const saldo = useMemo(
    () => (caixa && movs ? saldoAtual(caixa, movs) : caixa?.valor_abertura ?? 0),
    [caixa, movs],
  );

  const deliveryOrders = useMemo(
    () => (orders ?? []).filter((o) => o.tipo_atendimento === "Delivery"),
    [orders],
  );
  const mesaOrders = useMemo(
    () => (orders ?? []).filter((o) => o.tipo_atendimento === "Presencial"),
    [orders],
  );

  const printAndRun = useCallback(
    async (node: ReactNode, after?: () => Promise<void> | void) => {
      setPrintNode(node);
      await new Promise((r) => setTimeout(r, 120));
      window.print();
      await new Promise((r) => setTimeout(r, 200));
      setPrintNode(null);
      if (after) await after();
    },
    [],
  );

  async function dispatchPreparation(order: CaixaOrder) {
    // Group items by destination printer/sector.
    const groups = new Map<
      string,
      { sector: ResolvedSector; items: CaixaOrderItem[] }
    >();
    for (const it of order.order_items) {
      const sector = resolveSector(it.category_id);
      const key = sector.printerId ?? `fallback:${sector.nome}`;
      const g = groups.get(key) ?? { sector, items: [] };
      g.items.push(it);
      groups.set(key, g);
    }
    const list = [...groups.values()];
    if (list.length === 0) return;

    // Sequential thermal dispatches — one coupon per sector.
    for (const g of list) {
      await printAndRun(
        <SectorReceipt order={order} sector={g.sector} items={g.items} />,
      );
    }

    try {
      await markPrintedCozinha(order.id);
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      toast.success(
        `Impressões de preparo disparadas (${list.length} setor${
          list.length > 1 ? "es" : ""
        }).`,
      );
    } catch {
      toast.error("Falha ao marcar impressão.");
    }
  }


  async function printBill(mesa: number, mesaOrdersGroup: CaixaOrder[]) {
    const qr = await QRCode.toDataURL(PIX_KEY, { margin: 1, width: 220 }).catch(
      () => "",
    );
    await printAndRun(
      <BillReceipt mesa={mesa} orders={mesaOrdersGroup} qr={qr} />,
      async () => {
        try {
          await Promise.all(mesaOrdersGroup.map((o) => markPrintedConta(o.id)));
          await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
          toast.success(`Conta da mesa ${mesa} impressa.`);
        } catch {
          toast.error("Falha ao marcar conta.");
        }
      },
    );
  }

  async function handleMov(tipo: MovimentacaoTipo) {
    const label =
      tipo === "Sangria"
        ? "Sangria (retirada)"
        : tipo === "Suprimento"
          ? "Suprimento (entrada)"
          : "Recebimento";
    const valorStr = window.prompt(`${label} — valor em R$:`);
    if (valorStr === null) return;
    const v = Number(valorStr.replace(",", "."));
    if (Number.isNaN(v) || v <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    const motivo = window.prompt("Motivo / descrição:") ?? "";
    try {
      await addMovimentacao({ caixaId, tipo, valor: v, motivo });
      await queryClient.invalidateQueries({ queryKey: ["caixa-movs", caixaId] });
      toast.success(`${label} registrada.`);
    } catch {
      toast.error("Não foi possível registrar a movimentação.");
    }
  }

  async function handleClose() {
    if (!caixa) return;
    if (
      !window.confirm(
        `Fechar o caixa? Saldo calculado: ${formatBRL(saldo)}. Esta ação encerra o turno.`,
      )
    )
      return;
    try {
      await closeCaixa({ id: caixa.id, valorFechamento: saldo });
      await queryClient.invalidateQueries({ queryKey: ["caixa-open"] });
      toast.success("Caixa fechado.");
    } catch {
      toast.error("Não foi possível fechar o caixa.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              aria-label="Voltar"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-xs text-muted-foreground">Painel operacional</p>
              <h1 className="font-display text-xl font-bold leading-tight">
                CAIXA
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-primary/10 px-4 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Saldo atual
              </p>
              <p className="font-display text-lg font-bold tabular-nums text-primary">
                {formatBRL(saldo)}
              </p>
            </div>
            <button
              onClick={() => setSoundOn((s) => !s)}
              aria-label="Alternar som"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              {soundOn ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Cash actions */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3 lg:px-8">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => handleMov("Suprimento")}
          >
            <TrendingUp className="mr-1.5 h-4 w-4 text-success" /> Suprimento
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => handleMov("Sangria")}
          >
            <TrendingDown className="mr-1.5 h-4 w-4 text-destructive" /> Sangria
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => handleMov("Recebimento Pedido")}
          >
            <Wallet className="mr-1.5 h-4 w-4 text-primary" /> Recebimento
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto rounded-full"
            onClick={handleClose}
          >
            <DoorClosed className="mr-1.5 h-4 w-4" /> Fechar caixa
          </Button>
        </div>

        {/* Tabs */}
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-3 lg:px-8">
          <TabButton
            active={tab === "delivery"}
            onClick={() => setTab("delivery")}
            icon={<Bike className="h-4 w-4" />}
            label={`Delivery (${deliveryOrders.length})`}
          />
          <TabButton
            active={tab === "mesas"}
            onClick={() => setTab("mesas")}
            icon={<UtensilsCrossed className="h-4 w-4" />}
            label={`Mesas ativas (${mesaOrders.length})`}
          />
          <TabButton
            active={tab === "config"}
            onClick={() => setTab("config")}
            icon={<Settings className="h-4 w-4" />}
            label="Configurações"
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 lg:px-8">
        {tab !== "config" && !orders && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}

        {orders && tab === "delivery" && (
          <DeliveryColumn
            orders={deliveryOrders}
            onDispatch={dispatchPreparation}
            resolveSector={resolveSector}
          />
        )}

        {orders && tab === "mesas" && (
          <MesasColumn
            orders={mesaOrders}
            onDispatch={dispatchPreparation}
            onPrintBill={printBill}
            resolveSector={resolveSector}
          />
        )}

        {tab === "config" && <ConfigTab />}
      </main>


      {/* Hidden thermal print surface */}
      <div className="thermal-receipt">{printNode}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery column                                                     */
/* ------------------------------------------------------------------ */

type ResolveFn = (categoryId: string | null | undefined) => ResolvedSector;

function DeliveryColumn({
  orders,
  onDispatch,
  resolveSector,
}: {
  orders: CaixaOrder[];
  onDispatch: (o: CaixaOrder) => void;
  resolveSector: ResolveFn;
}) {
  if (orders.length === 0) {
    return <EmptyState label="Nenhum pedido de delivery em aberto." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((o) => (
        <OrderCard
          key={o.id}
          order={o}
          onDispatch={onDispatch}
          resolveSector={resolveSector}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mesas column                                                        */
/* ------------------------------------------------------------------ */

function MesasColumn({
  orders,
  onDispatch,
  onPrintBill,
  resolveSector,
}: {
  orders: CaixaOrder[];
  onDispatch: (o: CaixaOrder) => void;
  onPrintBill: (mesa: number, group: CaixaOrder[]) => void;
  resolveSector: ResolveFn;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, CaixaOrder[]>();
    for (const o of orders) {
      const mesa = o.numero_mesa ?? 0;
      const arr = map.get(mesa) ?? [];
      arr.push(o);
      map.set(mesa, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [orders]);

  if (grouped.length === 0) {
    return <EmptyState label="Nenhuma mesa com consumo no momento." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {grouped.map(([mesa, group]) => {
        const total = group.reduce((s, o) => s + o.total, 0);
        return (
          <div
            key={mesa}
            className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-display text-lg font-bold">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                Mesa {mesa || "—"}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                {group.length} pedido(s)
              </span>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              {group.map((o) => (
                <div key={o.id}>
                  <OrderItems order={o} resolveSector={resolveSector} />
                  {!o.impresso_cozinha && (
                    <Button
                      size="sm"
                      className="mt-2 w-full rounded-xl"
                      onClick={() => onDispatch(o)}
                    >
                      <Printer className="mr-1.5 h-4 w-4" /> Disparar impressões
                    </Button>
                  )}
                  {o.impresso_cozinha && (
                    <p className="mt-1 text-[11px] font-semibold text-success">
                      ✓ Preparo disparado
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Subtotal mesa</span>
              <span className="font-display font-bold text-primary">
                {formatBRL(total)}
              </span>
            </div>
            <Button
              variant="outline"
              className="mt-3 rounded-xl"
              onClick={() => onPrintBill(mesa, group)}
            >
              <Receipt className="mr-1.5 h-4 w-4" /> Imprimir conta / subtotal
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  onDispatch,
  resolveSector,
}: {
  order: CaixaOrder;
  onDispatch: (o: CaixaOrder) => void;
  resolveSector: ResolveFn;
}) {
  const isNew = !order.impresso_cozinha;
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-card p-4 shadow-card ${
        isNew ? "border-primary ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-sm font-bold">
          #{order.id.slice(0, 6).toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {order.delivery_address && (
        <p className="mb-2 text-xs text-muted-foreground">
          {order.delivery_address}
          {order.phone ? ` · ${order.phone}` : ""}
        </p>
      )}

      <OrderItems order={order} resolveSector={resolveSector} />

      {order.notes && (
        <p className="mt-2 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Obs.: {order.notes}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold">Total</span>
        <span className="font-display font-bold text-primary">
          {formatBRL(order.total)}
        </span>
      </div>

      {isNew ? (
        <Button className="mt-3 rounded-xl" onClick={() => onDispatch(order)}>
          <Printer className="mr-1.5 h-4 w-4" /> Disparar impressões de preparo
        </Button>
      ) : (
        <p className="mt-3 text-center text-xs font-semibold text-success">
          ✓ Impressões de preparo disparadas
        </p>
      )}
    </div>
  );
}

function SectorTag({ sector }: { sector: ResolvedSector }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: sector.cor }}
      title={`Roteado para: ${sector.nome}`}
    >
      <Printer className="h-2.5 w-2.5" />
      {sector.nome}
    </span>
  );
}

function OrderItems({
  order,
  resolveSector,
}: {
  order: CaixaOrder;
  resolveSector: ResolveFn;
}) {
  return (
    <ul className="space-y-1.5">
      {order.order_items.map((it) => {
        const sector = resolveSector(it.category_id);
        return (
          <li key={it.id} className="text-sm">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">
                {it.quantity}× {it.product_name}
                {it.size ? ` (${it.size})` : ""}
                {it.second_flavor ? ` / ${it.second_flavor}` : ""}
              </span>
              <SectorTag sector={sector} />
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
              <span className="mt-0.5 flex flex-wrap gap-1">
                {it.remocoes.map((r) => (
                  <span
                    key={r}
                    className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive"
                  >
                    Sem {r}
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <UtensilsCrossed className="h-8 w-8" />
      </span>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );

}

/* ------------------------------------------------------------------ */
/* Thermal receipts (80mm)                                             */
/* ------------------------------------------------------------------ */

function SectorReceipt({
  order,
  sector,
  items,
}: {
  order: CaixaOrder;
  sector: ResolvedSector;
  items: CaixaOrderItem[];
}) {
  const conn = sector.printer
    ? sector.printer.tipo_conexao === "IP"
      ? `IP ${sector.printer.endereco_ip ?? "-"}${
          sector.printer.porta ? `:${sector.printer.porta}` : ""
        }`
      : `USB ${sector.printer.caminho_usb ?? ""}`.trim()
    : "Sem impressora vinculada";
  return (
    <div>
      <p style={{ textAlign: "center", fontWeight: 700, fontSize: 14 }}>
        *** {sector.nome.toUpperCase()} ***
      </p>
      <p style={{ textAlign: "center" }}>{RESTAURANT}</p>
      <p style={{ textAlign: "center", fontSize: 10 }}>{conn}</p>
      <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "4px 0" }} />
      <p>
        Pedido #{order.id.slice(0, 6).toUpperCase()}
        <br />
        {order.tipo_atendimento === "Presencial"
          ? `MESA ${order.numero_mesa ?? "-"}`
          : "DELIVERY"}
        <br />
        {new Date(order.created_at).toLocaleString("pt-BR")}
      </p>
      <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "4px 0" }} />
      {items.map((it) => (
        <div key={it.id} style={{ marginBottom: 6 }}>
          <p style={{ fontWeight: 700 }}>
            {it.quantity}x {it.product_name}
            {it.size ? ` (${it.size})` : ""}
            {it.second_flavor ? ` / ${it.second_flavor}` : ""}
          </p>
          {it.addons.length > 0 && (
            <p style={{ paddingLeft: 8 }}>
              {it.addons
                .map(
                  (a) =>
                    `+ ${a.name}${(a.quantity ?? 1) > 1 ? ` x${a.quantity}` : ""}`,
                )
                .join(", ")}
            </p>
          )}
          {it.remocoes.length > 0 && (
            <p style={{ paddingLeft: 8, fontWeight: 700 }}>
              {it.remocoes.map((r) => `>> SEM ${r.toUpperCase()}`).join("  ")}
            </p>
          )}
        </div>
      ))}
      {order.notes && (
        <>
          <hr
            style={{ border: "none", borderTop: "1px dashed #000", margin: "4px 0" }}
          />
          <p style={{ fontWeight: 700 }}>OBS: {order.notes}</p>
        </>
      )}
    </div>
  );
}


function BillReceipt({
  mesa,
  orders,
  qr,
}: {
  mesa: number;
  orders: CaixaOrder[];
  qr: string;
}) {
  const items = orders.flatMap((o) => o.order_items);
  const subtotal = orders.reduce(
    (s, o) =>
      s + o.order_items.reduce((a, it) => a + it.unit_price * it.quantity, 0),
    0,
  );
  const discount = orders.reduce((s, o) => s + o.discount, 0);
  const total = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div>
      <p style={{ textAlign: "center", fontWeight: 700, fontSize: 14 }}>
        {RESTAURANT}
      </p>
      <p style={{ textAlign: "center" }}>CONTA — MESA {mesa || "-"}</p>
      <p style={{ textAlign: "center" }}>
        {new Date().toLocaleString("pt-BR")}
      </p>
      <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "4px 0" }} />
      {items.map((it, idx) => (
        <div
          key={`${it.id}-${idx}`}
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <span>
            {it.quantity}x {it.product_name}
          </span>
          <span>{formatBRL(it.unit_price * it.quantity)}</span>
        </div>
      ))}
      <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "4px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Subtotal</span>
        <span>{formatBRL(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Desconto</span>
          <span>- {formatBRL(discount)}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <span>TOTAL</span>
        <span>{formatBRL(total)}</span>
      </div>
      <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "4px 0" }} />
      <p style={{ textAlign: "center" }}>Pague com PIX</p>
      {qr && (
        <div style={{ textAlign: "center" }}>
          <img src={qr} alt="PIX" style={{ width: "40mm", height: "40mm" }} />
        </div>
      )}
      <p style={{ textAlign: "center" }}>Chave: {PIX_KEY}</p>
      <p style={{ textAlign: "center" }}>{PIX_NAME}</p>
      <p style={{ textAlign: "center", marginTop: 6 }}>Obrigado pela visita!</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Config tab — printers & category routing                            */
/* ------------------------------------------------------------------ */

function ConfigTab() {
  const queryClient = useQueryClient();
  const { data: printers } = useQuery({
    queryKey: ["printers"],
    queryFn: fetchPrinters,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories-routing"],
    queryFn: fetchCategoriesRouting,
  });
  const [savingCat, setSavingCat] = useState<string | null>(null);

  async function handleAssign(categoryId: string, printerId: string) {
    setSavingCat(categoryId);
    try {
      await setCategoryPrinter(categoryId, printerId || null);
      await queryClient.invalidateQueries({ queryKey: ["categories-routing"] });
      toast.success("Roteamento atualizado.");
    } catch {
      toast.error("Não foi possível salvar o roteamento.");
    } finally {
      setSavingCat(null);
    }
  }

  if (!printers || !categories) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Category → printer routing */}
      <section className="lg:col-span-3">
        <header className="mb-3">
          <h2 className="font-display text-lg font-bold">
            Roteamento por categoria
          </h2>
          <p className="text-sm text-muted-foreground">
            Defina a impressora de destino de cada categoria do cardápio. Itens
            sem impressora vão para o Balcão de Entregas.
          </p>
        </header>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {categories.map((c, idx) => {
            const current = printers.find(
              (p) => p.id === c.id_impressora_destino,
            );
            return (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  idx > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {current && (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: current.cor }}
                    />
                  )}
                  <span className="truncate text-sm font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {savingCat === c.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <select
                    value={c.id_impressora_destino ?? ""}
                    onChange={(e) => handleAssign(c.id, e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="">Balcão de Entregas (padrão)</option>
                    {printers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Printers list */}
      <section className="lg:col-span-2">
        <header className="mb-3">
          <h2 className="font-display text-lg font-bold">Setores de impressão</h2>
          <p className="text-sm text-muted-foreground">
            Conexão de cada impressora (USB ou IP de rede).
          </p>
        </header>
        <div className="space-y-3">
          {printers.map((p) => (
            <PrinterCard key={p.id} printer={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PrinterCard({ printer }: { printer: PrinterConfig }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState(printer.tipo_conexao);
  const [ip, setIp] = useState(printer.endereco_ip ?? "");
  const [porta, setPorta] = useState(printer.porta ? String(printer.porta) : "");
  const [usb, setUsb] = useState(printer.caminho_usb ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updatePrinter(printer.id, {
        tipo_conexao: tipo,
        endereco_ip: tipo === "IP" ? ip || null : null,
        porta: tipo === "IP" && porta ? Number(porta) : null,
        caminho_usb: tipo === "USB" ? usb || null : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["printers"] });
      toast.success(`${printer.nome} atualizada.`);
    } catch {
      toast.error("Não foi possível salvar a impressora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{ backgroundColor: printer.cor }}
        />
        <span className="font-display font-bold">{printer.nome}</span>
        {printer.is_default && (
          <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase">
            Padrão
          </span>
        )}
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setTipo("USB")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            tipo === "USB"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          <Usb className="h-4 w-4" /> USB
        </button>
        <button
          onClick={() => setTipo("IP")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            tipo === "IP"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          <Network className="h-4 w-4" /> IP
        </button>
      </div>

      {tipo === "IP" ? (
        <div className="flex gap-2">
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.0.50"
            className="h-9 rounded-lg"
          />
          <Input
            value={porta}
            onChange={(e) => setPorta(e.target.value)}
            placeholder="9100"
            inputMode="numeric"
            className="h-9 w-24 rounded-lg"
          />
        </div>
      ) : (
        <Input
          value={usb}
          onChange={(e) => setUsb(e.target.value)}
          placeholder="Identificador USB (ex: POS-80)"
          className="h-9 rounded-lg"
        />
      )}

      <Button
        size="sm"
        className="mt-3 w-full rounded-xl"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Save className="mr-1.5 h-4 w-4" /> Salvar conexão
          </>
        )}
      </Button>
    </div>
  );
}

