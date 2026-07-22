import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateStatusPedido,
  cancelOrder,
  ESTEIRA_STATUSES,
  type StatusPedido,
} from "@/lib/caixa";
import { notifyStatusChange, notifyOrderCanceled } from "@/lib/notifications";
import { empresaQueryOptions } from "@/lib/empresa";

/**
 * Subtle, operator-friendly Tailwind tints per esteira status so the operator
 * can read the kitchen/delivery situation at a glance.
 */
const STATUS_STYLE: Record<
  StatusPedido,
  { dot: string; select: string }
> = {
  Recebido: {
    dot: "bg-amber-400",
    select: "border-amber-400/60 bg-amber-400/10 text-amber-300",
  },
  "Em preparação": {
    dot: "bg-blue-400",
    select: "border-blue-400/60 bg-blue-400/10 text-blue-300",
  },
  "Aguardando entregador": {
    dot: "bg-sky-400",
    select: "border-sky-400/60 bg-sky-400/10 text-sky-300",
  },
  "Em entrega": {
    dot: "bg-violet-400",
    select: "border-violet-400/60 bg-violet-400/10 text-violet-300",
  },
  Entregue: {
    dot: "bg-emerald-400",
    select: "border-emerald-400/60 bg-emerald-400/10 text-emerald-300",
  },
  Finalizado: {
    dot: "bg-emerald-500",
    select: "border-emerald-500/70 bg-emerald-500/15 text-emerald-200",
  },
  Cancelado: {
    dot: "bg-red-500",
    select: "border-red-500/60 bg-red-500/10 text-red-300",
  },
};

export function StatusControl({
  orderId,
  userId,
  status,
}: {
  orderId: string;
  userId?: string;
  status: StatusPedido;
}) {
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: StatusPedido) {
    if (next === status) return;

    // Cancellation is a special, reversible operation: reverse the Kardex
    // stock and push a branded cancellation alert to the customer.
    if (next === "Cancelado") {
      if (
        !confirm(
          "Cancelar este pedido? O estoque abatido será estornado e o cliente será avisado.",
        )
      )
        return;
      setSaving(true);
      try {
        await cancelOrder(orderId);
        if (userId) {
          try {
            await notifyOrderCanceled(
              orderId,
              userId,
              empresa?.nome_fantasia ?? "",
            );
          } catch {
            toast.warning(
              "Pedido cancelado, mas o alerta no app falhou. Avise o cliente pelo WhatsApp.",
            );
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
        toast.success("Pedido cancelado e estoque estornado.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível cancelar o pedido.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      // 1. Persist the new status in the orders table (mandatory).
      await updateStatusPedido(orderId, next);
      // 2. Insert the matching row in notificacoes_cliente (mandatory) — this
      //    forces the client's bell to blink in real time via Realtime.
      if (userId) {
        try {
          await notifyStatusChange(orderId, userId, next);
        } catch {
          toast.warning(
            "Status salvo, mas o alerta no app falhou. Use o WhatsApp para avisar o cliente.",
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
    } catch {
      toast.error("Não foi possível atualizar o status.");
    } finally {
      setSaving(false);
    }
  }

  const style = STATUS_STYLE[status] ?? STATUS_STYLE.Recebido;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
        aria-hidden
      />
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as StatusPedido)}
        disabled={saving}
        aria-label="Status do pedido"
        className={`h-9 flex-1 rounded-lg border-2 px-2 text-sm font-semibold transition-colors disabled:opacity-60 ${style.select}`}
      >
        {ESTEIRA_STATUSES.filter((s) => s === status || s !== "Finalizado").map(
          (s) => (
            <option key={s} value={s} className="bg-background text-foreground">
              {s}
            </option>
          ),
        )}
        <option value="Cancelado" className="bg-background text-foreground">
          Cancelado
        </option>

      </select>
      {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
