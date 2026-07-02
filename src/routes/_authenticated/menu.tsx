import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MenuRedirect,
});

function MenuRedirect() {
  return <Navigate to="/" replace />;
}
