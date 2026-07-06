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
  LayoutGrid,
  SlidersHorizontal,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import {
  fetchBalcaoData,
  fetchOrderTotal,
  type BalcaoProduct,
} from "@/lib/balcao";
import type { Category, Product } from "@/lib/menu";
import { makeLineId, type NewCartItem } from "@/lib/cart";
import { ProductImage } from "@/components/ProductImage";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { usePixPayment } from "@/hooks/usePixPayment";
import { placeOrder } from "@/lib/orders";
import {
  addPagamento,
  finalizeOrderPaid,
  fetchMeiosPagamento,
  type MeioPagamento,
} from "@/lib/caixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A fully-priced cupom line (quick-add or customized via the app modal). */
type BalcaoLine = NewCartItem & { lineId: string; quantity: number };

const ALL = "__all__";
const round2 = (n: number) => Math.round(n * 100) / 100;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Build a direct-sale line from a flattened PDV product. */
function quickLineFrom(p: BalcaoProduct): NewCartItem {
  return {
    productId: p.id,
    productName: p.name,
    categorySlug: p.categorySlug,
    comboRole: "",
    name: p.name,
    size: p.size,
    addons: [],
    secondFlavor: "",
    remocoes: [],
    unitPrice: p.price,
    image_url: p.image_url,
  };
}

export function BalcaoView() {
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [lines, setLines] = useState<BalcaoLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [custom, setCustom] = useState<{
    product: Product;
    category: Category;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["balcao-data"],
    queryFn: fetchBalcaoData,
    staleTime: 1000 * 60 * 2,
  });

  const products = data?.products;
  const categories = data?.categories;

  // Full-menu lookups so a click / scan can open the same modal as the app.
  const menuProductById = useMemo(
    () => new Map((data?.menuProducts ?? []).map((p) => [p.id, p])),
    [data?.menuProducts],
  );
  const menuCategoryById = useMemo(
    () => new Map((data?.menuCategories ?? []).map((c) => [c.id, c])),
    [data?.menuCategories],
  );

  const total = useMemo(
    () => round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
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

  /** Merge/append a fully-priced line into the cupom. */
  const addCartLine = useCallback((line: NewCartItem, quantity = 1) => {
    const lineId = makeLineId(line);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.lineId === lineId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      return [...prev, { ...line, lineId, quantity }];
    });
  }, []);

  /** Click / scan entry point: customize when needed, else drop it straight in. */
  const selectProduct = useCallback(
    (p: BalcaoProduct) => {
      if (p.esgotado) {
        toast.error(`"${p.name}" está esgotado.`);
        return;
      }
      const full = menuProductById.get(p.id);
      const cat = full ? menuCategoryById.get(full.category_id) : undefined;
      if (full && cat && p.needsCustomization) {
        setCustom({ product: full, category: cat });
        return;
      }
      addCartLine(quickLineFrom(p), 1);
    },
    [menuProductById, menuCategoryById, addCartLine],
  );

  const changeQty = useCallback((lineId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.lineId === lineId ? { ...l, quantity: l.quantity + delta } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  // The visible grid follows the selected category (Netflix-style filter).
  // A live search box narrows the current view by name across every category.
  const gridProducts = useMemo(() => {
    const list = products ?? [];
    const q = norm(search);
    const byCat =
      activeCat === ALL
        ? list
        : list.filter((p) => p.categoryId === activeCat);
    if (!q) return byCat;
    return byCat.filter(
      (p) => norm(p.name).includes(q) || p.ean.includes(search.trim()),
    );
  }, [products, search, activeCat]);

  /** Resolve a scanned/typed term to a single product and add it — regardless
   *  of the category currently selected on screen (the golden rule). */
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
      selectProduct(hit);
      setSearch("");
      focusSearch();
      return true;
    }
    toast.error(`Nenhum produto encontrado para "${raw}".`);
    return false;
  }, [search, products, selectProduct, focusSearch]);

  const openPayment = useCallback(() => {
    if (lines.length === 0) {
      toast.error("Adicione itens antes de finalizar.");
      focusSearch();
      return;
    }
    setPayOpen(true);
  }, [lines.length, focusSearch]);

  // Global keyboard shortcuts: F12 finalizes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (payOpen || custom) return;
      if (e.key === "F12") {
        e.preventDefault();
        openPayment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPayment, payOpen, custom]);

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

  // Siblings (same category) for half-and-half selection inside the modal.
  const customSiblings = useMemo(() => {
    if (!custom) return [];
    return (data?.menuProducts ?? []).filter(
      (p) => p.category_id === custom.category.id,
    );
  }, [custom, data?.menuProducts]);

  return (
    <div className="grid min-h-0 h-[calc(100vh-260px)] grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12 lg:gap-0">
      {/* ---------------- LEFT (col-span-9): only this block scrolls ---------------- */}
      <div className="flex h-full min-w-0 flex-col overflow-y-auto pb-4 pr-2 lg:col-span-9 lg:pr-4">


        {/* Sticky header: search + category carousel stay visible while grid scrolls */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 bg-background pb-3">
          <div className="rounded-2xl bg-card p-3 shadow-card">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <ScanBarcode className="h-4 w-4" /> Bipar código de barras ou
              digitar produto
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
              Enter adiciona o item ao cupom · Enter no campo vazio (ou{" "}
              <kbd className="rounded bg-secondary px-1 font-semibold">F12</kbd>)
              abre o pagamento
            </p>
          </div>

          {/* Category carousel — scrolls horizontally, never wraps */}
          {(categories?.length ?? 0) > 0 && (
            <div className="no-scrollbar overflow-x-auto">
              <div className="flex flex-nowrap gap-2 pb-1">
                <CategoryButton
                  label="Todos"
                  active={activeCat === ALL}
                  onClick={() => setActiveCat(ALL)}
                />
                {categories!.map((c) => (
                  <CategoryButton
                    key={c.id}
                    label={c.name}
                    slug={c.slug}
                    active={activeCat === c.id}
                    onClick={() => setActiveCat(c.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product grid */}
        <div className="rounded-2xl bg-card p-3 shadow-card">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : gridProducts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
              {gridProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  disabled={p.esgotado}
                  className={`group flex flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition-all ${
                    p.esgotado
                      ? "cursor-not-allowed opacity-50"
                      : "hover:border-primary hover:shadow-card active:scale-[0.98]"
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-secondary">
                    <ProductImage
                      src={p.image_url}
                      alt={p.name}
                      categorySlug={p.categorySlug}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {p.esgotado && (
                      <span className="absolute inset-x-0 bottom-0 bg-destructive/90 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-destructive-foreground">
                        Esgotado
                      </span>
                    )}
                    {!p.esgotado && p.needsCustomization && (
                      <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        <SlidersHorizontal className="h-2.5 w-2.5" /> Opções
                      </span>
                    )}
                    {!p.esgotado && (
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-0.5 p-1.5">
                    <span className="line-clamp-2 text-xs font-semibold leading-tight">
                      {p.name}
                    </span>
                    <span className="font-display text-sm font-bold text-primary">
                      {formatBRL(p.price)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- RIGHT (col-span-3): static cupom, pinned to the edge ---------------- */}
      <div className="flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-2xl bg-card shadow-card lg:col-span-3 lg:rounded-none lg:border-l lg:border-border lg:bg-secondary/30 lg:shadow-none">

        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <ScanBarcode className="h-8 w-8 opacity-40" />
              Bipe ou clique nos produtos para começar a venda.
            </div>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li
                  key={l.lineId}
                  className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    {(l.addons.length > 0 || l.remocoes.length > 0) && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[
                          ...l.addons.map(
                            (a) =>
                              `+${a.name}${a.quantity && a.quantity > 1 ? ` x${a.quantity}` : ""}`,
                          ),
                          ...l.remocoes.map((r) => `sem ${r}`),
                        ].join(" · ")}
                      </p>
                    )}
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatBRL(l.unitPrice)} un.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeQty(l.lineId, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground"
                      aria-label="Remover um"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">
                      {l.quantity}
                    </span>
                    <button
                      onClick={() => changeQty(l.lineId, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
                      aria-label="Adicionar um"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-bold tabular-nums">
                      {formatBRL(l.unitPrice * l.quantity)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeLine(l.lineId)}
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

        <div className="shrink-0 border-t border-border p-4">
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

      {/* Same customization modal as the customer app, feeding the cupom. */}
      {custom && (
        <ProductCustomizer
          open={!!custom}
          onOpenChange={(o) => {
            if (!o) {
              setCustom(null);
              focusSearch();
            }
          }}
          product={custom.product}
          category={custom.category}
          siblings={customSiblings}
          onAdd={(line, qty) => {
            addCartLine(line, qty);
            setCustom(null);
            focusSearch();
          }}
        />
      )}

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
/* Square, image-backed category button (Netflix-style filter tile)    */
/* ------------------------------------------------------------------ */

function CategoryButton({
  label,
  slug,
  active,
  onClick,
}: {
  label: string;
  slug?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-20 w-24 shrink-0 flex-col justify-end overflow-hidden rounded-xl border-2 text-left transition-all active:scale-95 ${
        active
          ? "border-primary shadow-card"
          : "border-transparent opacity-90 hover:opacity-100"
      }`}
    >
      {slug ? (
        <ProductImage
          src=""
          alt={label}
          categorySlug={slug}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-primary/10">
          <LayoutGrid className="h-6 w-6 text-primary" />
        </span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <span className="relative z-10 line-clamp-2 p-1.5 text-xs font-bold leading-tight text-white">
        {label}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Classic PDV checkout: multiple methods + cash change (troco)         */
/* ------------------------------------------------------------------ */

interface PdvPayment {
  meioId: string;
  meioNome: string;
  /** Amount credited to the order (never exceeds the remaining balance). */
  valor: number;
  /** Cash tendered by the customer (for the troco calc); === valor otherwise. */
  recebido: number;
  isCash: boolean;
}

const isCashMethod = (nome: string) => norm(nome).includes("dinheiro");
const isPixMethod = (nome: string) => norm(nome).includes("pix");

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
  const [payments, setPayments] = useState<PdvPayment[]>([]);
  const [selected, setSelected] = useState<MeioPagamento | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

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

  const paidSum = useMemo(
    () => round2(payments.reduce((s, p) => s + p.valor, 0)),
    [payments],
  );
  const remaining = useMemo(
    () => round2(Math.max(0, estimatedTotal - paidSum)),
    [estimatedTotal, paidSum],
  );
  const fullyPaid = remaining <= 0.001;

  const trocoTotal = useMemo(
    () =>
      round2(
        payments.reduce(
          (s, p) => s + (p.isCash ? Math.max(0, p.recebido - p.valor) : 0),
          0,
        ),
      ),
    [payments],
  );

  // Live troco preview while the operator types the cash tendered.
  const selectedIsCash = selected ? isCashMethod(selected.nome) : false;
  const selectedIsPix = selected ? isPixMethod(selected.nome) : false;
  const parsedAmount = Number(amountStr.replace(",", ".")) || 0;
  const previewTroco =
    selectedIsCash && parsedAmount > remaining
      ? round2(parsedAmount - remaining)
      : 0;

  // Dynamic PIX BR Code (Copia e Cola) + QR for the exact remaining balance.
  const pix = usePixPayment(remaining);

  function pickMethod(m: MeioPagamento) {
    setSelected(m);
    // Prefill with the remaining balance so a single confirm liquidates it.
    setAmountStr(remaining ? remaining.toFixed(2) : "");
    if (!isPixMethod(m.nome)) {
      requestAnimationFrame(() => amountRef.current?.focus());
    }
  }

  /** Confirms PIX receipt for the exact remaining balance and records it. */
  function confirmPix() {
    if (!selected) return;
    setPayments((prev) => [
      ...prev,
      {
        meioId: selected.id,
        meioNome: selected.nome,
        valor: remaining,
        recebido: remaining,
        isCash: false,
      },
    ]);
    setSelected(null);
    setAmountStr("");
    toast.success("Recebimento PIX confirmado.");
  }


  function confirmPartial() {
    if (!selected) return;
    const cash = isCashMethod(selected.nome);
    const entered = round2(parsedAmount);
    if (entered <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    // Money credited to the order can never exceed what's still due.
    const applied = round2(Math.min(entered, remaining));
    setPayments((prev) => [
      ...prev,
      {
        meioId: selected.id,
        meioNome: selected.nome,
        valor: applied,
        recebido: cash ? entered : applied,
        isCash: cash,
      },
    ]);
    setSelected(null);
    setAmountStr("");
  }

  function removePayment(idx: number) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetAll() {
    setPayments([]);
    setSelected(null);
    setAmountStr("");
  }

  async function finalize() {
    if (busy || !userId) {
      if (!userId) toast.error("Operador não autenticado.");
      return;
    }
    if (!fullyPaid) {
      toast.error("Faltam valores para liquidar o cupom.");
      return;
    }
    setBusy(true);
    try {
      const itemsPayload = lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        categorySlug: l.categorySlug,
        comboRole: l.comboRole,
        name: l.name,
        size: l.size,
        addons: l.addons,
        secondFlavor: l.secondFlavor,
        remocoes: l.remocoes,
        unitPrice: l.unitPrice,
        image_url: l.image_url,
        lineId: l.lineId,
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

      // Authoritative, server-computed total. Reconcile any rounding drift so
      // the sum of recorded payments matches the order exactly.
      const serverTotal = await fetchOrderTotal(orderId);
      const applied = payments.map((p) => ({ ...p }));
      const appliedSum = round2(applied.reduce((s, p) => s + p.valor, 0));
      const drift = round2(serverTotal - appliedSum);
      if (Math.abs(drift) >= 0.01 && applied.length > 0) {
        const last = applied[applied.length - 1];
        last.valor = round2(last.valor + drift);
        if (!last.isCash) last.recebido = last.valor;
      }

      for (const p of applied) {
        await addPagamento({ orderId, meioId: p.meioId, valor: p.valor });
      }
      await finalizeOrderPaid(orderId);

      await queryClient.invalidateQueries({ queryKey: ["caixa-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["caixa-movs"] });
      await queryClient.invalidateQueries({ queryKey: ["balcao-data"] });

      const trocoMsg = trocoTotal > 0 ? ` · Troco ${formatBRL(trocoTotal)}` : "";
      toast.success(`Venda finalizada · ${formatBRL(serverTotal)}${trocoMsg}`);
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Receber pagamento</DialogTitle>
        </DialogHeader>

        {/* Totals band */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="font-display text-xl font-black tabular-nums">
              {formatBRL(estimatedTotal)}
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pago
            </p>
            <p className="font-display text-xl font-black tabular-nums text-success">
              {formatBRL(paidSum)}
            </p>
          </div>
          <div
            className={`rounded-xl p-3 text-center ${
              fullyPaid ? "bg-success/12" : "bg-primary/10"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Restante
            </p>
            <p
              className={`font-display text-xl font-black tabular-nums ${
                fullyPaid ? "text-success" : "text-primary"
              }`}
            >
              {formatBRL(remaining)}
            </p>
          </div>
        </div>

        {/* Recorded payments */}
        {payments.length > 0 && (
          <ul className="space-y-1.5">
            {payments.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm"
              >
                <span className="font-semibold">{p.meioNome}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums font-bold">
                    {formatBRL(p.valor)}
                  </span>
                  {p.isCash && p.recebido > p.valor && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      (recebido {formatBRL(p.recebido)})
                    </span>
                  )}
                  <button
                    onClick={() => removePayment(i)}
                    className="text-destructive hover:opacity-70"
                    aria-label="Remover pagamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Troco highlight */}
        {(previewTroco > 0 || trocoTotal > 0) && (
          <div className="flex items-center justify-between rounded-xl border-2 border-success bg-success/10 px-4 py-3">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-success">
              Troco
            </span>
            <span className="font-display text-3xl font-black tabular-nums text-success">
              {formatBRL(previewTroco > 0 ? previewTroco : trocoTotal)}
            </span>
          </div>
        )}

        {/* Method picker OR amount entry */}
        {!fullyPaid &&
          (selected ? (
            selectedIsPix ? (
              <div className="space-y-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <QrCode className="h-4 w-4 text-primary" /> PIX ·{" "}
                    {formatBRL(remaining)}
                  </span>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setAmountStr("");
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:underline"
                  >
                    Voltar
                  </button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Peça para o cliente escanear o QR Code no balcão. O valor de{" "}
                  <span className="font-semibold text-foreground">
                    {formatBRL(remaining)}
                  </span>{" "}
                  já vem preenchido.
                </p>

                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white p-3 shadow-card">
                    <QRCodeCanvas
                      value={pix.payload}
                      size={190}
                      level="M"
                      marginSize={1}
                      aria-label="QR Code para pagamento PIX"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => pix.copy()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold transition-transform active:scale-95"
                >
                  {pix.copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {pix.copied ? "Código copiado!" : "Copiar Código PIX"}
                </button>

                <p className="text-center text-[11px] text-muted-foreground">
                  Favorecido:{" "}
                  <span className="font-medium text-foreground">
                    {pix.merchantName}
                  </span>{" "}
                  • {pix.merchantCity}
                </p>

                <Button
                  onClick={confirmPix}
                  variant="success"
                  className="h-14 w-full rounded-xl text-base font-bold"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Confirmar recebimento
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {selected.nome}
                    {selectedIsCash ? " · Valor recebido" : " · Valor"}
                  </span>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setAmountStr("");
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:underline"
                  >
                    Voltar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-muted-foreground">
                    R$
                  </span>
                  <Input
                    ref={amountRef}
                    autoFocus
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmPartial();
                      }
                    }}
                    placeholder="0,00"
                    className="h-14 rounded-xl text-2xl font-black tabular-nums"
                  />
                  <Button
                    onClick={confirmPartial}
                    className="h-14 rounded-xl px-5 text-base font-bold"
                  >
                    Adicionar
                  </Button>
                </div>
                {selectedIsCash && previewTroco > 0 && (
                  <p className="text-right text-sm font-bold text-success">
                    Troco: {formatBRL(previewTroco)}
                  </p>
                )}
              </div>
            )
          ) : (
            <div>
              <p className="mb-2 text-center text-sm text-muted-foreground">
                Adicione uma ou mais formas de pagamento até liquidar o cupom.
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
                      onClick={() => pickMethod(m)}
                      disabled={busy}
                      variant="secondary"
                      className="h-16 rounded-xl text-base font-bold"
                    >
                      {m.nome}
                    </Button>
                  ))
                )}
              </div>
            </div>
          ))}

        {/* Finalize */}
        <div className="flex gap-2 pt-1">
          {payments.length > 0 && (
            <Button
              variant="ghost"
              onClick={resetAll}
              disabled={busy}
              className="h-14 rounded-xl font-semibold text-destructive"
            >
              Limpar
            </Button>
          )}
          <Button
            onClick={finalize}
            disabled={busy || !fullyPaid}
            variant="success"
            className="h-14 flex-1 rounded-xl text-lg font-bold"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" /> Concluir venda
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
