"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export type CurrencyCode = "USD" | "FC" | "EUR";

interface CurrencyRates {
  USD: number;
  FC: number;
  EUR: number;
}

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatPrice: (amountInUSD: number | string | null | undefined) => string;
  convertPrice: (amountInUSD: number | string | null | undefined) => number;
  rates: CurrencyRates;
}

const DEFAULT_RATES: CurrencyRates = {
  USD: 1,
  FC: 2850,    // 1 USD = 2850 Francs Congolais (taux moyen RDC)
  EUR: 0.92,   // 1 USD = 0.92 Euro (1 EUR ≈ 1.08 USD)
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  formatPrice: () => "",
  convertPrice: () => 0,
  rates: DEFAULT_RATES,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [rates, setRates] = useState<CurrencyRates>(DEFAULT_RATES);

  // Load saved currency preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rayon_currency");
      if (saved && (saved === "USD" || saved === "FC" || saved === "EUR")) {
        setCurrencyState(saved as CurrencyCode);
      }
    } catch {
      // Ignore localStorage errors in SSR / private mode
    }
  }, []);

  // Fetch platform exchange rates once with 30-min sessionStorage cache (no permanent onSnapshot for every visitor)
  useEffect(() => {
    const CACHE_KEY = "rayons_currency_rates_v1";
    const TTL_MS = 30 * 60 * 1000;
    try {
      const cachedRaw = sessionStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed?.rates && Date.now() - Number(parsed.ts || 0) < TTL_MS) {
          setRates(parsed.rates);
          return;
        }
      }
    } catch {}

    let cancelled = false;
    getDoc(doc(db, "settings", "platform"))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        const fcRate = Number(data.usdToFcRate || data.exchangeRateFC);
        const eurRate = Number(data.usdToEurRate || data.exchangeRateEUR);
        const nextRates: CurrencyRates = {
          USD: 1,
          FC: fcRate && fcRate > 0 ? fcRate : DEFAULT_RATES.FC,
          EUR: eurRate && eurRate > 0 ? eurRate : DEFAULT_RATES.EUR,
        };
        setRates(nextRates);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rates: nextRates, ts: Date.now() }));
        } catch {}
      })
      .catch(() => {
        // Fallback silently to default rates
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("rayon_currency", c);
    } catch {}
  }, []);

  const convertPrice = useCallback((amountInUSD: number | string | null | undefined): number => {
    if (amountInUSD === null || amountInUSD === undefined || amountInUSD === "") return 0;
    const num = typeof amountInUSD === "number" ? amountInUSD : parseFloat(String(amountInUSD).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return 0;

    const rate = rates[currency] || 1;
    return num * rate;
  }, [currency, rates]);

  const formatPrice = useCallback((amountInUSD: number | string | null | undefined): string => {
    if (amountInUSD === null || amountInUSD === undefined || amountInUSD === "") return "";
    const num = typeof amountInUSD === "number" ? amountInUSD : parseFloat(String(amountInUSD).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return String(amountInUSD);

    const rate = rates[currency] || 1;
    const converted = num * rate;

    if (currency === "FC") {
      // Franc Congolais : pas de centimes, arrondi entier
      return `${Math.round(converted).toLocaleString("fr-FR")} FC`;
    } else if (currency === "EUR") {
      // Euro : format français avec € à la fin
      const formatted = converted >= 1000 && converted % 1 === 0
        ? Math.round(converted).toLocaleString("fr-FR")
        : converted.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${formatted} €`;
    } else {
      // USD : format avec $
      const formatted = converted >= 1000 && converted % 1 === 0
        ? Math.round(converted).toLocaleString("fr-FR")
        : converted.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `$ ${formatted}`;
    }
  }, [currency, rates]);

  const contextValue = useMemo(
    () => ({ currency, setCurrency, formatPrice, convertPrice, rates }),
    [currency, setCurrency, formatPrice, convertPrice, rates]
  );

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);

