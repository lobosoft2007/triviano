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
import { supabase } from "@/integrations/supabase/client";



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
  /** True once the cart has been restored from localStorage. */
  hydrated: boolean;
  /**
   * Id of the signed-in user this cart is bound to (null while anonymous).
   * The cart itself lives in localStorage per device; on login we "adopt" it
   * by stamping the current user's id so downstream code can associate the
   * order with the right account.
   */
  userId: string | null;
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

// The cart lives in localStorage, which is scoped per ORIGIN (domain). Since
// each tenant is served from its own domain, tenants are already isolated at
// the storage layer. What was NOT isolated was two different USERS on the same
// browser/domain: the old single fixed key made user B inherit user A's cart.
// We now scope the storage key by user id, with a dedicated anonymous bucket,
// and "adopt" the anonymous cart into the account on first login.
const STORAGE_PREFIX = "delivery_cart_v2";
const ANON_KEY = `${STORAGE_PREFIX}:anon`;
const keyForUser = (uid: string) => `${STORAGE_PREFIX}:u:${uid}`;
const storageKeyFor = (uid: string | null) => (uid ? keyForUser(uid) : ANON_KEY);

function loadCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(sanitizeCartItem).filter((i): i is CartItem => Boolean(i))
      : [];
  } catch {
    return [];
  }
}

function saveCart(key: string, items: CartItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

function sanitizeAddon(addon: unknown): CartAddon | null {
  if (!addon || typeof addon !== "object") return null;
  const raw = addon as Partial<CartAddon>;
  const name = toSafeString(raw.name).trim();
  if (!name) return null;
  return {
    name,
    price: Math.max(0, toFiniteNumber(raw.price, 0)),
    quantity: Math.max(1, Math.floor(toFiniteNumber(raw.quantity, 1))),
  };
}

function sanitizeCartItem(item: unknown, index = 0): CartItem | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Partial<CartItem>;
  const productId = toSafeString(raw.productId, `legacy-${index}`);
  const size = toSafeString(raw.size, "Padrão");
  const secondFlavor = toSafeString(raw.secondFlavor);
  const addons = Array.isArray(raw.addons)
    ? raw.addons.map(sanitizeAddon).filter((a): a is CartAddon => Boolean(a))
    : [];
  const remocoes = Array.isArray(raw.remocoes)
    ? raw.remocoes.map((r) => toSafeString(r).trim()).filter(Boolean)
    : [];
  const comboRole =
    raw.comboRole === "burger" || raw.comboRole === "side" || raw.comboRole === "beverage"
      ? raw.comboRole
      : "";
  const line: NewCartItem = {
    productId,
    productName: toSafeString(raw.productName, toSafeString(raw.name, "Produto")),
    categorySlug: toSafeString(raw.categorySlug),
    comboRole,
    name: toSafeString(raw.name, toSafeString(raw.productName, "Produto")),
    size,
    addons,
    secondFlavor,
    remocoes,
    unitPrice: Math.max(0, toFiniteNumber(raw.unitPrice, 0)),
    image_url: toSafeString(raw.image_url),
  };
  const quantity = Math.max(1, Math.floor(toFiniteNumber(raw.quantity, 1)));
  return {
    ...line,
    lineId: toSafeString(raw.lineId, makeLineId(line)),
    quantity,
  };
}

function sanitizeNewCartItem(line: NewCartItem): NewCartItem {
  const sanitized = sanitizeCartItem({ ...line, quantity: 1 });
  if (!sanitized) return line;
  const { lineId: _lineId, quantity: _quantity, ...cleanLine } = sanitized;
  return cleanLine;
}

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
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const restored = Array.isArray(parsed)
          ? parsed.map(sanitizeCartItem).filter((i): i is CartItem => Boolean(i))
          : [];
        setItems(restored);
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Bind (adopt) the cart to the signed-in user. The cart is a per-device
  // localStorage cart; when a session exists we stamp its owner id so any
  // anonymous cart becomes "owned" by the logged-in user without discarding
  // the items already added.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    // Never persist before the initial restore has run, otherwise the empty
    // starting state would clobber a saved cart on first mount.
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items, hydrated]);

  const addLine = useCallback((line: NewCartItem, quantity = 1) => {
    const safeLine = sanitizeNewCartItem(line);
    const safeQuantity = Math.max(1, Math.floor(toFiniteNumber(quantity, 1)));
    const lineId = makeLineId(safeLine);
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) =>
          i.lineId === lineId
            ? { ...i, quantity: i.quantity + safeQuantity }
            : i,
        );
      }
      return [...prev, { ...safeLine, lineId, quantity: safeQuantity }];
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
      hydrated,
      userId,
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
      hydrated,
      userId,
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
