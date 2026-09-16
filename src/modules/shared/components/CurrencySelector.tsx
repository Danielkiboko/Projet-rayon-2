"use client";

import { useState, useRef, useEffect } from "react";
import { Coins, ChevronDown } from "lucide-react";
import { useCurrency, CurrencyCode } from "@/context/CurrencyContext";

interface CurrencySelectorProps {
  variant?: "light" | "dark";
  className?: string;
}

const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: "USD", label: "Dollar US", symbol: "$" },
  { code: "FC", label: "Franc Congolais", symbol: "FC" },
  { code: "EUR", label: "Euro", symbol: "€" },
];

export function CurrencySelector({ variant = "light", className = "" }: CurrencySelectorProps) {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDark = variant === "dark";

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer select-none ${
          isDark
            ? "bg-white/10 hover:bg-white/20 text-white border border-white/15"
            : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200/60 shadow-2xs"
        }`}
        title="Changer de devise (USD / FC / EUR)"
      >
        <Coins size={14} className={isDark ? "text-[#C7D300]" : "text-gray-600"} />
        <span>{current.code}</span>
        <span className={`text-[10px] font-semibold opacity-70`}>({current.symbol})</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-1.5 w-44 rounded-xl shadow-xl border py-1 z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? "bg-[#18181b] border-white/10 text-white shadow-black/60"
              : "bg-white border-gray-200 text-gray-800 shadow-gray-300/40"
          }`}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-white/5">
            Devise d'affichage
          </div>
          {CURRENCIES.map((c) => {
            const isSelected = currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors cursor-pointer text-left ${
                  isSelected
                    ? isDark
                      ? "bg-white/15 text-[#C7D300]"
                      : "bg-gray-100 text-[#0F1D27]"
                    : isDark
                    ? "hover:bg-white/5 text-gray-300"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-extrabold">{c.code}</span>
                  <span className="text-[11px] font-normal opacity-75">{c.label}</span>
                </div>
                <span className="font-extrabold opacity-90">{c.symbol}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

