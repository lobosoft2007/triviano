import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateStatusPedido,
  ESTEIRA_STATUSES,
  type StatusPedido,
} from "@/lib/caixa";

const STATUS_COLOR: Record<StatusPedido, string> = {
  Recebido: "#6366f1",
  "Em preparação": "#f59e0b",
  "Aguardando entregador": "#0ea5e9",
  "Em entrega": "#8b5cf6",
  Entregue: "#10b981",
  Pago: "#059669",
  Cancelado: "#ef4444",
};

export function StatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: StatusPedido;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function handleChange(next: StatusPedido) {
    if (next === status) return;
    setSaving(true);
    try {
      await updateStatusPedido(orderId, next);
      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
    } catch {
      toast.error("Não foi possível atualizar o status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
        aria-hidden
      />
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as StatusPedido)}
        disabled={saving}
        className="h-9 flex-1 rounded-lg border-2 px-2 text-sm font-semibold"
        style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}
      >
        {ESTEIRA_STATUSES.map((s) => (
          <option key={s} value={s} className="text-foreground">
            {s}
          </option>
        ))}
        <option value="Cancelado" className="text-foreground">
          Cancelado
        </option>
      </select>
      {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
