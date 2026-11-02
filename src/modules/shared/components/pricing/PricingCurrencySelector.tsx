"use client";

import React from "react";
import { CurrencyCode } from "@/context/CurrencyContext";

interface PricingCurrencySelectorProps {
  inputCurrency: CurrencyCode;
  setInputCurrency: (c: CurrencyCode) => void;
  rates?: { FC?: number; EUR?: number };
  description?: string;
}

export default function PricingCurrencySelector({
  inputCurrency,
  setInputCurrency,
  rates,
  description = "Indiquez vos prix dans la devise de votre choix. Le catalogue client s'ajustera automatiquement en direct.",
}: PricingCurrencySelectorProps) {
  const currencies: CurrencyCode[] = ["USD", "FC", "EUR"];

  return (
    <div className="p-3.5 bg-[#0F1D27] border border-[#C7D300]/30 rounded-xl space-y-2.5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Devise de tarification
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#C7D300] text-[#0F1D27]">
              {inputCurrency === "USD"
                ? "$ Dollar US"
                : inputCurrency === "FC"
                ? "FC Franc Congolais"
                : "€ Euro"}
            </span>
          </div>
          <p className="text-[11px] text-gray-300 mt-0.5">{description}</p>
        </div>

        {/* Choix devise : USD / FC / EUR */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setInputCurrency(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                inputCurrency === c
                  ? "bg-[#C7D300] text-[#0F1D27] shadow-md"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {c === "USD" ? "$ USD" : c === "FC" ? "FC (CDF)" : "€ EUR"}
            </button>
          ))}
        </div>
      </div>

      {/* Taux plateforme informatif */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/10 text-[11px] text-gray-400">
        <span>
          Taux actif :{" "}
          <strong className="text-[#C7D300]">
            1 $ USD = {(rates?.FC || 2850).toLocaleString("fr-FR")} FC
          </strong>{" "}
          | <strong className="text-[#C7D300]">1 $ USD = {rates?.EUR || 0.92} €</strong>
        </span>
        {inputCurrency !== "USD" && (
          <span className="text-amber-400 font-medium">
            Conversion automatique vers USD ($) à l&apos;enregistrement
          </span>
        )}
      </div>
    </div>
  );
}
