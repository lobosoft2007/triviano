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
 * Short, human-friendly order label used across every customer channel
 * (bell, OS push, WhatsApp, kitchen coupon). Mirrors the format already used
 * in WhatsAppStatusButton so the customer sees the same tag everywhere.
 */
export function formatOrderLabel(orderId: string): string {
  return `#${orderId.slice(0, 6).toUpperCase()}`;
}

/**
 * Automatic message for each production-conveyor status. Each entry receives
 * the order label so clients with multiple simultaneous orders can tell which
 * one just changed status.
 */
export function buildStatusNotification(
  status: StatusPedido,
  orderLabel: string,
): { titulo: string; mensagem: string } | null {
  switch (status) {
    case "Recebido":
      return {
        titulo: `Pedido ${orderLabel} recebido`,
        mensagem: `Recebemos o seu pedido ${orderLabel} e ele já está na nossa fila!`,
      };
    case "Em preparação":
      return {
        titulo: `Pedido ${orderLabel} em preparação`,
        mensagem: `Boas notícias! Seu pedido ${orderLabel} já está sendo preparado pela nossa cozinha.`,
      };
    case "Aguardando entregador":
      return {
        titulo: `Pedido ${orderLabel} pronto para sair`,
        mensagem: `Seu pedido ${orderLabel} está pronto e embalado, aguardando a chegada do motoboy.`,
      };
    case "Em entrega":
      return {
        titulo: `Pedido ${orderLabel} saiu para entrega`,
        mensagem: `Seu pedido ${orderLabel} saiu! O entregador já está a caminho do seu endereço.`,
      };
    case "Entregue":
    case "Finalizado":
      return {
        titulo: `Pedido ${orderLabel} finalizado`,
        mensagem: `Pedido ${orderLabel} finalizado. Muito obrigado pela preferência! Bom apetite!`,
      };
    case "Cancelado":
      return null;
    default:
      return null;
  }
}

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
  const msg = buildStatusNotification(status, formatOrderLabel(orderId));
  if (!msg || !userId) return;
  await insertNotification({
    idPedido: orderId,
    idUsuario: userId,
    titulo: msg.titulo,
    mensagem: msg.mensagem,
  });
}

/**
 * Order cancellation notification, carrying the dynamic brand (nome_fantasia).
 * Persists the realtime bell alert and fires a native OS push banner when the
 * customer's device has granted permission.
 */
export async function notifyOrderCanceled(
  orderId: string,
  userId: string,
  brand = "",
): Promise<void> {
  if (!userId) return;
  const b = brand?.trim() || "Estabelecimento";
  const label = formatOrderLabel(orderId);
  const titulo = `Pedido ${label} cancelado`;
  const mensagem = `${b}: Seu pedido ${label} foi cancelado pelo estabelecimento.`;
  await insertNotification({
    idPedido: orderId,
    idUsuario: userId,
    titulo,
    mensagem,
  });
  showLocalNotification(titulo, mensagem);
}

/** Janela de exibição das notificações na interface (auto-arquivamento). */
export const NOTIFICATION_VISIBLE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Client: list own notifications, newest first.
 *
 * Higiene visual SOTA:
 *  - Filtro por tenant: quando `empresaId` é informado, retorna apenas
 *    notificações de pedidos da empresa do host atual (join `orders!inner`),
 *    evitando misturar avisos de tenants diferentes (Clube 23 x Pizzaria Teste).
 *  - Auto-arquivamento: só exibe notificações das últimas 24h. As mais antigas
 *    permanecem no banco (log), apenas ocultas da interface.
 */
export async function fetchMyNotifications(
  empresaId?: string,
  userId?: string,
): Promise<NotificacaoCliente[]> {
  const cutoff = new Date(
    Date.now() - NOTIFICATION_VISIBLE_WINDOW_MS,
  ).toISOString();

  const baseSelect =
    "id, id_pedido, id_usuario, titulo, mensagem, lida, created_at";

  let query = empresaId
    ? supabase
        .from("notificacoes_cliente")
        .select(`${baseSelect}, orders!inner(empresa_id)`)
        .eq("orders.empresa_id", empresaId)
    : supabase.from("notificacoes_cliente").select(baseSelect);

  // Defesa em profundidade: filtra explicitamente pelo dono da notificação
  // para que admins não recebam avisos de outros clientes via bell.
  if (userId) {
    query = query.eq("id_usuario", userId) as typeof query;
  }

  query = query
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50) as typeof query;

  const { data, error } = await query;
  if (error) throw error;

  // Descarta o campo `orders` do join, mantendo apenas o shape da notificação.
  return ((data ?? []) as unknown[]).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: row.id as string,
      id_pedido: (row.id_pedido as string | null) ?? null,
      id_usuario: row.id_usuario as string,
      titulo: row.titulo as string,
      mensagem: row.mensagem as string,
      lida: row.lida as boolean,
      created_at: row.created_at as string,
    };
  });
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

/** Marca como lidas as notificações específicas por id (ex.: ao abrir a lista). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notificacoes_cliente")
    .update({ lida: true })
    .in("id", ids)
    .eq("lida", false);
  if (error) throw error;
}

/**
 * Ação de leitura automática: ao visualizar pedidos em "Meus Pedidos", marca
 * como lidas as notificações vinculadas a esses pedidos do usuário logado.
 */
export async function markOrderNotificationsRead(
  userId: string,
  orderIds: string[],
): Promise<void> {
  if (!userId || orderIds.length === 0) return;
  const { error } = await supabase
    .from("notificacoes_cliente")
    .update({ lida: true })
    .eq("id_usuario", userId)
    .eq("lida", false)
    .in("id_pedido", orderIds);
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
  brand = "",
): string {
  const cliente = name?.trim() || "Cliente";
  const at = brand ? ` no ${brand}` : "";
  const of = brand ? ` do ${brand}` : "";
  switch (status) {
    case "Recebido":
      return `Olá ${cliente}! Recebemos o seu pedido nº ${orderNo}${at} e já está na nossa fila. Em breve começamos o preparo! 🍔`;
    case "Em preparação":
      return `Olá ${cliente}! Boas notícias: o seu pedido nº ${orderNo}${of} já está sendo preparado pela nossa cozinha. 👨‍🍳`;
    case "Aguardando entregador":
      return `Olá ${cliente}! O seu pedido nº ${orderNo}${of} está pronto e embalado, aguardando o nosso motoboy. 📦`;
    case "Em entrega":
      return `Olá ${cliente}! Seu pedido nº ${orderNo}${of} acabou de sair para entrega com o nosso motoboy! 🛵`;
    case "Entregue":
    case "Finalizado":
      return `Olá ${cliente}! Seu pedido nº ${orderNo}${of} foi finalizado. Muito obrigado pela preferência e bom apetite! 🙏`;
    case "Cancelado":
      return `Olá ${cliente}! Sobre o seu pedido nº ${orderNo}${of}, precisamos falar com você. Pode nos responder por aqui? 🙏`;
    default:
      return `Olá ${cliente}! Atualização sobre o seu pedido nº ${orderNo}${of}.`;
  }
}
