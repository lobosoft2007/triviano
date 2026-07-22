import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  getHiddenIds,
  hideNotification,
  hideNotifications,
} from "@/lib/hiddenNotifications";

/**
 * Loads the signed-in client's notifications and keeps them in sync in
 * real time. Aplica o Protocolo de Higiene Visual:
 *  - Filtro por tenant (empresa do host atual);
 *  - Auto-arquivamento de 24h (tratado no fetch);
 *  - Reset do contador ao abrir o sino (markAllRead);
 *  - Ocultar notificações localmente (per-device) sem apagar do banco.
 */
export function useClientNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const empresaId = empresa?.id;

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => getHiddenIds(user?.id),
  );

  // Se o usuário mudar (login/logout), recarrega os IDs ocultos daquele usuário.
  useEffect(() => {
    setHiddenIds(getHiddenIds(user?.id));
  }, [user?.id]);

  const query = useQuery({
    queryKey: ["my-notifications", user?.id, empresaId],
    enabled: !!user?.id,
    queryFn: () => fetchMyNotifications(empresaId, user?.id),
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

  const notifications = useMemo(
    () => (query.data ?? []).filter((n) => !hiddenIds.has(n.id)),
    [query.data, hiddenIds],
  );
  const unreadCount = notifications.filter((n) => !n.lida).length;

  /**
   * Reset do contador ao abrir o sino: marca como lidas apenas as notificações
   * atualmente exibidas (já filtradas por tenant, janela de 24h e ocultas).
   */
  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.lida).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markNotificationsRead(unreadIds);
    queryClient.invalidateQueries({
      queryKey: ["my-notifications", user?.id, empresaId],
    });
  }

  const hideOne = useCallback(
    (id: string) => {
      hideNotification(user?.id, id);
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [user?.id],
  );

  const hideAll = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    hideNotifications(user?.id, ids);
    setHiddenIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, [notifications, user?.id]);

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markAllRead,
    hideOne,
    hideAll,
  };
}
