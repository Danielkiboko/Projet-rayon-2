"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

const CartDrawer = dynamic(
  () => import("@/modules/client/components/cart/CartDrawer").then((m) => m.CartDrawer),
  { ssr: false }
);

const MobilePushManager = dynamic(
  () => import("@/modules/shared/components/notifications/MobilePushManager"),
  { ssr: false }
);

const GlobalUiTranslator = dynamic(
  () => import("@/modules/shared/components/GlobalUiTranslator"),
  { ssr: false }
);

const AdSense = dynamic(
  () => import("@/modules/shared/components/shared/AdSense"),
  { ssr: false }
);

/**
 * Diffère les widgets globaux non critiques (panier, push, traducteur DOM, AdSense)
 * hors du bundle initial pour accélérer le premier affichage (FCP / LCP / TTI).
 */
export function DeferredGlobalWidgets() {
  const { isCartOpen } = useCart();
  const { lang } = useLanguage();
  const { user } = useAuth();

  const [hasOpenedCart, setHasOpenedCart] = useState(false);
  const [hasUsedTranslation, setHasUsedTranslation] = useState(false);
  const [isIdleReady, setIsIdleReady] = useState(false);

  useEffect(() => {
    if (isCartOpen && !hasOpenedCart) {
      setHasOpenedCart(true);
    }
  }, [isCartOpen, hasOpenedCart]);

  useEffect(() => {
    if (lang !== "fr" && !hasUsedTranslation) {
      setHasUsedTranslation(true);
    }
  }, [lang, hasUsedTranslation]);

  useEffect(() => {
    let cancelled = false;
    const activate = () => {
      if (!cancelled) setIsIdleReady(true);
    };

    const win = window as any;
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(activate, { timeout: 1800 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }

    const timer = globalThis.setTimeout(activate, 1200);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {hasOpenedCart && <CartDrawer />}
      {isIdleReady && (Boolean(user) || hasUsedTranslation || typeof window !== "undefined") && (
        <MobilePushManager />
      )}
      {hasUsedTranslation && <GlobalUiTranslator />}
      {isIdleReady && <AdSense />}
    </>
  );
}
