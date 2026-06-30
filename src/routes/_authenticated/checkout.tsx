import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Loader2, MapPin, Copy, Check, QrCode } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { fetchProfile, placeOrder } from "@/lib/orders";
import { formatBRL } from "@/lib/format";
import { usePixPayment } from "@/hooks/usePixPayment";
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
  const { items, subtotal, discount, totalPrice, canCheckout, shortfalls, clear } =
    useCart();
  const [submitting, setSubmitting] = useState(false);
  const [tipo, setTipo] = useState<"Delivery" | "Presencial">("Delivery");
  const [mesa, setMesa] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [useCashback, setUseCashback] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });

  const saldoCashback = profile?.saldo_cashback ?? 0;
  const cashbackApplied = useCashback
    ? Math.min(Math.round(saldoCashback * 100), Math.round(totalPrice * 100)) /
      100
    : 0;
  const finalTotal = Math.round((totalPrice - cashbackApplied) * 100) / 100;

  const {
    payload: pixPayload,
    copied,
    copy: copyPixPayload,
    merchantName: pixMerchantName,
    merchantCity: pixMerchantCity,
  } = usePixPayment(finalTotal);



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

  async function copyPix() {
    const ok = await copyPixPayload();
    if (ok) {
      toast.success("Código copiado com sucesso!");
    } else {
      toast.error("Não foi possível copiar. Tente novamente.");
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCheckout) {
      toast.error("Revise as regras do pedido antes de finalizar.");
      return;
    }
    let mesaNumber: number | null = null;
    if (tipo === "Presencial") {
      mesaNumber = parseInt(mesa, 10);
      if (Number.isNaN(mesaNumber) || mesaNumber <= 0) {
        toast.error("Informe o número da mesa para pedidos presenciais.");
        return;
      }
    } else {
      const parsedAddr = schema.shape.address.safeParse(address);
      if (!parsedAddr.success) {
        toast.error(parsedAddr.error.issues[0].message);
        return;
      }
    }
    const parsed = schema.safeParse({
      address: tipo === "Presencial" ? "Mesa " + mesa : address,
      phone,
      notes,
    });
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
        total: finalTotal,
        discount,
        deliveryAddress: parsed.data.address,
        phone: parsed.data.phone,
        notes: parsed.data.notes ?? "",
        tipoAtendimento: tipo,
        numeroMesa: mesaNumber,
        cashbackUsed: cashbackApplied,
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
                <li key={i.lineId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    {i.quantity}× {i.name}
                    {i.addons.length > 0 && (
                      <span className="block text-[11px]">
                        {i.addons.map((a) => `+ ${a.name}`).join(", ")}
                      </span>
                    )}
                    {i.remocoes.length > 0 && (
                      <span className="block text-[11px] font-semibold text-destructive">
                        {i.remocoes.map((r) => `Sem ${r}`).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums">
                    {formatBRL(i.unitPrice * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Desconto combo</span>
                  <span className="tabular-nums">− {formatBRL(discount)}</span>
                </div>
              )}
              {cashbackApplied > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Cashback aplicado</span>
                  <span className="tabular-nums">
                    − {formatBRL(cashbackApplied)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="font-semibold">Total</span>
                <span className="font-display text-lg font-bold text-primary">
                  {formatBRL(finalTotal)}
                </span>
              </div>
            </div>

            {saldoCashback > 0 && (
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                <span className="text-sm">
                  <span className="font-semibold text-foreground">
                    Usar meu cashback
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Saldo disponível: {formatBRL(saldoCashback)}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={useCashback}
                  onChange={(e) => setUseCashback(e.target.checked)}
                  className="h-5 w-5 accent-[hsl(var(--primary))]"
                />
              </label>
            )}
          </section>


          {shortfalls.map((s) => (
            <p
              key={s.slug}
              className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              Pedido mínimo de {s.required} unidades em {s.name}. Adicione mais{" "}
              {s.missing} antes de finalizar.
            </p>
          ))}

          {/* PIX payment — BR Code (Copia e Cola) + QR Code dinâmico */}
          <section className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-bold">
                Pagamento via PIX
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Escaneie o QR Code ou use o código Copia e Cola. O valor de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(finalTotal)}
              </span>{" "}
              já vem preenchido.
            </p>

            <div className="mt-4 flex flex-col items-center">
              <div className="rounded-2xl bg-white p-3 shadow-card">
                <QRCodeCanvas
                  value={pixPayload}
                  size={196}
                  level="M"
                  marginSize={1}
                  aria-label="QR Code para pagamento PIX"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={copyPix}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Código copiado com sucesso!" : "Copiar Código PIX (Copia e Cola)"}
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Favorecido:{" "}
              <span className="font-medium text-foreground">
                {pixMerchantName}
              </span>{" "}
              • {pixMerchantCity}
            </p>
          </section>


          {/* Order form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Attendance type */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
              <button
                type="button"
                onClick={() => setTipo("Delivery")}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tipo === "Delivery"
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setTipo("Presencial")}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tipo === "Presencial"
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Presencial (mesa)
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              {tipo === "Delivery" ? "Dados da entrega" : "Dados do atendimento"}
            </div>

            {tipo === "Presencial" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mesa">Número da mesa</Label>
                <Input
                  id="mesa"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  placeholder="Ex: 7"
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  O garçom levará o pedido até a sua mesa.
                </p>
              </div>
            ) : (
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
            )}

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
              disabled={submitting || !canCheckout}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `Confirmar pedido • ${formatBRL(finalTotal)}`
              )}
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
