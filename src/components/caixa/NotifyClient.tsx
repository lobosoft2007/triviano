import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { insertNotification } from "@/lib/notifications";
import { empresaQueryOptions } from "@/lib/empresa";
import type { CaixaOrder } from "@/lib/caixa";

/**
 * "Notificar Cliente" section inside an active order card. Lets the operator
 * push a custom in-app notification or open WhatsApp pre-filled.
 */
export function NotifyClient({ order }: { order: CaixaOrder }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { data: empresa } = useQuery(empresaQueryOptions);
  const brand = empresa?.nome_fantasia || "";

  const { data: profile } = useQuery({
    queryKey: ["customer-profile", order.user_id],
    enabled: !!order.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", order.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const orderNo = `#${order.id.slice(0, 6).toUpperCase()}`;
  const phone = profile?.phone || order.phone || "";
  const customerName = profile?.full_name || "Cliente";

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

  function handleWhatsApp() {
    const text = message.trim();
    const body = `Olá ${customerName}! Sobre o seu pedido ${orderNo} no ${brand}:${
      text ? `\n\n${text}` : ""
    }`;
    const link = buildWhatsAppLink(phone, body);
    if (!link) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
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
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          className="flex-1 rounded-lg"
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
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-lg"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
        </Button>
      </div>
    </div>
  );
}
