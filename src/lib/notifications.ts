import { supabase } from "@/integrations/supabase/client";
import type { StatusPedido } from "@/lib/caixa";

export interface NotificacaoCliente {
  id: string;
  id_pedido: string | null;
  id_usuario: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

/**
 * Automatic message for each production-conveyor status. Some statuses share
 * the same final message ("Entregue" and "Encerrado e pago").
 */
export const STATUS_NOTIFICATION_MESSAGES: Record<
  StatusPedido,
  { titulo: string; mensagem: string } | null
> = {
  Recebido: {
    titulo: "Pedido recebido",
    mensagem: "Seu pedido foi recebido pelo Clube 23 e já está na nossa fila!",
  },
  "Em preparação": {
    titulo: "Em preparação",
    mensagem:
      "Boas notícias! Seu pedido já está sendo preparado pela nossa cozinha.",
  },
  "Aguardando entregador": {
    titulo: "Pronto para sair",
    mensagem:
      "Seu pedido está pronto e embalado, aguardando a chegada do motoboy.",
  },
  "Em entrega": {
    titulo: "Saiu para entrega",
    mensagem: "Seu pedido saiu! O entregador já está a caminho do seu endereço.",
  },
  Entregue: {
    titulo: "Pedido finalizado",
    mensagem:
      "Pedido finalizado. Muito obrigado por escolher o Clube 23! Bom apetite!",
  },
  "Encerrado e pago": {
    titulo: "Pedido finalizado",
    mensagem:
      "Pedido finalizado. Muito obrigado por escolher o Clube 23! Bom apetite!",
  },
  Cancelado: null,
};

/* ------------------------------------------------------------------ */
/* Browser push permission                                             */
/* ------------------------------------------------------------------ */

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Requests browser notification permission and, if granted, stores a token
 * marker on the user's profile so the operator knows the device opted in.
 * Real-time delivery is handled by the realtime subscription on
 * `notificacoes_cliente`; this enables OS-level banners while the PWA is open.
 */
export async function enableWebPush(userId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  // Try to build a real Web Push subscription endpoint when a service worker
  // and PushManager are available; otherwise fall back to a consent marker.
  let token = `granted:${Date.now()}`;
  try {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) token = JSON.stringify(sub.toJSON());
    }
  } catch {
    /* ignore – keep consent marker */
  }

  const { error } = await supabase
    .from("profiles")
    .update({ push_token: token })
    .eq("id", userId);
  if (error) throw error;
  return true;
}

/** Shows an OS-level notification banner (best effort). */
export function showLocalNotification(titulo: string, mensagem: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(titulo, {
      body: mensagem,
      icon: "/logo.png",
      badge: "/logo.png",
    });
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Data layer                                                          */
/* ------------------------------------------------------------------ */

/** Operator action: persist a notification for a client. */
export async function insertNotification(input: {
  idPedido: string | null;
  idUsuario: string;
  titulo: string;
  mensagem: string;
}): Promise<void> {
  const { error } = await supabase.from("notificacoes_cliente").insert({
    id_pedido: input.idPedido,
    id_usuario: input.idUsuario,
    titulo: input.titulo,
    mensagem: input.mensagem,
  });
  if (error) throw error;
}

/** Fires the automatic status notification for an order (if the status maps). */
export async function notifyStatusChange(
  orderId: string,
  userId: string,
  status: StatusPedido,
): Promise<void> {
  const msg = STATUS_NOTIFICATION_MESSAGES[status];
  if (!msg || !userId) return;
  await insertNotification({
    idPedido: orderId,
    idUsuario: userId,
    titulo: msg.titulo,
    mensagem: msg.mensagem,
  });
}

/** Client: list own notifications, newest first. */
export async function fetchMyNotifications(): Promise<NotificacaoCliente[]> {
  const { data, error } = await supabase
    .from("notificacoes_cliente")
    .select("id, id_pedido, id_usuario, titulo, mensagem, lida, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificacaoCliente[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notificacoes_cliente")
    .update({ lida: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notificacoes_cliente")
    .update({ lida: true })
    .eq("id_usuario", userId)
    .eq("lida", false);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

/** Builds a wa.me deep link with a pre-filled formatted message. */
export function buildWhatsAppLink(
  phone: string,
  message: string,
): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  // Default to Brazil country code when a local number is provided.
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}
