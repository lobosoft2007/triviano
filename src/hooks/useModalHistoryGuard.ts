import { useEffect, useRef } from "react";

/**
 * Native-app back-button behaviour for modals / sheets.
 *
 * When a modal opens we push a synthetic history entry (`#modal`). If the user
 * hits the hardware/browser back button (or the Android/iOS back gesture) the
 * `popstate` fires, we swallow it and close the modal instead of ejecting the
 * user out of the PWA.
 *
 * When the modal is closed through our own UI (the top "Voltar" button, the
 * overlay, Esc, save, etc.) we call `history.back()` to pop the synthetic entry
 * we pushed, keeping the history stack perfectly balanced.
 */
export function useModalHistoryGuard(open: boolean, onClose: () => void) {
  // Keep a stable reference to the latest close handler.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Tracks whether *we* pushed the synthetic entry (so we know to pop it).
  const pushedRef = useRef(false);
  // Guards against re-entrancy while we programmatically pop the entry.
  const closingViaPopRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (open) {
      // Push a synthetic state the back gesture can consume.
      console.log("[modalguard] open -> pushState", window.history.length);
      window.history.pushState({ __modal: true }, "", window.location.href);
      pushedRef.current = true;
      closingViaPopRef.current = false;

      const handlePopState = () => {
        console.log("[modalguard] popstate -> close");
        // The synthetic entry was just consumed by the back action; it no
        // longer exists in the stack, so we must not pop it again on cleanup.
        pushedRef.current = false;
        closingViaPopRef.current = true;
        onCloseRef.current();
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        // Modal closed via UI (not the back button): pop our synthetic entry
        // to keep the navigation stack clean.
        if (pushedRef.current && !closingViaPopRef.current) {
          pushedRef.current = false;
          window.history.back();
        }
      };
    }

    return undefined;
  }, [open]);
}
