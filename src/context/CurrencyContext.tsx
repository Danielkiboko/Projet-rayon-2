"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

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

  // Listen to live platform settings from Firestore for dynamic exchange rates
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, "settings", "platform"), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const fcRate = Number(data.usdToFcRate || data.exchangeRateFC);
          const eurRate = Number(data.usdToEurRate || data.exchangeRateEUR);
          setRates({
            USD: 1,
            FC: fcRate && fcRate > 0 ? fcRate : DEFAULT_RATES.FC,
            EUR: eurRate && eurRate > 0 ? eurRate : DEFAULT_RATES.EUR,
          });
        }
      }, () => {
        // Fallback silently to default rates on error
      });
      return () => unsub();
    } catch {
      // Firestore initialization fallback
    }
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("rayon_currency", c);
    } catch {}
  };

  const convertPrice = (amountInUSD: number | string | null | undefined): number => {
    if (amountInUSD === null || amountInUSD === undefined || amountInUSD === "") return 0;
    const num = typeof amountInUSD === "number" ? amountInUSD : parseFloat(String(amountInUSD).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return 0;

    const rate = rates[currency] || 1;
    return num * rate;
  };

  const formatPrice = (amountInUSD: number | string | null | undefined): string => {
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
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, convertPrice, rates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);

