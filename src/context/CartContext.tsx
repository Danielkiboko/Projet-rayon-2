"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
  supplierId?: string;
  rayon?: string;
  category?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "rayons_cart_items_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedSignatureRef = useRef<string>("");

  // 1. Load cart from localStorage on mount + support ?openCart=1 (clic depuis email/push de relance)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not load cart from storage:", e);
    } finally {
      setIsHydrated(true);
    }

    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("openCart") === "1") {
          setIsCartOpen(true);
        }
      }
    } catch {}
  }, []);

  // 1b. Si le client clique sur ?openCart=1 depuis un autre appareil et que son panier local est vide, restaurer depuis le serveur
  useEffect(() => {
    if (!isHydrated || !user || items.length > 0) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCart") !== "1") return;

    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/cart/sync", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.items) && json.items.length > 0) {
          setItems(json.items);
          setIsCartOpen(true);
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, user, items.length]);

  // 2. Persist cart to localStorage on changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save cart to storage:", e);
    }
  }, [items, isHydrated]);

  // 3. Synchronisation légère (debounce 3s) vers /api/cart/sync pour relance panier abandonné (Email + Push)
  useEffect(() => {
    if (!isHydrated) return;

    const deviceId =
      typeof window !== "undefined" ? localStorage.getItem("rayons_device_id_v1") || "" : "";

    // Inutile d'appeler l'API si ni connecté ni appareil Push enregistré
    if (!user && !deviceId) return;

    const signature = `${user?.uid || "guest"}::${items.map((it) => `${it.id}:${it.quantity}`).sort().join("|")}`;
    if (signature === lastSyncedSignatureRef.current) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch("/api/cart/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            items,
            deviceId,
            lang,
          }),
        });
        if (res.ok) {
          lastSyncedSignatureRef.current = signature;
        }
      } catch {
        // Silencieux : ne jamais perturber l'expérience client
      }
    }, 3000);

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [items, isHydrated, user, lang]);

  const addToCart = useCallback((product: any, quantity = 1) => {
    if (!product || !product.id) return;

    const price = Number(product.price) || 0;
    const title = product.title?.fr || product.title?.en || product.title || "Article";
    const image = product.imageUrl || product.image || "/images/placeholder.png";
    const supplierId = product.supplierId || "admin";
    const rayon = product.rayon || product.category || "connect";

    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === product.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
        return updated;
      }
      return [
        ...prev,
        {
          id: product.id,
          title,
          price,
          image,
          quantity: Math.max(1, quantity),
          supplierId,
          rayon,
          category: product.category,
        },
      ];
    });

    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const cartValue = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      subtotal,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
    }),
    [items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal, isCartOpen, openCart, closeCart, toggleCart]
  );

  return (
    <CartContext.Provider value={cartValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
