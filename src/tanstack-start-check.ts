import "@tanstack/start-client-core";
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/x")({ server: { handlers: { GET: async ({ request }) => new Response(request.url) } } });
