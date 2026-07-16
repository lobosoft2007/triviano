// Ensures TanStack Start's `server` augmentation on FilebaseRouteOptionsInterface
// (defined in @tanstack/start-client-core/serverRoute) is loaded project-wide,
// so createFileRoute({ server: { handlers: ... } }) type-checks in every route file.
import "@tanstack/start-client-core";
export {};
