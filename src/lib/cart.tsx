import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  comboDiscount,
  minOrderShortfalls,
  subtotalOf,
  type MinShortfall,
} from "@/lib/pricing";

export interface CartAddon {
  name: string;
  price: number;
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
    .map((a) => a.name)
    .sort()
    .join(",");
  return [line.productId, line.size, line.secondFlavor, addonKey].join("|");
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
  const discount = useMemo(() => comboDiscount(items), [items]);
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
