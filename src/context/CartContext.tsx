"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";

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
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Load cart from localStorage on mount
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
  }, []);

  // 2. Persist cart to localStorage on changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save cart to storage:", e);
    }
  }, [items, isHydrated]);

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
