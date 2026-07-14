import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ClipboardList,
  CheckCircle2,
  RotateCcw,
  MapPin,
  Utensils,
  Wallet,
  CircleDollarSign,
  Clock,
} from "lucide-react";
import { fetchOrders, repeatOrder, isReorderable, type OrderRow } from "@/lib/orders";

import { empresaQueryOptions } from "@/lib/empresa";
import { formatBRL } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { NotificationBell } from "@/components/NotificationBell";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import { markOrderNotificationsRead } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

const statusLabels: Record<string, string> = {
  pending: "Recebido",
  preparing: "Em preparo",
  delivering: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

type PaymentBadge = {
  label: string;
  tone: "success" | "warning" | "muted";
  icon: "check" | "clock" | "wallet";
};

function summarizePayment(order: OrderRow): PaymentBadge {
  if (order.pagamentos.length > 0) {
    const nomes = order.pagamentos.map((p) => p.nome).join(" + ");
    if (order.pago_online) {
      return { label: `Pago online · ${nomes}`, tone: "success", icon: "check" };
    }
    return { label: `Pago · ${nomes}`, tone: "success", icon: "check" };
  }
  if (order.pago_online) {
    return { label: "Pago online", tone: "success", icon: "check" };
  }
  if ((order.tipo_atendimento ?? "Delivery") === "Delivery") {
    return { label: "A pagar na entrega", tone: "warning", icon: "clock" };
  }
  return { label: "A pagar no caixa", tone: "warning", icon: "wallet" };
}


function OrdersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addLine } = useCart();
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const { data: empresa } = useQuery(empresaQueryOptions);
  const empresaId = empresa?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["orders", empresaId ?? "all"],
    queryFn: () => fetchOrders(empresaId),
    enabled: !!empresaId,
  });

  async function handleReorder(orderId: string) {
    if (reorderingId) return;
    setReorderingId(orderId);
    try {
      const result = await repeatOrder(orderId);
      if (!result.eligible || result.lines.length === 0) {
        toast.error("Nenhum item deste pedido está disponível no momento.");
        return;
      }
      for (const { line, quantity } of result.lines) {
        addLine(line, quantity);
      }
      if (result.skippedItems > 0) {
        toast.warning(
          `${result.skippedItems} ${
            result.skippedItems === 1 ? "item foi ignorado" : "itens foram ignorados"
          } por estarem fora do cardápio.`,
        );
      } else {
        toast.success("Itens adicionados ao carrinho!");
      }
      void navigate({ to: "/" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Não foi possível repetir o pedido: ${message}`);
    } finally {
      setReorderingId(null);
    }
  }

  // Ação de leitura automática: ao visualizar os pedidos, marca como lidas as
  // notificações vinculadas a eles (atualização de status já foi vista).
  useEffect(() => {
    if (!user?.id || !data || data.length === 0) return;
    const orderIds = data.map((o) => o.id);
    void markOrderNotificationsRead(user.id, orderIds).then(() => {
      queryClient.invalidateQueries({
        queryKey: ["my-notifications", user.id],
      });
    });
  }, [user?.id, data, queryClient]);


  return (
    <AppShell>
        <ShellHeader className="border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-3.5">
          <Link
            to="/"
            aria-label="Voltar ao início"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 font-display text-xl font-bold">Meus pedidos</h1>
          <NotificationBell />
          </div>
        </ShellHeader>

        <ShellBody>
          <main className="mx-auto max-w-md px-5 py-5">
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          )}

          {data && data.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <ClipboardList className="h-8 w-8" />
              </span>
              <p className="text-sm text-muted-foreground">
                Você ainda não fez nenhum pedido.
              </p>
              <Link
                to="/"
                className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Ver cardápio
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {data?.map((order) => {
              const pay = summarizePayment(order);
              const isMesa =
                (order.tipo_atendimento ?? "Delivery") !== "Delivery";
              const payToneClass =
                pay.tone === "success"
                  ? "bg-success/12 text-success"
                  : pay.tone === "warning"
                    ? "bg-accent/15 text-accent-foreground"
                    : "bg-secondary text-muted-foreground";
              const PayIcon =
                pay.icon === "check"
                  ? CircleDollarSign
                  : pay.icon === "clock"
                    ? Clock
                    : Wallet;
              return (
              <article
                key={order.id}
                className="rounded-2xl bg-card p-4 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {statusLabels[order.status] ?? order.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                    {isMesa ? (
                      <>
                        <Utensils className="h-3 w-3" />
                        {order.numero_mesa
                          ? `Mesa ${order.numero_mesa}`
                          : "Presencial"}
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3 w-3" />
                        Delivery
                      </>
                    )}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${payToneClass}`}
                  >
                    <PayIcon className="h-3 w-3" />
                    {pay.label}
                  </span>
                </div>


                <ul className="mt-3 space-y-1">
                  {order.order_items.map((it) => (
                    <li
                      key={it.id}
                      className="flex justify-between gap-3 text-sm text-muted-foreground"
                    >
                      <span className="min-w-0">
                        {it.quantity}× {it.product_name}
                        {it.addons.length > 0 && (
                          <span className="block text-[11px]">
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
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatBRL(it.unit_price * it.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {order.discount > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Desconto combo</span>
                      <span className="tabular-nums">
                        − {formatBRL(order.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="font-display font-bold text-primary">
                      {formatBRL(order.total)}
                    </span>
                  </div>
                </div>

                {isReorderable(order.status_pedido) && (
                  <button
                    onClick={() => handleReorder(order.id)}
                    disabled={reorderingId === order.id}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
                  >
                    {reorderingId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Repetir pedido
                  </button>
                )}
              </article>
              );
            })}

          </div>
          </main>
        </ShellBody>
    </AppShell>
  );
}
