import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-screen layout primitives that standardize the "Balcão" engineering
 * across every operational module (Caixa, Admin) and the client PWA.
 *
 * Rules enforced by these components:
 * - The page is locked to the physical viewport: `h-[100dvh] overflow-hidden`.
 *   `100dvh` respects the mobile browser chrome (address bar / home indicator).
 * - Only `ShellBody` scrolls. Header (search/filters) and footer (action
 *   buttons / totals) stay frozen and visible.
 * - Every flex ancestor of a scroll area carries `min-h-0` so the inner
 *   `overflow-y-auto` can actually shrink and scroll.
 * - `overscroll-contain` kills the elastic "website bounce" on mobile.
 */

const AppShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-[100dvh] w-full flex-col overflow-hidden overscroll-none bg-background text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
AppShell.displayName = "AppShell";

const ShellHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("shrink-0", className)}
      {...props}
    />
  ),
);
ShellHeader.displayName = "ShellHeader";

const ShellBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        className,
      )}
      {...props}
    />
  ),
);
ShellBody.displayName = "ShellBody";

const ShellFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("shrink-0", className)}
      {...props}
    />
  ),
);
ShellFooter.displayName = "ShellFooter";

export { AppShell, ShellHeader, ShellBody, ShellFooter };
