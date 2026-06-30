import { useEffect, useState } from "react";
import { Bell, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  enableWebPush,
  pushPermission,
  pushDeniedInstructions,
} from "@/lib/notifications";

const DISMISS_KEY = "push-banner-dismissed";

/**
 * Subtle banner asking the client to allow order-status notifications.
 * - "default": offers an "Ativar" button to request permission.
 * - "denied": shows friendly instructions to unblock the site in the browser.
 * Either way, the in-app bell (realtime) keeps working as the fallback channel.
 */
export function PushPermissionBanner() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const current = pushPermission();
    setPerm(current);
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    // Show for "default" (can ask) or "denied" (needs unblock instructions).
    setVisible(
      (current === "default" || current === "denied") && !dismissed,
    );
  }, [user?.id]);

  if (!visible) return null;

  const denied = perm === "denied";

  async function handleEnable() {
    if (!user?.id) return;
    setBusy(true);
    try {
      const result = await enableWebPush(user.id);
      if (result === "granted") {
        toast.success("Notificações ativadas! Avisaremos sobre seu pedido.");
        setVisible(false);
      } else if (result === "denied") {
        setPerm("denied");
        toast.error(pushDeniedInstructions(), { duration: 9000 });
      } else if (result === "unsupported") {
        toast.error(
          "Este navegador não suporta notificações. Você ainda receberá os avisos pelo sininho do app.",
          { duration: 8000 },
        );
        setVisible(false);
      } else {
        toast("Você pode ativar as notificações a qualquer momento.");
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
    <div
      className={`mx-5 mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        denied
          ? "border-destructive/30 bg-destructive/10"
          : "border-primary/30 bg-primary/10"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          denied
            ? "bg-destructive/20 text-destructive"
            : "bg-primary/20 text-primary"
        }`}
      >
        {denied ? (
          <AlertTriangle className="h-4.5 w-4.5" />
        ) : (
          <Bell className="h-4.5 w-4.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {denied ? "Notificações bloqueadas" : "Acompanhe seu pedido"}
        </p>
        <p className="text-xs text-muted-foreground">
          {denied
            ? pushDeniedInstructions()
            : "Ative as notificações para saber quando seu pedido sair."}
        </p>
      </div>
      {!denied && (
        <button
          onClick={handleEnable}
          disabled={busy}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "..." : "Ativar"}
        </button>
      )}
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
