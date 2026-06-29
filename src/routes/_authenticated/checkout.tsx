import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { fetchProfile, placeOrder } from "@/lib/orders";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

const schema = z.object({
  address: z.string().trim().min(5, { message: "Informe o endereço de entrega" }).max(300),
  phone: z.string().trim().min(8, { message: "Informe um telefone válido" }).max(20),
  notes: z.string().trim().max(300).optional(),
});

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { items, totalPrice, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setAddress((a) => a || profile.address);
      setPhone((p) => p || profile.phone);
    }
  }, [profile]);

  useEffect(() => {
    if (items.length === 0 && !submitting) {
      navigate({ to: "/menu", replace: true });
    }
  }, [items.length, submitting, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ address, phone, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      await placeOrder({
        userId: user.id,
        items,
        total: totalPrice,
        deliveryAddress: parsed.data.address,
        phone: parsed.data.phone,
        notes: parsed.data.notes ?? "",
      });
      clear();
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido realizado com sucesso!");
      navigate({ to: "/orders", replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível finalizar o pedido. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-5 py-3.5 backdrop-blur-md">
          <Link
            to="/menu"
            aria-label="Voltar ao cardápio"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Finalizar pedido</h1>
        </header>

        <main className="px-5 py-5">
          {/* Order summary */}
          <section className="mb-5 rounded-2xl bg-card p-4 shadow-card">
            <h2 className="mb-3 font-display text-base font-bold">
              Resumo do pedido
            </h2>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {i.quantity}× {i.name}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatBRL(i.price * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-display text-lg font-bold text-primary">
                {formatBRL(totalPrice)}
              </span>
            </div>
          </section>

          {/* Delivery form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Dados da entrega
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Endereço de entrega</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, complemento"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: sem cebola, troco para R$ 50..."
                className="min-h-20 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-2 h-13 rounded-2xl py-3.5 text-base"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `Confirmar pedido • ${formatBRL(totalPrice)}`
              )}
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
