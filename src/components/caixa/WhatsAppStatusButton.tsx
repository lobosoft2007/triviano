import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildWhatsAppLink,
  statusWhatsAppMessage,
} from "@/lib/notifications";
import { empresaQueryOptions } from "@/lib/empresa";
import type { CaixaOrder } from "@/lib/caixa";

/**
 * Infalible fallback channel: a prominent "Avisar Cliente via WhatsApp" button
 * that opens the WhatsApp API with the customer's number pre-filled and a
 * message perfectly formatted for the order's CURRENT status.
 */
export function WhatsAppStatusButton({ order }: { order: CaixaOrder }) {
  const { data: empresa } = useQuery(empresaQueryOptions);
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

  function handleClick() {
    const orderNo = `#${order.id.slice(0, 6).toUpperCase()}`;
    const name = profile?.full_name || "Cliente";
    const phone = profile?.phone || order.phone || "";
    const message = statusWhatsAppMessage(order.status_pedido, name, orderNo);
    const link = buildWhatsAppLink(phone, message);
    if (!link) {
      toast.error("Cliente sem telefone cadastrado para o WhatsApp.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={handleClick}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
    >
      <MessageCircle className="h-4 w-4" />
      Avisar Cliente via WhatsApp
    </button>
  );
}
