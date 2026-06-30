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

/** Result of trying to enable web push, used to drive friendly UI copy. */
export type PushEnableResult =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

/**
 * Friendly, OS-aware instructions shown when the browser has blocked
 * notifications ('denied'). The user must clear the site permission manually —
 * browsers do not allow re-prompting once blocked.
 */
export function pushDeniedInstructions(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  if (isSafari) {
    return "As notificações estão bloqueadas. No Safari, vá em Ajustes \u2192 Safari \u2192 Sites \u2192 Notificações e permita este site, depois recarregue a página.";
  }
  return "As notificações estão bloqueadas. No Chrome, toque no cadeado ao lado do endereço \u2192 Permissões \u2192 Notificações \u2192 Permitir e recarregue a página.";
}

/**
 * Requests browser notification permission and, if granted, stores a token
 * marker on the user's profile so the operator knows the device opted in.
 *
 * Web Push (VAPID) for background delivery is NOT configured in homologation,
 * so real-time delivery is handled by the Supabase realtime subscription on
 * `notificacoes_cliente` (the in-app "Sininho"). This call only enables
 * OS-level banners while the PWA is open and records the consent marker.
 */
export async function enableWebPush(userId: string): Promise<PushEnableResult> {
  if (!pushSupported()) return "unsupported";
  let permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "default";

  // Try to build a real Web Push subscription endpoint when a service worker,
  // PushManager and a VAPID public key are all available; otherwise fall back
  // to a local consent marker. The in-app bell (realtime) is the homologation
  // fallback channel regardless.
  let token = `granted:${Date.now()}`;
  try {
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (vapid && "serviceWorker" in navigator && "PushManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        }));
      if (sub) token = JSON.stringify(sub.toJSON());
    }
  } catch {
    /* ignore – keep consent marker, realtime bell still works */
  }

  const { error } = await supabase
    .from("profiles")
    .update({ push_token: token })
    .eq("id", userId);
  if (error) throw error;
  return "granted";
}

/** Converts a base64url VAPID public key into the Uint8Array the API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
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

/**
 * Status-aware WhatsApp message, perfectly formatted for the operator to send
 * as the infalible fallback channel when the browser push fails.
 */
export function statusWhatsAppMessage(
  status: StatusPedido,
  name: string,
  orderNo: string,
): string {
  const cliente = name?.trim() || "Cliente";
  switch (status) {
    case "Recebido":
      return `Olá ${cliente}! Recebemos o seu pedido nº ${orderNo} aqui no Clube 23 e já está na nossa fila. Em breve começamos o preparo! 🍔`;
    case "Em preparação":
      return `Olá ${cliente}! Boas notícias: o seu pedido nº ${orderNo} do Clube 23 já está sendo preparado pela nossa cozinha. 👨‍🍳`;
    case "Aguardando entregador":
      return `Olá ${cliente}! O seu pedido nº ${orderNo} do Clube 23 está pronto e embalado, aguardando o nosso motoboy. 📦`;
    case "Em entrega":
      return `Olá ${cliente}! Seu pedido nº ${orderNo} do Clube 23 acabou de sair para entrega com o nosso motoboy! 🛵`;
    case "Entregue":
    case "Encerrado e pago":
      return `Olá ${cliente}! Seu pedido nº ${orderNo} do Clube 23 foi finalizado. Muito obrigado pela preferência e bom apetite! 🙏`;
    case "Cancelado":
      return `Olá ${cliente}! Sobre o seu pedido nº ${orderNo} do Clube 23, precisamos falar com você. Pode nos responder por aqui? 🙏`;
    default:
      return `Olá ${cliente}! Atualização sobre o seu pedido nº ${orderNo} do Clube 23.`;
  }
}
