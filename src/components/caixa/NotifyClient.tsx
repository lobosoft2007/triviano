import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { insertNotification } from "@/lib/notifications";
import { empresaQueryOptions } from "@/lib/empresa";
import type { CaixaOrder } from "@/lib/caixa";

/**
 * "Notificar Cliente" section inside an active order card. Lets the operator
 * push a custom in-app notification to the client.
 */
export function NotifyClient({ order }: { order: CaixaOrder }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { data: empresa } = useQuery(empresaQueryOptions);
  const brand = empresa?.nome_fantasia || "";

  const orderNo = `#${order.id.slice(0, 6).toUpperCase()}`;

  async function handlePush() {
    const text = message.trim();
    if (!text) {
      toast.error("Digite uma mensagem.");
      return;
    }
    if (!order.user_id) {
      toast.error("Pedido sem cliente vinculado.");
      return;
    }
    setSending(true);
    try {
      await insertNotification({
        idPedido: order.id,
        idUsuario: order.user_id,
        titulo: `${brand} · Pedido ${orderNo}`,
        mensagem: text,
      });
      toast.success("Alerta enviado ao cliente.");
      setMessage("");
    } catch {
      toast.error("Não foi possível enviar o alerta.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Notificar cliente
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ex.: Entregador não localizou o endereço, favor entrar em contato."
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
      />
      <Button
        size="sm"
        className="mt-2 w-full rounded-lg"
        onClick={handlePush}
        disabled={sending}
      >
        {sending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-1.5 h-4 w-4" />
        )}
        Enviar pelo App
      </Button>
    </div>
  );
}
