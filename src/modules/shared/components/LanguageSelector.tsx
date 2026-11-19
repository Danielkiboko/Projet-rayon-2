"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useLanguage, LanguageCode } from "@/context/LanguageContext";

interface LanguageSelectorProps {
  variant?: "light" | "dark";
  className?: string;
}

const LANGUAGES: { code: LanguageCode; short: string; label: string; flag: string }[] = [
  { code: "fr", short: "FR", label: "Français", flag: "🇫🇷" },
  { code: "en", short: "EN", label: "English", flag: "🇬🇧" },
  { code: "zh", short: "中文", label: "中文 (Chinois)", flag: "🇨🇳" },
];

export function LanguageSelector({ variant = "dark", className = "" }: LanguageSelectorProps) {
  const { lang, setLang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

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
    <div ref={containerRef} data-no-translate="true" className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
          isDark
            ? "bg-white/10 hover:bg-white/20 text-white border border-white/15"
            : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200/60 shadow-2xs"
        }`}
        title="Changer de langue (Français / English / 中文)"
      >
        <Globe size={13} className={`hidden sm:block ${isDark ? "text-[#C7D300]" : "text-gray-600"}`} />
        <span>{current.flag}</span>
        <span>{current.short}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-1.5 w-44 max-w-[calc(100vw-1.5rem)] rounded-xl shadow-xl border py-1 z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? "bg-[#14222D] border-white/15 text-white shadow-black/60"
              : "bg-white border-gray-200 text-gray-800 shadow-gray-300/40"
          }`}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-white/10">
            {t("nav.language", "Langue")}
          </div>
          {LANGUAGES.map((item) => {
            const isSelected = lang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLang(item.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors cursor-pointer text-left ${
                  isSelected
                    ? isDark
                      ? "bg-white/15 text-[#C7D300]"
                      : "bg-gray-100 text-[#0F1D27]"
                    : isDark
                    ? "hover:bg-white/5 text-gray-200"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{item.flag}</span>
                  <span>{item.label}</span>
                </div>
                {isSelected && <Check size={13} className={isDark ? "text-[#C7D300]" : "text-[#0F1D27]"} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
