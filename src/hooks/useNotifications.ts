import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchMyNotifications,
  showLocalNotification,
  type NotificacaoCliente,
} from "@/lib/notifications";

/**
 * Loads the signed-in client's notifications and keeps them in sync in
 * real time. When a new notification arrives it surfaces an OS-level banner
 * (if permission was granted) and refreshes the list / unread badge.
 */
export function useClientNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: !!user?.id,
    queryFn: fetchMyNotifications,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes_cliente",
          filter: `id_usuario=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as NotificacaoCliente;
          showLocalNotification(n.titulo, n.mensagem);
          queryClient.invalidateQueries({
            queryKey: ["my-notifications", user.id],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificacoes_cliente",
          filter: `id_usuario=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["my-notifications", user.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.lida).length;

  return { notifications, unreadCount, isLoading: query.isLoading };
}
