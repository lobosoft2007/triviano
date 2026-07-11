import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { useClientNotifications } from "@/hooks/useNotifications";
import { markNotificationRead } from "@/lib/notifications";
import { useQueryClient } from "@tanstack/react-query";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { notifications, unreadCount, isLoading } = useClientNotifications();
  const [open, setOpen] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["my-notifications", user?.id] });

  async function handleMarkAll() {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    refresh();
  }

  async function handleClick(id: string, lida: boolean) {
    if (lida) return;
    await markNotificationRead(id);
    refresh();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Bell
            className={`h-5 w-5 ${unreadCount > 0 ? "animate-pulse text-primary" : ""}`}
          />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold">Notificações</p>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Check className="h-3.5 w-3.5" /> Marcar todas
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma notificação ainda.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n.id, n.lida)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                      n.lida ? "" : "bg-primary/5"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {!n.lida && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        {n.titulo}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {n.mensagem}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
