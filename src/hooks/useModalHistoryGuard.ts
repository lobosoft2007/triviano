import { useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

/**
 * Native-app back-button behaviour for modals / sheets.
 *
 * When an overlay is open and the user triggers the hardware/browser back
 * button (or the Android/iOS back gesture), we intercept the navigation and
 * simply close the overlay instead of ejecting the user out of the PWA.
 *
 * This is built on TanStack Router's `useBlocker`, which cooperates with the
 * router's own History management (raw `window.history` calls would desync the
 * router and cause phantom navigations). When the overlay is open we block the
 * navigation and run the close handler; once closed, the block is lifted so a
 * subsequent back press navigates normally.
 *
 * Closing through our own UI (top "Voltar" button, overlay click, Esc, save)
 * needs no special handling — no synthetic entry was pushed, so the history
 * stack stays balanced automatically.
 *
 * @param open    whether the overlay is currently open
 * @param onClose callback that closes the overlay (e.g. setOpen(false))
 */
export function useModalHistoryGuard(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useBlocker({
    disabled: !open,
    enableBeforeUnload: false,
    shouldBlockFn: () => {
      if (!open) return false;
      // Back gesture while open: close the overlay and cancel the navigation.
      onCloseRef.current();
      return true;
    },
  });
}
