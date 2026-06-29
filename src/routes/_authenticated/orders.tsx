import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ClipboardList, CheckCircle2 } from "lucide-react";
import { fetchOrders } from "@/lib/orders";
import { formatBRL } from "@/lib/format";

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

function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-5 py-3.5 backdrop-blur-md">
          <Link
            to="/menu"
            aria-label="Voltar ao cardápio"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Meus pedidos</h1>
        </header>

        <main className="px-5 py-5">
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
                to="/menu"
                className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Ver cardápio
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {data?.map((order) => (
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

                <ul className="mt-3 space-y-1">
                  {order.order_items.map((it) => (
                    <li
                      key={it.id}
                      className="flex justify-between text-sm text-muted-foreground"
                    >
                      <span>
                        {it.quantity}× {it.product_name}
                      </span>
                      <span className="tabular-nums">
                        {formatBRL(it.unit_price * it.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex justify-between border-t border-border pt-3">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-display font-bold text-primary">
                    {formatBRL(order.total)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
