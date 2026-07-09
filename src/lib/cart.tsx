import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { z } from "zod";
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
import { useAuth } from "@/lib/auth";



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

// Zod schema that guards everything we read back from localStorage. The cart is
// user-editable persisted state, so it is treated as untrusted input: a
// tampered or corrupted payload (e.g. the "token 400" style breakage) must
// never reach the pricing engine. `sanitizeCartItem` first repairs loose/legacy
// shapes, then this schema is the final integrity gate.
const cartAddonSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive().optional(),
});

const cartItemSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string(),
  categorySlug: z.string(),
  comboRole: z.enum(["burger", "side", "beverage", ""]),
  name: z.string(),
  size: z.string(),
  addons: z.array(cartAddonSchema),
  secondFlavor: z.string(),
  remocoes: z.array(z.string()),
  unitPrice: z.number().nonnegative(),
  image_url: z.string(),
  quantity: z.number().int().positive(),
});

const cartArraySchema = z.array(cartItemSchema);

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

function clearCartKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function loadCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      // Not even the right shape → corrupted bucket, reset it.
      clearCartKey(key);
      return [];
    }
    // Repair loose/legacy items first, then validate the result with Zod.
    const repaired = parsed
      .map((item, index) => sanitizeCartItem(item, index))
      .filter((i): i is CartItem => Boolean(i));
    const result = cartArraySchema.safeParse(repaired);
    if (result.success) return result.data;
    // Malformed beyond repair → clear storage and reset the session cleanly.
    clearCartKey(key);
    return [];
  } catch {
    // Invalid JSON / storage failure → reset this bucket automatically.
    clearCartKey(key);
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
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Refs let the auth subscriber react to the CURRENT user/hydration state
  // without re-subscribing on every change.
  const userIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const checkoutPath = location.pathname === "/checkout";

  // Resolve the session first, then hydrate the cart from the bucket that
  // belongs to THAT user. This is what stops user B from inheriting user A's
  // cart: each account reads/writes its own key, and switching accounts loads
  // the target account's own cart instead of carrying items over.
  useEffect(() => {
    if (authLoading) return;
    const nextUid = user?.id ?? null;

    const applyUser = (nextUid: string | null) => {
      const prevUid = userIdRef.current;

      // First resolution: decide which bucket to hydrate from.
      if (!hydratedRef.current) {
        let loaded: CartItem[];
        if (nextUid) {
          const own = loadCart(keyForUser(nextUid));
          const anon = loadCart(ANON_KEY);
          // Adopt an anonymous cart built before login (only if the account
          // has no cart of its own yet), then clear the anon bucket.
          if (own.length === 0 && anon.length > 0) {
            loaded = anon;
            saveCart(keyForUser(nextUid), anon);
            localStorage.removeItem(ANON_KEY);
          } else {
            loaded = own;
          }
        } else {
          loaded = loadCart(ANON_KEY);
        }
        userIdRef.current = nextUid;
        hydratedRef.current = true;
        setUserId(nextUid);
        setItems(loaded);
        setHydrated(true);
        return;
      }

      // Same user (token refresh, tab focus): nothing to move.
      if (prevUid === nextUid) return;

      // If auth drops while the customer is already on the PIX checkout, keep
      // the visible payment/cart snapshot stable. Outside checkout, anonymous
      // state is applied normally so logout/account switching remains isolated.
      if (prevUid && nextUid === null && checkoutPath) return;

      // Anonymous → logged in: adopt whatever is currently in memory into the
      // account, unless the account already has its own saved cart.
      if (prevUid === null && nextUid) {
        setItems((current) => {
          const own = loadCart(keyForUser(nextUid));
          if (own.length === 0 && current.length > 0) {
            saveCart(keyForUser(nextUid), current);
            localStorage.removeItem(ANON_KEY);
            return current;
          }
          return own;
        });
        userIdRef.current = nextUid;
        setUserId(nextUid);
        return;
      }

      // Logout OR account switch (A → B): load the target's OWN cart and never
      // carry the previous user's items across.
      userIdRef.current = nextUid;
      setUserId(nextUid);
      setItems(loadCart(storageKeyFor(nextUid)));
    };

    applyUser(nextUid);
  }, [authLoading, checkoutPath, user?.id]);

  useEffect(() => {
    // Never persist before the initial restore has run, otherwise the empty
    // starting state would clobber a saved cart on first mount. Always write to
    // the bucket that belongs to the current user.
    if (!hydrated) return;
    saveCart(storageKeyFor(userId), items);
  }, [items, hydrated, userId]);


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
