import { createFileRoute, Link } from "@tanstack/react-router";
import { UtensilsCrossed, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import heroImg from "/images/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sabor Express — Delivery de Comida Variada" },
      {
        name: "description",
        content:
          "Peça pratos, lanches, sobremesas e bebidas com entrega rápida no Sabor Express. Cardápio variado e pedido em poucos toques.",
      },
      { property: "og:title", content: "Sabor Express — Delivery de Comida" },
      {
        property: "og:description",
        content: "Cardápio variado com entrega rápida. Peça em poucos toques.",
      },
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Hero */}
        <div className="relative h-[58vh] min-h-[380px] w-full overflow-hidden">
          <img
            src={heroImg}
            alt="Mesa repleta de pratos, lanches, sobremesas e bebidas"
            width={1280}
            height={1024}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute left-5 top-6 flex items-center gap-2 text-primary-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Sabor Express
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white">
              Sua comida favorita,
              <br />
              <span className="text-accent">entregue rapidinho.</span>
            </h1>
            <p className="mt-3 max-w-xs text-sm text-white/85">
              Pratos, lanches, sobremesas e bebidas em um só lugar. Monte seu
              pedido em poucos toques.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="grid grid-cols-3 gap-3">
            <Feature icon={<Clock className="h-5 w-5" />} label="Entrega rápida" />
            <Feature
              icon={<UtensilsCrossed className="h-5 w-5" />}
              label="Cardápio variado"
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Pedido seguro"
            />
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <Link
              to="/menu"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-float transition-transform active:scale-[0.98]"
            >
              Ver cardápio
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Entrar ou criar conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center shadow-card">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
        {icon}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
