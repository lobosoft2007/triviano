import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ScanBarcode,
  Banknote,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import {
  fetchBalcaoProducts,
  fetchOrderTotal,
  type BalcaoProduct,
} from "@/lib/balcao";
import { placeOrder } from "@/lib/orders";
import {
  addPagamento,
  finalizeOrderPaid,
  fetchMeiosPagamento,
} from "@/lib/caixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BalcaoLine {
  product: BalcaoProduct;
  quantity: number;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function BalcaoView() {
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<BalcaoLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["balcao-products"],
    queryFn: fetchBalcaoProducts,
    staleTime: 1000 * 60 * 2,
  });

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
    [lines],
  );
  const totalUnits = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  );

  const focusSearch = useCallback(() => {
    // Defer so the field re-focuses after any dialog close / re-render.
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const addProduct = useCallback(
    (p: BalcaoProduct) => {
      if (p.esgotado) {
        toast.error(`"${p.name}" está esgotado.`);
        return;
      }
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.product.id === p.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [...prev, { product: p, quantity: 1 }];
      });
    },
    [],
  );

  const changeQty = useCallback((id: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.product.id === id
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  // Grid filtered by the search box (name match).
  const filtered = useMemo(() => {
    const q = norm(search);
    const list = products ?? [];
    if (!q) return list;
    return list.filter(
      (p) => norm(p.name).includes(q) || p.ean.includes(search.trim()),
    );
  }, [products, search]);

  /** Resolve a scanned/typed term to a single product and add it. */
  const resolveAndAdd = useCallback(() => {
    const raw = search.trim();
    if (!raw) return false;
    const list = products ?? [];
    // 1) Exact EAN (barcode reader).
    let hit = list.find((p) => p.ean && p.ean === raw);
    // 2) Exact name.
    if (!hit) hit = list.find((p) => norm(p.name) === norm(raw));
    // 3) Single fuzzy match.
    if (!hit) {
      const matches = list.filter((p) => norm(p.name).includes(norm(raw)));
      if (matches.length === 1) hit = matches[0];
    }
    if (hit) {
      addProduct(hit);
      setSearch("");
      focusSearch();
      return true;
    }
    toast.error(`Nenhum produto encontrado para "${raw}".`);
    return false;
  }, [search, products, addProduct, focusSearch]);

  const openPayment = useCallback(() => {
    if (lines.length === 0) {
      toast.error("Adicione itens antes de finalizar.");
      focusSearch();
      return;
    }
    setPayOpen(true);
  }, [lines.length, focusSearch]);

  // Global keyboard shortcuts: F12 finalizes, Enter on empty search finalizes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (payOpen) return;
      if (e.key === "F12") {
        e.preventDefault();
        openPayment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPayment, payOpen]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (search.trim() === "") {
        openPayment();
      } else {
        resolveAndAdd();
      }
    } else if (e.key === "Escape") {
      setSearch("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* ---------------- LEFT: search + quick grid ---------------- */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-3 shadow-card">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ScanBarcode className="h-4 w-4" /> Bipar código de barras ou digitar
            produto
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Escaneie ou digite e pressione Enter…"
              className="h-14 rounded-xl pl-11 text-lg font-medium"
              aria-label="Buscar produto por nome ou código de barras"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Enter adiciona o item · Enter no campo vazio (ou{" "}
            <kbd className="rounded bg-secondary px-1 font-semibold">F12</kbd>)
            abre o pagamento
          </p>
        </div>

        <div className="rounded-2xl bg-card p-3 shadow-card">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  disabled={p.esgotado}
                  className={`flex h-24 flex-col justify-between rounded-xl border border-border p-2.5 text-left transition-colors ${
                    p.esgotado
                      ? "cursor-not-allowed opacity-50"
                      : "hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">
                    {p.name}
                  </span>
                  <span className="flex items-end justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {p.esgotado ? "Esgotado" : p.categoryName}
                    </span>
                    <span className="font-display text-sm font-bold text-primary">
                      {formatBRL(p.price)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- RIGHT: cupom summary ---------------- */}
      <div className="flex h-fit flex-col rounded-2xl bg-card shadow-card lg:sticky lg:top-4">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> Cupom
            {totalUnits > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {totalUnits}
              </span>
            )}
          </h3>
          {lines.length > 0 && (
            <button
              onClick={clearCart}
              className="flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>

        <div className="max-h-[52vh] min-h-[120px] flex-1 overflow-y-auto p-3">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <ScanBarcode className="h-8 w-8 opacity-40" />
              Bipe ou clique nos produtos para começar a venda.
            </div>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li
                  key={l.product.id}
                  className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {l.product.name}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatBRL(l.product.price)} un.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeQty(l.product.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-foreground"
                      aria-label="Remover um"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">
                      {l.quantity}
                    </span>
                    <button
                      onClick={() => changeQty(l.product.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
                      aria-label="Adicionar um"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-bold tabular-nums">
                      {formatBRL(l.product.price * l.quantity)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeLine(l.product.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-end justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              Total
            </span>
            <span className="font-display text-4xl font-black tabular-nums text-primary">
              {formatBRL(total)}
            </span>
          </div>
          <Button
            onClick={openPayment}
            disabled={lines.length === 0}
            className="h-14 w-full rounded-xl text-lg font-bold"
          >
            <Banknote className="mr-2 h-5 w-5" /> Finalizar (F12)
          </Button>
        </div>
      </div>

      {payOpen && (
        <BalcaoPaymentDialog
          open={payOpen}
          onOpenChange={(v) => {
            setPayOpen(v);
            if (!v) focusSearch();
          }}
          lines={lines}
          estimatedTotal={total}
          userId={user?.id ?? ""}
          onPaid={() => {
            clearCart();
            setPayOpen(false);
            focusSearch();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fast checkout dialog — one tap per payment method                   */
/* ------------------------------------------------------------------ */

function BalcaoPaymentDialog({
  open,
  onOpenChange,
  lines,
  estimatedTotal,
  userId,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lines: BalcaoLine[];
  estimatedTotal: number;
  userId: string;
  onPaid: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: meios } = useQuery({
    queryKey: ["meios-pagamento"],
    queryFn: () => fetchMeiosPagamento(true),
    enabled: open,
  });

  // Only real money methods at the counter (no Fiado/Cashback for walk-ins).
  const meiosPdv = useMemo(
    () =>
      (meios ?? []).filter(
        (m) => !["fiado", "cashback"].includes(m.nome.toLowerCase()),
      ),
    [meios],
  );

  async function pay(meioId: string) {
    if (busy || !userId) {
      if (!userId) toast.error("Operador não autenticado.");
      return;
    }
    setBusy(true);
    try {
      const itemsPayload = lines.map((l) => ({
        productId: l.product.id,
        productName: l.product.name,
        categorySlug: l.product.categorySlug,
        comboRole: "" as const,
        name: l.product.name,
        size: l.product.size,
        addons: [],
        secondFlavor: "",
        remocoes: [],
        unitPrice: l.product.price,
        image_url: l.product.image_url,
        lineId: l.product.id,
        quantity: l.quantity,
      }));

      const orderId = await placeOrder({
        userId,
        items: itemsPayload,
        deliveryAddress: "",
        phone: "",
        notes: "Venda Balcão (PDV)",
        tipoAtendimento: "Presencial",
        numeroMesa: null,
      });

      // Authoritative, server-computed total for the settlement.
      const serverTotal = await fetchOrderTotal(orderId);
      await addPagamento({ orderId, meioId, valor: serverTotal });
      await finalizeOrderPaid(orderId);

      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["caixa-movs"] });
      await queryClient.invalidateQueries({ queryKey: ["balcao-products"] });

      toast.success(`Venda finalizada · ${formatBRL(serverTotal)}`);
      onPaid();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar.";
      if (msg.includes("ESTOQUE_INSUFICIENTE")) {
        const insumo =
          msg.split("ESTOQUE_INSUFICIENTE:")[1]?.trim() || "um insumo";
        toast.error(
          `Estoque insuficiente: "${insumo}" acabou de esgotar. Reponha o estoque para vender.`,
          { duration: 8000 },
        );
      } else {
        toast.error(msg, { duration: 7000 });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Receber pagamento</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-secondary p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total a receber
          </p>
          <p className="font-display text-4xl font-black tabular-nums text-primary">
            {formatBRL(estimatedTotal)}
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Escolha a forma de pagamento para dar baixa na venda e no estoque.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {meiosPdv.length === 0 ? (
            <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
              Nenhum meio de pagamento ativo.
            </p>
          ) : (
            meiosPdv.map((m) => (
              <Button
                key={m.id}
                onClick={() => pay(m.id)}
                disabled={busy}
                variant="secondary"
                className="h-16 rounded-xl text-base font-bold"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  m.nome
                )}
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
