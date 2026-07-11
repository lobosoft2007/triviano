import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { empresaQueryOptions } from "@/lib/empresa";
import {
  fetchMyNotifications,
  markNotificationsRead,
  showLocalNotification,
  type NotificacaoCliente,
} from "@/lib/notifications";

/**
 * Loads the signed-in client's notifications and keeps them in sync in
 * real time. Aplica o Protocolo de Higiene Visual:
 *  - Filtro por tenant (empresa do host atual);
 *  - Auto-arquivamento de 24h (tratado no fetch);
 *  - Reset do contador ao abrir o sino (markAllRead).
 * When a new notification arrives it surfaces an OS-level banner (if permission
 * was granted) and refreshes the list / unread badge.
 */
export function useClientNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const empresaId = empresa?.id;

  const query = useQuery({
    queryKey: ["my-notifications", user?.id, empresaId],
    enabled: !!user?.id,
    queryFn: () => fetchMyNotifications(empresaId),
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

  /**
   * Reset do contador ao abrir o sino: marca como lidas apenas as notificações
   * atualmente exibidas (já filtradas por tenant e janela de 24h).
   */
  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.lida).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markNotificationsRead(unreadIds);
    queryClient.invalidateQueries({
      queryKey: ["my-notifications", user?.id, empresaId],
    });
  }

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markAllRead,
  };
}
