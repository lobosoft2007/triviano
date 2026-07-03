import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/history";

/**
 * Native-app back-button behaviour for modals / sheets.
 *
 * When an overlay opens we push ONE synthetic history entry through the
 * router's own history (raw window.history calls get reverted by TanStack
 * Router). The entry only adds a `#m…` hash, so the router keeps the same
 * route while a distinct back-target exists. A hardware/browser back button
 * (or Android/iOS back gesture) emits a BACK action which we consume to close
 * the top-most overlay instead of leaving the PWA.
 *
 * Nested overlays each push an entry (LIFO). Closing through our own UI (top
 * "Voltar" button, overlay click, Esc, save) pops the synthetic entry via
 * history.back() to keep the stack balanced; that programmatic back is flagged
 * so it never double-closes the next overlay.
 */

interface ModalEntry {
  id: string;
  close: () => void;
}

const stack: ModalEntry[] = [];
let unsubscribe: (() => void) | null = null;
let ignoreCount = 0;

function ensureSubscription(history: RouterHistory) {
  if (unsubscribe) return;
  unsubscribe = history.subscribe(({ action }) => {
    if (action.type !== "BACK") return;
    if (ignoreCount > 0) {
      ignoreCount -= 1;
      return;
    }
    const top = stack.pop();
    if (top) top.close();
  });
}

function openModal(history: RouterHistory, entry: ModalEntry) {
  ensureSubscription(history);
  if (stack.some((e) => e.id === entry.id)) return;
  stack.push(entry);
  const loc = history.location;
  history.push(`${loc.pathname}${loc.search}#m-${entry.id}`);
}

function closeModal(history: RouterHistory, id: string) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return; // already popped by a BACK action (hardware back)
  stack.splice(idx, 1);
  ignoreCount += 1;
  history.back();
}

let counter = 0;

/**
 * Wire an overlay's open state to the hardware back button.
 * @param open    whether the overlay is currently open
 * @param onClose callback that closes the overlay (e.g. setOpen(false))
 */
export function useModalHistoryGuard(open: boolean, onClose: () => void) {
  const router = useRouter();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const idRef = useRef<string>("");
  if (!idRef.current) idRef.current = `${++counter}`;

  useEffect(() => {
    if (!open) return;
    const history = router.history;
    const id = idRef.current;
    openModal(history, { id, close: () => onCloseRef.current() });
    return () => closeModal(history, id);
  }, [open, router]);
}
