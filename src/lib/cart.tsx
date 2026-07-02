import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  minOrderShortfalls,
  subtotalOf,
  type MinShortfall,
} from "@/lib/pricing";
import {
  fetchActiveCombos,
  matchedCombos,
  type AppliedCombo,
} from "@/lib/combos";


export interface CartAddon {
  name: string;
  price: number;
  /** Units of this add-on (defaults to 1). */
  quantity?: number;
}

export type CartComboRole = "burger" | "side" | "beverage" | "";

export interface CartItem {
  /** Stable id for this exact configuration (merges identical lines). */
  lineId: string;
  productId: string;
  productName: string;
  categorySlug: string;
  comboRole: CartComboRole;
  /** Display name including size / half-and-half. */
  name: string;
  size: string;
  addons: CartAddon[];
  /** Second flavor name for half-and-half pizzas (empty otherwise). */
  secondFlavor: string;
  /** Ingredients the customer asked to remove (e.g. ["Cebola Roxa"]). */
  remocoes: string[];
  /** Final per-unit price (size + add-ons + half-and-half average). */
  unitPrice: number;
  image_url: string;
  quantity: number;
}

export type NewCartItem = Omit<CartItem, "lineId" | "quantity">;

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  discount: number;
  appliedCombos: AppliedCombo[];
  totalPrice: number;
  shortfalls: MinShortfall[];
  canCheckout: boolean;
  addLine: (line: NewCartItem, quantity?: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
}


const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = "delivery_cart_v2";

export function makeLineId(line: NewCartItem): string {
  const addonKey = [...line.addons]
    .map((a) => `${a.name}:${a.price}x${a.quantity ?? 1}`)
    .sort()
    .join(",");
  const removalKey = [...line.remocoes].sort().join(",");
  return [line.productId, line.size, line.secondFlavor, addonKey, removalKey].join("|");
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  const addLine = useCallback((line: NewCartItem, quantity = 1) => {
    const lineId = makeLineId(line);
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) =>
          i.lineId === lineId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        );
      }
      return [...prev, { ...line, lineId, quantity }];
    });
  }, []);

  const increment = useCallback((lineId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    );
  }, []);

  const decrement = useCallback((lineId: string) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.lineId === lineId ? { ...i, quantity: i.quantity - 1 } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );
  const subtotal = useMemo(() => subtotalOf(items), [items]);

  // Dynamic combo engine: read active rules from the database and apply the
  // sum of every rule satisfied by the current cart (multiple combos stack).
  const { data: comboRules = [] } = useQuery({
    queryKey: ["active-combos"],
    queryFn: fetchActiveCombos,
    staleTime: 60_000,
  });
  const appliedCombos = useMemo(
    () => matchedCombos(items, comboRules),
    [items, comboRules],
  );
  const discount = useMemo(
    () => appliedCombos.reduce((sum, c) => sum + c.valor_desconto, 0),
    [appliedCombos],
  );

  const totalPrice = useMemo(
    () => Math.max(0, subtotal - discount),
    [subtotal, discount],
  );
  const shortfalls = useMemo(() => minOrderShortfalls(items), [items]);
  const canCheckout = items.length > 0 && shortfalls.length === 0;

  const value = useMemo(
    () => ({
      items,
      totalItems,
      subtotal,
      discount,
      appliedCombos,
      totalPrice,
      shortfalls,
      canCheckout,
      addLine,
      increment,
      decrement,
      removeItem,
      clear,
    }),
    [
      items,
      totalItems,
      subtotal,
      discount,
      appliedCombos,
      totalPrice,
      shortfalls,
      canCheckout,
      addLine,
      increment,
      decrement,
      removeItem,
      clear,
    ],
  );


  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
