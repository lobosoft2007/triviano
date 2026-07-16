import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  ShieldAlert,
  UtensilsCrossed,
  Printer,
  Receipt,
  Volume2,
  VolumeX,
  Usb,
  Network,
  Save,
  Pencil,
  HandCoins,
  Bell,
  Check,
  X,
  Wallet,
} from "lucide-react";
import { PaymentConfigTab } from "@/components/admin/PaymentConfigTab";

import { OrderEditDialog } from "@/components/caixa/OrderEditDialog";
import { CloseCaixaDialog } from "@/components/caixa/CloseCaixaDialog";
import { PaymentDialog } from "@/components/caixa/PaymentDialog";
import { ComandaPaymentDialog } from "@/components/caixa/ComandaPaymentDialog";
import { FiscalConfigTab } from "@/components/caixa/FiscalConfigTab";
import { NotifyClient } from "@/components/caixa/NotifyClient";
import { WhatsAppStatusButton } from "@/components/caixa/WhatsAppStatusButton";
import { ContaCorrenteTab } from "@/components/caixa/ContaCorrenteTab";
import { ClientesView } from "@/components/admin/ClientesView";
import { AjusteRapidoView } from "@/components/admin/AjusteRapidoView";
import { PartialReportDialog } from "@/components/caixa/PartialReportDialog";
import { BalcaoView } from "@/components/caixa/BalcaoView";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CaixaSidebar } from "@/components/caixa/CaixaSidebar";


import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  usePermissions,
  canEnterCaixa,
  caixaTabAllowed,
  CAIXA_TAB_ORDER,
  ACCESS_DENIED_MSG,
  type CaixaTab,
  type MyPermissions,
} from "@/lib/permissions";
import { empresaQueryOptions } from "@/lib/empresa";
import {
  fetchSolicitacoesPendentes,
  fetchComandasAguardandoFechamento,
  fetchComandasVivas,
  fetchComandaById,
  liberarMesa,
  isMesaOcupadaError,
  recusarSolicitacao,
  type ComandaFechamento,
  type SolicitacaoPendente,
} from "@/lib/mesa";
import {
  fetchPixStaticConfig,
  fetchMpPublicConfig,
  createMpComandaPayment,
} from "@/lib/mercadopago";
import { generatePixPayload } from "@/lib/pixPayment";
import { formatBRL } from "@/lib/format";
import { MoneyCounter, type MoneyCount } from "@/components/MoneyCounter";
import {
  addMovimentacao,
  fetchCaixaOrders,
  fetchMeiosPagamento,
  fetchMovimentacoes,
  fetchOpenCaixa,
  markPrintedConta,
  markPrintedCozinha,
  openCaixa,
  saldoAtual,
  NON_CASH_MEIOS,
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
import {
  buildTestCoupon,
  clearPreference as clearThermalPref,
  getPreference as getThermalPref,
  isSupported as isThermalSupported,
  isWebSerialSupported,
  isWebUsbSupported,
  printBytes as printThermalBytes,
  requestSerialPort as requestThermalSerial,
  requestUsbDevice as requestThermalUsb,
  setPreference as setThermalPref,
  type ThermalPreference,
} from "@/lib/thermal-printer";
import { buildMesaBillEscPos } from "@/lib/thermal-receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/caixa")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { tab?: CaixaTab; denied?: string } => ({
    tab: typeof s.tab === "string" ? (s.tab as CaixaTab) : undefined,
    denied: typeof s.denied === "string" ? s.denied : undefined,
  }),
  component: CaixaPage,
});

const PIX_KEY = "21993383918";
const PIX_NAME = "Marcello Ribeiro Lobo Assumpção";
// Nome da empresa para os cupons impressos — sincronizado da empresa ativa.
let RESTAURANT = "";

// Título exibido no header enxuto conforme a aba/módulo ativo na Sidebar.
const CAIXA_TAB_TITLES: Record<CaixaTab, string> = {
  delivery: "Delivery",
  mesas: "Mesas",
  balcao: "Atendimento Balcão",
  fiado: "Conta Corrente",
  clientes: "Clientes",
  config: "Impressão",
  pagamento: "Pagamento",
  fiscal: "Fiscal",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */


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
  const { data: perms, isLoading: permLoading } = usePermissions();
  const { data: empresa } = useQuery(empresaQueryOptions);

  const userRole =
    (user as { role?: string } | null)?.role ??
    (user?.app_metadata as { role?: string } | undefined)?.role;
  const allowed = userRole === "admin" || canEnterCaixa(perms);

  useEffect(() => {
    if (empresa?.nome_fantasia) RESTAURANT = empresa.nome_fantasia;
  }, [empresa]);

  const { data: caixa, isLoading: caixaLoading } = useQuery({
    queryKey: ["caixa-open"],
    queryFn: fetchOpenCaixa,
    enabled: allowed,
  });

  if ((userRole !== "admin" && permLoading) || (allowed && caixaLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole === "admin") {
    const adminPerms = perms ?? ({ is_admin: true, is_funcionario: false } as MyPermissions);
    if (caixa) return <OperationalPanel caixaId={caixa.id} perms={adminPerms} />;
    return canOpenCaixa(adminPerms) ? (
      <LockScreen userId={user!.id} />
    ) : (
      <WaitingOpenScreen />
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="font-display text-xl font-bold">Acesso restrito</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Seu nível de acesso não permite abrir o painel CAIXA. Fale com o administrador da empresa.
        </p>
      </div>
    );
  }

  if (caixa) return <OperationalPanel caixaId={caixa.id} perms={perms!} />;
  return canOpenCaixa(perms) ? (
    <LockScreen userId={user!.id} />
  ) : (
    <WaitingOpenScreen />
  );
}

/** True when the user may open/close the cash register turn. */
function canOpenCaixa(p: MyPermissions | undefined): boolean {
  return !!p && (p.is_admin || p.acesso_abrir_fechar_caixa);
}

/* ------------------------------------------------------------------ */
/* Waiting screen (caixa fechado, sem permissão para abrir)            */
/* ------------------------------------------------------------------ */

function WaitingOpenScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock className="h-7 w-7" />
      </span>
      <h1 className="font-display text-xl font-bold">Caixa fechado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Aguardando a abertura do caixa por um responsável. Seu nível de acesso
        não permite abrir o turno.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lock screen (caixa fechado)                                         */
/* ------------------------------------------------------------------ */

function LockScreen({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [counts, setCounts] = useState<MoneyCount>({});
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    if (total < 0) {
      toast.error("Informe um valor de abertura válido.");
      return;
    }
    setSubmitting(true);
    try {
      await openCaixa({
        userId,
        valorAbertura: total,
        metadados: Object.keys(counts).length ? counts : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["caixa-open"] });
      toast.success("Caixa aberto!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível abrir o caixa.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 shadow-card">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="font-display text-2xl font-bold">Caixa fechado</h1>
          <p className="text-sm text-muted-foreground">
            Conte o dinheiro físico em caixa para iniciar o turno.
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
            <Label>Contagem de abertura</Label>
            <MoneyCounter
              value={counts}
              onChange={(c, t) => {
                setCounts(c);
                setTotal(t);
              }}
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
              `Confirmar abertura · ${formatBRL(total)}`
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

function OperationalPanel({ caixaId, perms }: { caixaId: string; perms: MyPermissions }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { signOut } = useAuth();




  const handleLock = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    try {
      sessionStorage.setItem("post_login_redirect", "/caixa");
    } catch {
      /* ignore storage errors */
    }
    navigate({ to: "/auth", replace: true });
  }, [queryClient, signOut, navigate]);

  const search = Route.useSearch();

  // First tab this user is allowed to open, honoring an explicit ?tab= deep-link.
  const firstAllowedTab: CaixaTab =
    CAIXA_TAB_ORDER.find((k) => caixaTabAllowed(perms, k)) ?? "balcao";
  const requestedTab =
    search.tab && caixaTabAllowed(perms, search.tab) ? search.tab : null;

  const [tab, setTab] = useState<CaixaTab>(requestedTab ?? firstAllowedTab);
  const deniedShown = useRef(false);

  // Camada 2 — enforcement de módulo: um deep-link para uma aba proibida (ou
  // um redirect de porta com ?denied=) dispara o toast e cai na 1ª aba liberada.
  useEffect(() => {
    const requestedForbidden = search.tab && !caixaTabAllowed(perms, search.tab);
    if ((search.denied || requestedForbidden) && !deniedShown.current) {
      deniedShown.current = true;
      toast.error(ACCESS_DENIED_MSG);
    }
    if (!caixaTabAllowed(perms, tab)) {
      setTab(firstAllowedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search.tab, search.denied]);

  const [partialOpen, setPartialOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
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
  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento-all"],
    queryFn: () => fetchMeiosPagamento(false),
  });

  // Fila de Visto (solicitações de abertura) + comandas pedindo fechamento.
  const { data: solicitacoes } = useQuery({
    queryKey: ["mesa-solicitacoes"],
    queryFn: fetchSolicitacoesPendentes,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });
  const { data: fechamentos } = useQuery({
    queryKey: ["mesa-fechamentos"],
    queryFn: fetchComandasAguardandoFechamento,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });
  // Todas as mesas com comanda VIVA — para destacar conflito na Fila de Visto.
  const { data: mesasVivas } = useQuery({
    queryKey: ["mesas-vivas"],
    queryFn: fetchComandasVivas,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });
  const mesasOcupadasMap = useMemo(() => {
    const m = new Map<number, ComandaFechamento>();
    for (const c of mesasVivas ?? []) m.set(c.numero_mesa, c);
    return m;
  }, [mesasVivas]);

  const fechamentoMesas = useMemo(
    () => new Set((fechamentos ?? []).map((f) => f.numero_mesa)),
    [fechamentos],
  );

  const resolveSector = useMemo(
    () => makeSectorResolver(printers ?? [], catRouting ?? []),
    [printers, catRouting],
  );

  // Realtime: refresh orders + beep on new ones (com reassinatura se cair).
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (cancelled) return;
      channel = supabase
        .channel("caixa-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
          },
        )
        .subscribe((status) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            if (channel) supabase.removeChannel(channel);
            channel = null;
            if (!cancelled) {
              retryTimer = setTimeout(connect, 2000);
            }
          }
        });
    };
    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Realtime: Fila de Visto e pedidos de fechamento de mesa (auto-reassinatura).
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (cancelled) return;
      channel = supabase
        .channel("caixa-mesas")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "solicitacoes_mesa" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["mesa-solicitacoes"] });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "comanda_ativa" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["mesa-fechamentos"] });
            queryClient.invalidateQueries({ queryKey: ["mesas-vivas"] });
          },
        )
        .subscribe((status) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            if (channel) supabase.removeChannel(channel);
            channel = null;
            if (!cancelled) {
              retryTimer = setTimeout(connect, 2000);
            }
          }
        });
    };
    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
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

  const nonCashMeioIds = useMemo(
    () =>
      new Set(
        (meios ?? [])
          .filter((m) => NON_CASH_MEIOS.has(m.nome))
          .map((m) => m.id),
      ),
    [meios],
  );
  const saldo = useMemo(
    () =>
      caixa && movs
        ? saldoAtual(caixa, movs, nonCashMeioIds)
        : caixa?.valor_abertura ?? 0,
    [caixa, movs, nonCashMeioIds],
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
      // v1.7.4: sem push automático em "Em preparação". O cliente só recebe
      // notificações em (a) mesa liberada e (b) pedido recebido. Alertas
      // extras ficam com o botão NotifyClient (manual).
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
    // Valor AGREGADO da comanda (fonte da verdade). Busca o total_parcial da
    // comanda_ativa vinculada; se não houver comanda, cai na soma dos pedidos.
    const comandaId =
      mesaOrdersGroup.find((o) => o.comanda_id)?.comanda_id ?? null;
    let totalParcial = mesaOrdersGroup.reduce((s, o) => s + o.total, 0);
    if (comandaId) {
      try {
        const comanda = await fetchComandaById(comandaId);
        if (comanda && comanda.total_parcial > 0) {
          totalParcial = comanda.total_parcial;
        }
      } catch {
        /* mantém o fallback (soma dos pedidos) */
      }
    }

    // --- 1) Preferir o QR DINÂMICO do Mercado Pago (baixa automática) -----
    // Se a empresa tem MP ativo e há uma comanda vinculada, geramos aqui a
    // mesma Order que o app do cliente usaria. O QR impresso passa a estar
    // ligado a um mp_order_id — quando o cliente pagar (pelo cupom OU pelo
    // app), o webhook liquida a comanda inteira automaticamente.
    let qr = "";
    let brcode = "";
    let pixKey = "";
    let pixName = "";
    let usedMp = false;

    if (comandaId) {
      try {
        const mpCfg = await fetchMpPublicConfig();
        if (mpCfg?.ativo && mpCfg.aceita_pix_online) {
          const mpRes = await createMpComandaPayment({
            comandaId,
            method: "pix",
          });
          if (mpRes.qr_code_base64) {
            qr = `data:image/png;base64,${mpRes.qr_code_base64}`;
          }
          brcode = mpRes.qr_code ?? "";
          usedMp = !!(qr || brcode);
        }
      } catch (err) {
        console.warn("printBill: falha ao gerar QR do MP, usando PIX estático.", err);
      }
    }

    // --- 2) Fallback: PIX ESTÁTICO da empresa (sem baixa automática) ------
    if (!usedMp) {
      const pixCfg = await fetchPixStaticConfig().catch(() => null);
      pixKey = pixCfg?.chave_pix || PIX_KEY;
      pixName = pixCfg?.nome_recebedor || PIX_NAME;
      const pixCity = pixCfg?.cidade_recebedor || "SAO PAULO";
      brcode = generatePixPayload({
        pixKey,
        merchantName: pixName,
        merchantCity: pixCity,
        amount: totalParcial,
      });
      qr = await QRCode.toDataURL(brcode, { margin: 1, width: 220 }).catch(
        () => "",
      );
    }

    await printAndRun(
      <BillReceipt
        mesa={mesa}
        orders={mesaOrdersGroup}
        qr={qr}
        total={totalParcial}
        pixKey={pixKey}
        pixName={pixName}
        brcode={brcode}
        mpDynamic={usedMp}
      />,
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

  /* -------- Fila de Visto: liberar / recusar mesa ------------------- */
  const [conflitoMesa, setConflitoMesa] = useState<{
    solicitacaoId: string;
    numeroMesa: number;
    ocupacao: ComandaFechamento;
  } | null>(null);

  const runLiberar = useCallback(
    async (id: string, mesa: number, forcar: boolean) => {
      try {
        await liberarMesa(id, { forcar });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["mesa-solicitacoes"] }),
          queryClient.invalidateQueries({ queryKey: ["mesas-vivas"] }),
          queryClient.invalidateQueries({ queryKey: ["mesa-fechamentos"] }),
          queryClient.invalidateQueries({ queryKey: ["caixa-orders"] }),
        ]);
        toast.success(
          forcar
            ? `Mesa ${mesa} zerada e reaberta. 🍽️`
            : `Mesa ${mesa} liberada. Bom atendimento! 🍽️`,
        );
      } catch (err) {
        if (isMesaOcupadaError(err)) {
          const ocup =
            mesasOcupadasMap.get(mesa) ?? {
              numero_mesa: mesa,
              total_parcial: 0,
              nome_cliente: "cliente",
            };
          setConflitoMesa({ solicitacaoId: id, numeroMesa: mesa, ocupacao: ocup });
          return;
        }
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível liberar a mesa.",
        );
      }
    },
    [queryClient, mesasOcupadasMap],
  );

  async function handleLiberar(id: string, mesa: number) {
    await runLiberar(id, mesa, false);
  }

  async function handleRecusar(id: string, mesa: number) {
    if (!window.confirm(`Recusar a solicitação da mesa ${mesa}?`)) return;
    try {
      await recusarSolicitacao(id);
      await queryClient.invalidateQueries({ queryKey: ["mesa-solicitacoes"] });
      toast.success(`Solicitação da mesa ${mesa} recusada.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível recusar.",
      );
    }
  }

  // Alerta sonoro + toast persistente quando entra uma NOVA solicitação de
  // abertura. O toast só aparece quando o operador está em outra aba (na aba
  // Mesas a Fila de Visto já é ultra-visível).
  const prevSolicRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!solicitacoes) return;
    const ids = new Set(solicitacoes.map((s) => s.id));
    const prev = prevSolicRef.current;
    if (prev) {
      const novas = solicitacoes.filter((s) => !prev.has(s.id));
      if (novas.length > 0) {
        if (soundOn) playBeep();
        if (tab !== "mesas") {
          toast.warning(
            `Nova solicitação de mesa (${novas[0].numero_mesa})${
              novas.length > 1 ? ` e mais ${novas.length - 1}` : ""
            }`,
            {
              duration: 12000,
              action: {
                label: "Ir para Mesas",
                onClick: () => setTab("mesas"),
              },
            },
          );
        }
      }
    }
    prevSolicRef.current = ids;
  }, [solicitacoes, soundOn, tab]);


  // Quando uma mesa PEDE o fechamento, imprime a conferência automaticamente.
  const prevFechRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!fechamentos) return;
    const nums = new Set(fechamentos.map((f) => f.numero_mesa));
    const prev = prevFechRef.current;
    if (prev) {
      for (const f of fechamentos) {
        if (prev.has(f.numero_mesa)) continue;
        if (soundOn) playBeep();
        const group = mesaOrders.filter((o) => o.numero_mesa === f.numero_mesa);
        if (group.length > 0) {
          void printBill(f.numero_mesa, group);
        }
        toast.warning(`Mesa ${f.numero_mesa} pediu a conta! Conferência impressa.`);
      }
    }
    prevFechRef.current = nums;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechamentos, soundOn]);

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

  const [closeOpen, setCloseOpen] = useState(false);


  return (
    <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden">
      <CaixaSidebar
        perms={perms}
        activeTab={tab}
        deliveryCount={deliveryOrders.length}
        mesaCount={mesasVivas?.length ?? 0}
        solicitacoesCount={solicitacoes?.length ?? 0}
        onSelectTab={setTab}
        onSuprimento={() => handleMov("Suprimento")}
        onSangria={() => handleMov("Sangria")}
        onRecebimento={() => handleMov("Recebimento Pedido")}
        onParcial={() => setPartialOpen(true)}
        onAjuste={() => setAjusteOpen(true)}
        onFecharCaixa={() => setCloseOpen(true)}
        onLock={handleLock}
      />

      <SidebarInset className="min-h-0 overflow-hidden">
        <AppShell className="h-full">
          {/* Slim header */}
          <ShellHeader className="border-b border-border bg-background/95 backdrop-blur-md">
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <SidebarTrigger className="shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Painel operacional
                </p>
                <h1 className="truncate font-display text-xl font-bold leading-tight">
                  {CAIXA_TAB_TITLES[tab] ?? "CAIXA"}
                </h1>
              </div>
              <div className="ml-auto flex items-center gap-2">
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                >
                  {soundOn ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <VolumeX className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </ShellHeader>


      <ShellBody
        className={
          tab === "balcao"
            ? "w-full px-4 py-4"
            : "w-full px-4 py-5 lg:px-8"
        }
      >
        {tab !== "config" &&
          tab !== "pagamento" &&
          tab !== "fiscal" &&
          tab !== "fiado" &&
          tab !== "clientes" &&
          tab !== "balcao" &&
          !orders && (
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
          <div className="flex flex-col gap-4">
            <VistoQueue
              solicitacoes={solicitacoes ?? []}
              mesasOcupadas={mesasOcupadasMap}
              onLiberar={handleLiberar}
              onRecusar={handleRecusar}
            />
            <MesasColumn
              orders={mesaOrders}
              onDispatch={dispatchPreparation}
              onPrintBill={printBill}
              resolveSector={resolveSector}
              fechamentoMesas={fechamentoMesas}
              comandasVivas={mesasVivas ?? []}
            />

          </div>
        )}

        {tab === "balcao" && <BalcaoView />}
        {tab === "config" && <ConfigTab />}
        {tab === "pagamento" && <PaymentConfigTab />}
        {tab === "fiscal" && <FiscalConfigTab />}
        {tab === "fiado" && <ContaCorrenteTab mode="caixa" />}
        {tab === "clientes" && <ClientesView canBlock={false} />}
      </ShellBody>

      {/* Partial cash report (X de caixa) */}
      {caixa && (
        <PartialReportDialog
          caixa={caixa}
          open={partialOpen}
          onOpenChange={setPartialOpen}
        />
      )}

      {/* Ajuste Rápido / Entrada Emergencial */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="font-display">
              Ajuste Rápido de Estoque
            </DialogTitle>
          </DialogHeader>
          <AjusteRapidoView />
        </DialogContent>
      </Dialog>

      {/* Confirmação de mesa ocupada (Protocolo de Incineração — v1.7.3) */}
      <AlertDialog
        open={!!conflitoMesa}
        onOpenChange={(v) => !v && setConflitoMesa(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Mesa {conflitoMesa?.numeroMesa} já está ocupada
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Cliente atual: <strong>{conflitoMesa?.ocupacao.nome_cliente || "cliente"}</strong> ·{" "}
                Consumo: <strong>R$ {Number(conflitoMesa?.ocupacao.total_parcial ?? 0).toFixed(2).replace(".", ",")}</strong>.
              </span>
              <span className="block">
                Ao <strong>zerar</strong>, todos os pedidos pendentes desta mesa serão
                cancelados e uma nova comanda começa em R$ 0,00. Essa ação é irreversível.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter mesa atual</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!conflitoMesa) return;
                const { solicitacaoId, numeroMesa } = conflitoMesa;
                setConflitoMesa(null);
                await runLiberar(solicitacaoId, numeroMesa, true);
              }}
            >
              Zerar mesa e começar do zero
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close cash register dialog */}
      {caixa && (
        <CloseCaixaDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          caixaId={caixa.id}
          saldoEsperado={saldo}
          onClosed={async () => {
            await queryClient.invalidateQueries({ queryKey: ["caixa-open"] });
          }}
        />
      )}

      {/* Hidden thermal print surface */}
      <div className="thermal-receipt">{printNode}</div>
        </AppShell>
      </SidebarInset>
    </SidebarProvider>
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
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((o) => (
        <CompactOrderRow
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
/* Wait time helper                                                    */
/* ------------------------------------------------------------------ */

/** Live "tempo de espera" since the order was created, updated each minute. */
function useWaitTime(createdAt: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Compact order row (single column) + detail dialog                   */
/* ------------------------------------------------------------------ */

function CompactOrderRow({
  order,
  onDispatch,
  resolveSector,
}: {
  order: CaixaOrder;
  onDispatch: (o: CaixaOrder) => void;
  resolveSector: ResolveFn;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const wait = useWaitTime(order.created_at);
  const isNew = !order.impresso_cozinha;
  const hora = new Date(order.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setDetailOpen(true);
        }}
        className={`cursor-pointer rounded-2xl border bg-card p-3.5 shadow-card transition-colors hover:bg-secondary/50 ${
          isNew ? "border-primary ring-1 ring-primary/30" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold">
              {order.customer_name || "Cliente"}
              {order.tipo_atendimento === "Presencial" && (
                <span className="ml-1 text-muted-foreground">
                  · Mesa {order.numero_mesa ?? "—"}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              #{order.id.slice(0, 6).toUpperCase()} · {hora} · espera {wait}
            </p>
          </div>
          <span className="shrink-0 font-display text-base font-bold tabular-nums text-primary">
            {formatBRL(order.total)}
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {isNew ? (
            <Button
              size="sm"
              className="shrink-0 rounded-xl"
              onClick={() => onDispatch(order)}
            >
              <Printer className="mr-1.5 h-4 w-4" /> Imprimir
            </Button>
          ) : (
            <span className="shrink-0 text-[11px] font-semibold text-success">
              ✓ impresso
            </span>
          )}
        </div>
      </div>


      {detailOpen && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle className="font-display">
                Pedido #{order.id.slice(0, 6).toUpperCase()} · espera {wait}
              </DialogTitle>
            </DialogHeader>
            <OrderCard
              order={order}
              onDispatch={onDispatch}
              resolveSector={resolveSector}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mesas column — visually sister to Delivery (scannable cards)         */
/* ------------------------------------------------------------------ */

type MesaFilter = "todas" | "ocupadas" | "aguardando";

const MESA_FILTERS: { key: MesaFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "ocupadas", label: "Ocupadas" },
  { key: "aguardando", label: "Aguardando conta" },
];

/** A single table with all its open orders, grouped for the board. */
interface MesaGroup {
  mesa: number;
  orders: CaixaOrder[];
  total: number;
  /** earliest order creation → "aberta há" timer */
  openedAt: string;
  customer: string;
  hasNew: boolean;
  /** conta já impressa em qualquer pedido → aguardando pagamento */
  awaitingBill: boolean;
  /** comanda ativa que agrega os pedidos da mesa (liquidação unificada) */
  comandaId: string | null;
}

/* ------------------------------------------------------------------ */
/* Fila de Visto — solicitações de abertura de mesa                     */
/* ------------------------------------------------------------------ */

function VistoQueue({
  solicitacoes,
  mesasOcupadas,
  onLiberar,
  onRecusar,
}: {
  solicitacoes: SolicitacaoPendente[];
  mesasOcupadas: Map<number, ComandaFechamento>;
  onLiberar: (id: string, mesa: number) => void;
  onRecusar: (id: string, mesa: number) => void;
}) {
  if (solicitacoes.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-warning bg-warning/10 p-3.5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning text-warning-foreground">
          <Bell className="h-4 w-4 animate-pulse" />
        </span>
        <h2 className="font-display text-base font-bold">
          Solicitações de abertura
          <span className="ml-2 rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
            {solicitacoes.length}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {solicitacoes.map((s) => {
          const ocupada = mesasOcupadas.get(s.numero_mesa);
          const isConflito = !!ocupada;
          return (
            <div
              key={s.id}
              className={
                isConflito
                  ? "flex flex-col gap-2 rounded-xl border-2 border-destructive bg-destructive/10 p-2.5"
                  : "flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold">
                  Mesa {s.numero_mesa} · {s.nome_cliente || "Cliente"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.telefone || "sem telefone"} ·{" "}
                  {new Date(s.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {isConflito && ocupada && (
                  <p className="mt-1 truncate text-[11px] font-bold text-destructive">
                    MESA OCUPADA · {ocupada.nome_cliente || "cliente"} ·{" "}
                    R$ {Number(ocupada.total_parcial ?? 0).toFixed(2).replace(".", ",")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 self-end">
                <Button
                  size="icon"
                  variant={isConflito ? "destructive" : "success"}
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label={
                    isConflito
                      ? `Zerar mesa ${s.numero_mesa} e liberar`
                      : `Liberar mesa ${s.numero_mesa}`
                  }
                  title={
                    isConflito
                      ? "Zerar mesa e começar do zero"
                      : "Liberar mesa"
                  }
                  onClick={() => onLiberar(s.id, s.numero_mesa)}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
                  aria-label={`Recusar mesa ${s.numero_mesa}`}
                  onClick={() => onRecusar(s.id, s.numero_mesa)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MesasColumn({
  orders,
  onDispatch,
  onPrintBill,
  resolveSector,
  fechamentoMesas,
  comandasVivas,
}: {
  orders: CaixaOrder[];
  onDispatch: (o: CaixaOrder) => void;
  onPrintBill: (mesa: number, group: CaixaOrder[]) => void;
  resolveSector: ResolveFn;
  fechamentoMesas: Set<number>;
  /** Todas as comandas VIVAS — usadas para manter a mesa visível mesmo antes
   *  do primeiro pedido (Visto dado, cliente ainda escolhendo). */
  comandasVivas: ComandaFechamento[];
}) {
  const [filter, setFilter] = useState<MesaFilter>("todas");

  const grouped = useMemo<MesaGroup[]>(() => {
    const map = new Map<number, CaixaOrder[]>();
    for (const o of orders) {
      const mesa = o.numero_mesa ?? 0;
      const arr = map.get(mesa) ?? [];
      arr.push(o);
      map.set(mesa, arr);
    }
    const groups: MesaGroup[] = [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([mesa, group]) => {
        const sorted = [...group].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        return {
          mesa,
          orders: sorted,
          total: group.reduce((s, o) => s + o.total, 0),
          openedAt: sorted[0]?.created_at ?? new Date().toISOString(),
          customer: sorted[0]?.customer_name || "Cliente",
          hasNew: group.some((o) => !o.impresso_cozinha),
          awaitingBill: group.some((o) => o.impresso_conta),
          comandaId: sorted.find((o) => o.comanda_id)?.comanda_id ?? null,
        };
      });

    // v1.7.4: mesas com comanda VIVA mas SEM pedidos ainda continuam visíveis
    // (Visto foi dado, cliente está escolhendo). Só somem quando o operador
    // encerra a comanda no recebimento.
    const jaListadas = new Set(groups.map((g) => g.mesa));
    for (const c of comandasVivas) {
      if (jaListadas.has(c.numero_mesa)) continue;
      groups.push({
        mesa: c.numero_mesa,
        orders: [],
        total: Number(c.total_parcial ?? 0),
        openedAt: c.created_at ?? new Date().toISOString(),
        customer: c.nome_cliente || "Cliente",
        hasNew: false,
        awaitingBill: false,
        comandaId: c.id ?? null,
      });
    }
    groups.sort((a, b) => a.mesa - b.mesa);
    return groups;
  }, [orders, comandasVivas]);



  const visible = useMemo(() => {
    if (filter === "aguardando") return grouped.filter((g) => g.awaitingBill);
    if (filter === "ocupadas") return grouped.filter((g) => !g.awaitingBill);
    return grouped;
  }, [grouped, filter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter chips — mesmo estilo horizontal das categorias do Balcão */}
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex flex-nowrap gap-2 pb-1">
          {MESA_FILTERS.map((f) => {
            const count =
              f.key === "todas"
                ? grouped.length
                : f.key === "aguardando"
                  ? grouped.filter((g) => g.awaitingBill).length
                  : grouped.filter((g) => !g.awaitingBill).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    active
                      ? "bg-primary-foreground/20"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState label="Nenhuma mesa neste filtro." />
      ) : (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <MesaCard
              key={g.mesa}
              group={g}
              onDispatch={onDispatch}
              onPrintBill={onPrintBill}
              resolveSector={resolveSector}
              aguardandoFechamento={fechamentoMesas.has(g.mesa)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MesaCard({
  group,
  onDispatch,
  onPrintBill,
  resolveSector,
  aguardandoFechamento,
}: {
  group: MesaGroup;
  onDispatch: (o: CaixaOrder) => void;
  onPrintBill: (mesa: number, group: CaixaOrder[]) => void;
  resolveSector: ResolveFn;
  aguardandoFechamento: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const wait = useWaitTime(group.openedAt);
  const isEmpty = group.orders.length === 0;


  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setDetailOpen(true);
        }}
        className={`flex cursor-pointer flex-col rounded-2xl border bg-card p-3.5 shadow-card transition-colors hover:bg-secondary/50 ${
          aguardandoFechamento
            ? "animate-pulse border-warning bg-warning/10 ring-2 ring-warning"
            : group.hasNew
              ? "border-primary ring-1 ring-primary/30"
              : "border-border"
        }`}
      >
        {aguardandoFechamento && (
          <span className="mb-2 flex w-fit items-center gap-1 rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warning-foreground">
            <Bell className="h-3 w-3" /> Pediu a conta
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-base font-bold leading-tight">
              <UtensilsCrossed className="h-4 w-4 shrink-0 text-primary" />
              Mesa {group.mesa || "—"}
            </p>
            <p className="truncate text-sm font-medium text-muted-foreground">
              {group.customer}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="font-display text-lg font-bold tabular-nums text-success">
              {formatBRL(group.total)}
            </span>
            <p className="text-[11px] text-muted-foreground">consumido</p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>aberta há {wait}</span>
          <span>·</span>
          <span>{group.orders.length} pedido(s)</span>
          {isEmpty && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Aguardando pedido
            </span>
          )}
          {!isEmpty && group.awaitingBill && (
            <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
              Aguardando conta
            </span>
          )}
        </div>


        <div
          className="mt-2.5 flex items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 rounded-xl"
            onClick={() => onPrintBill(group.mesa, group.orders)}
            disabled={group.orders.length === 0}
          >
            <Receipt className="mr-1.5 h-4 w-4" /> Imprimir
          </Button>
        </div>

      </div>

      {detailOpen && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle className="font-display">
                Mesa {group.mesa || "—"} · {group.customer} · aberta há {wait}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {group.orders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onDispatch={onDispatch}
                  resolveSector={resolveSector}
                  variant="mesa"
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total da mesa</span>
              <span className="font-display text-lg font-bold text-success">
                {formatBRL(group.total)}
              </span>
            </div>
            <Button
              variant="outline"
              className="mt-3 w-full rounded-xl"
              onClick={() => onPrintBill(group.mesa, group.orders)}
              disabled={isEmpty}
            >
              <Receipt className="mr-1.5 h-4 w-4" /> Imprimir conta / conferência
            </Button>
            {!isEmpty && group.orders.length > 0 && (
              <>
                <WhatsAppStatusButton order={group.orders[group.orders.length - 1]} />
                <NotifyClient order={group.orders[group.orders.length - 1]} />
              </>
            )}
            {group.comandaId && !isEmpty && (
              <Button
                variant="success"
                className="mt-2 h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  setDetailOpen(false);
                  setPayOpen(true);
                }}
              >
                <Wallet className="mr-1.5 h-5 w-5" /> Finalizar e Receber
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}


      {payOpen && group.comandaId && (
        <ComandaPaymentDialog
          comandaId={group.comandaId}
          numeroMesa={group.mesa}
          total={group.total}
          open={payOpen}
          onOpenChange={setPayOpen}
        />
      )}
    </>
  );
}

function OrderCard({
  order,
  onDispatch,
  resolveSector,
  variant = "delivery",
}: {
  order: CaixaOrder;
  onDispatch: (o: CaixaOrder) => void;
  resolveSector: ResolveFn;
  variant?: "delivery" | "mesa";
}) {
  const isNew = !order.impresso_cozinha;
  const isMesa = variant === "mesa";
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
      {order.observacoes_operador && (
        <p className="mt-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary">
          Operador: {order.observacoes_operador}
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

      <OrderActions order={order} showPayment={!isMesa} />

      {!isMesa && (
        <>
          <WhatsAppStatusButton order={order} />
          <NotifyClient order={order} />
        </>
      )}
    </div>
  );
}

function OrderActions({ order, showPayment = true }: { order: CaixaOrder; showPayment?: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  return (
    <>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Button>
        {showPayment && (
          <Button
            size="sm"
            className="flex-1 rounded-xl"
            onClick={() => setPayOpen(true)}
          >
            <HandCoins className="mr-1.5 h-4 w-4" /> Pagamento
          </Button>
        )}
      </div>
      {editOpen && (
        <OrderEditDialog
          order={order}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {showPayment && payOpen && (
        <PaymentDialog order={order} open={payOpen} onOpenChange={setPayOpen} />
      )}
    </>
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
  total,
  pixKey,
  pixName,
  brcode,
  mpDynamic = false,
}: {
  mesa: number;
  orders: CaixaOrder[];
  qr: string;
  /** Total AGREGADO da comanda (total_parcial) — fonte da verdade. */
  total: number;
  pixKey: string;
  pixName: string;
  /** PIX Copia e Cola (BR Code com valor) — backup de digitação. */
  brcode: string;
  /**
   * true = QR dinâmico do Mercado Pago (baixa automática via webhook).
   * false = PIX estático da chave da empresa (baixa manual).
   */
  mpDynamic?: boolean;
}) {
  const items = orders.flatMap((o) => o.order_items);
  const subtotal = orders.reduce(
    (s, o) =>
      s + o.order_items.reduce((a, it) => a + it.unit_price * it.quantity, 0),
    0,
  );
  const discount = orders.reduce((s, o) => s + o.discount, 0);


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
      <p style={{ textAlign: "center", fontWeight: 700 }}>
        Pague com PIX — {formatBRL(total)}
      </p>
      {qr && (
        <div style={{ textAlign: "center" }}>
          <img src={qr} alt="PIX" style={{ width: "40mm", height: "40mm" }} />
        </div>
      )}
      {mpDynamic ? (
        <p style={{ textAlign: "center", fontSize: 10 }}>
          Pagamento via Mercado Pago — baixa automática
        </p>
      ) : (
        <>
          <p style={{ textAlign: "center" }}>Chave: {pixKey}</p>
          <p style={{ textAlign: "center" }}>{pixName}</p>
        </>
      )}
      {brcode && (
        <p
          style={{
            textAlign: "center",
            fontSize: 8,
            wordBreak: "break-all",
            margin: "4px 0",
          }}
        >
          {brcode}
        </p>
      )}
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

