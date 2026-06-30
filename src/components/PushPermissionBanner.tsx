import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { enableWebPush, pushPermission } from "@/lib/notifications";

const DISMISS_KEY = "push-banner-dismissed";

/**
 * Subtle banner asking the client to allow order-status notifications.
 * Hidden once permission is decided or the user dismisses it.
 */
export function PushPermissionBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const perm = pushPermission();
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    setVisible(perm === "default" && !dismissed);
  }, [user?.id]);

  if (!visible) return null;

  async function handleEnable() {
    if (!user?.id) return;
    setBusy(true);
    try {
      const ok = await enableWebPush(user.id);
      if (ok) {
        toast.success("Notificações ativadas! Avisaremos sobre seu pedido.");
        setVisible(false);
      } else {
        toast.error("Permissão de notificação negada pelo navegador.");
        setVisible(false);
      }
    } catch {
      toast.error("Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="mx-5 mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Bell className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          Acompanhe seu pedido
        </p>
        <p className="text-xs text-muted-foreground">
          Ative as notificações para saber quando seu pedido sair.
        </p>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "..." : "Ativar"}
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dispensar"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
