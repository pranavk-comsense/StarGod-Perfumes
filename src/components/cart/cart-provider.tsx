"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadCart, setCartItem } from "@/lib/cart/actions";
import { MAX_LINES, MAX_QTY, type CartItem } from "@/lib/cart/types";

const STORAGE_KEY = "sg_cart_v1";

type CartContextValue = {
  items: CartItem[];
  count: number;
  ready: boolean;
  signedIn: boolean;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  /** Called by <CartIdentity> when the server-rendered session changes. */
  setIdentity: (userId: string | null) => void;
  /** Re-reads the saved cart (e.g. after an order consumed it). */
  refresh: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readGuest(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => typeof i?.variantId === "string" && Number.isInteger(i?.qty)) : [];
  } catch {
    return [];
  }
}

function writeGuest(items: CartItem[]) {
  try {
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode): cart lives in memory only */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const identity = useRef<string | null | undefined>(undefined);

  // Show the guest cart immediately; the server reconciles once identity is known.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setItems(readGuest());
  }, []);

  const setIdentity = useCallback((userId: string | null) => {
    if (identity.current === userId) return;
    const previous = identity.current;
    identity.current = userId;
    if (userId) {
      setReady(false);
      loadCart(readGuest()).then((res) => {
        if (identity.current !== userId) return;
        if (res.signedIn) {
          writeGuest([]);
          setItems(res.items);
          setSignedIn(true);
        }
        setReady(true);
      });
    } else {
      // Signed out (or guest from the start): fall back to the device cart.
      if (previous) writeGuest([]);
      setItems(previous ? [] : readGuest());
      setSignedIn(false);
      setReady(true);
    }
  }, []);

  const persist = useCallback(
    (next: CartItem[], changed: CartItem | { variantId: string; qty: 0 }) => {
      setItems(next);
      if (signedIn) void setCartItem(changed.variantId, changed.qty);
      else writeGuest(next);
    },
    [signedIn],
  );

  const add = useCallback(
    (variantId: string, qty = 1) => {
      const existing = items.find((i) => i.variantId === variantId);
      if (!existing && items.length >= MAX_LINES) return;
      const newQty = Math.min(MAX_QTY, (existing?.qty ?? 0) + qty);
      const next = existing ? items.map((i) => (i.variantId === variantId ? { ...i, qty: newQty } : i)) : [...items, { variantId, qty: newQty }];
      persist(next, { variantId, qty: newQty });
    },
    [items, persist],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) => {
      const q = Math.max(0, Math.min(MAX_QTY, qty));
      const next = q === 0 ? items.filter((i) => i.variantId !== variantId) : items.map((i) => (i.variantId === variantId ? { ...i, qty: q } : i));
      persist(next, { variantId, qty: q });
    },
    [items, persist],
  );

  const remove = useCallback((variantId: string) => setQty(variantId, 0), [setQty]);

  const refresh = useCallback(() => {
    if (!identity.current) return;
    const userId = identity.current;
    loadCart([]).then((res) => {
      if (identity.current === userId && res.signedIn) setItems(res.items);
    });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({ items, count: items.reduce((n, i) => n + i.qty, 0), ready, signedIn, add, setQty, remove, setIdentity, refresh }),
    [items, ready, signedIn, add, setQty, remove, setIdentity, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/** Rendered inside the (dynamic) account menu so the cart follows sign-in/sign-out. */
export function CartIdentity({ userId }: { userId: string | null }) {
  const { setIdentity } = useCart();
  useEffect(() => {
    setIdentity(userId);
  }, [userId, setIdentity]);
  return null;
}

/** Drop-in for pages reached right after an order is placed. */
export function CartRefresh() {
  const { refresh, ready } = useCart();
  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);
  return null;
}
