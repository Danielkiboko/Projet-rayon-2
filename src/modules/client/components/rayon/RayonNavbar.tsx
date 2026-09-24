"use client";

import { useState } from "react";
import Link from "next/link";
import { Home as HomeIcon, Wifi, Building2, Globe, Shirt, User, UtensilsCrossed, ShoppingBag, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import NotificationBell from "@/modules/shared/components/notifications/NotificationBell";
import { CurrencySelector } from "@/modules/shared/components/CurrencySelector";

interface RayonNavbarProps {
  category: "immo" | "mode" | "connect" | "saveurs";
  lang: "fr" | "en";
  setLang: (lang: "fr" | "en") => void;
  t: any;
}

const cleanLabel = (text?: string, fallback: string = ""): string => {
  if (!text) return fallback;
  return text.replace(/^Rayons?\s+/i, "").trim() || fallback;
};

export function RayonNavbar({ category, lang, setLang, t }: RayonNavbarProps) {
  const { user, signOut } = useAuth();
  const { totalItems, openCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const homeLabel = t?.home || "Accueil";
  const connectLabel = cleanLabel(t?.connect, "Connect");
  const immoLabel = cleanLabel(t?.immo, "Immo");
  const modeLabel = cleanLabel(t?.mode, "Mode");
  const saveursLabel = cleanLabel(t?.saveurs, "Saveurs");

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <nav className="flex items-center justify-between p-4 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <RayonsLogo rayon={category} size="md" href="/" />
        </div>
        
        <div className="hidden lg:flex items-center space-x-1 bg-gray-50/80 p-1 rounded-full border border-gray-100">
          <Link href="/" className="flex items-center px-4 py-2 hover:bg-white rounded-full text-sm font-medium text-gray-600 hover:text-[#0F1D27] transition-all">
            <HomeIcon size={16} className="mr-2" /> {homeLabel}
          </Link>
          
          <Link 
            href="/rayon/connect" 
            className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              category === 'connect' 
                ? 'bg-white text-[#00B5A5] shadow-xs' 
                : 'text-gray-600 hover:text-[#00B5A5] hover:bg-white/60'
            }`}
          >
            <Wifi size={16} className="mr-2 text-[#00B5A5]" /> {connectLabel}
          </Link>

          <Link 
            href="/rayon/immo" 
            className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              category === 'immo' 
                ? 'bg-white text-[#4C6EF5] shadow-xs' 
                : 'text-gray-600 hover:text-[#4C6EF5] hover:bg-white/60'
            }`}
          >
            <Building2 size={16} className="mr-2 text-[#4C6EF5]" /> {immoLabel}
          </Link>
          
          <Link 
            href="/rayon/mode" 
            className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              category === 'mode' 
                ? 'bg-white text-[#D4B08C] shadow-xs' 
                : 'text-gray-600 hover:text-[#D4B08C] hover:bg-white/60'
            }`}
          >
            <Shirt size={16} className="mr-2 text-[#D4B08C]" /> {modeLabel}
          </Link>

          <Link 
            href="/rayon/saveurs" 
            className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              category === 'saveurs' 
                ? 'bg-white text-[#FF6B35] shadow-xs' 
                : 'text-gray-600 hover:text-[#FF6B35] hover:bg-white/60'
            }`}
          >
            <UtensilsCrossed size={16} className="mr-2 text-[#FF6B35]" /> {saveursLabel}
          </Link>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Currency Selector (USD, FC, EUR) */}
          <CurrencySelector />

          <div className="hidden md:flex items-center space-x-2">
            <button 
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className="flex items-center px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Globe size={14} className="mr-1" /> {lang.toUpperCase()}
            </button>
          </div>

          {/* Real-time In-App Notification Bell */}
          <NotificationBell />

          {/* Cart Button */}
          <button
            onClick={openCart}
            className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Votre panier"
          >
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#C7D300] text-[#0F1D27] text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {totalItems}
              </span>
            )}
          </button>

          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/dashboard" className="flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-full">
                <User size={18} />
                {user.displayName || "Mon compte"}
              </Link>
              <button onClick={() => signOut()} className="text-sm font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-2 rounded-full">
                Déconnexion
              </button>
            </div>
          ) : (
            <Link href="/login" className="hidden sm:flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-full">
              <User size={18} />
              {t.login}
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1 shadow-md">
          {[
            { href: "/", icon: HomeIcon, label: homeLabel, color: "#0F1D27", active: false },
            { href: "/rayon/connect", icon: Wifi, label: connectLabel, color: "#00B5A5", active: category === "connect" },
            { href: "/rayon/immo", icon: Building2, label: immoLabel, color: "#4C6EF5", active: category === "immo" },
            { href: "/rayon/mode", icon: Shirt, label: modeLabel, color: "#D4B08C", active: category === "mode" },
            { href: "/rayon/saveurs", icon: UtensilsCrossed, label: saveursLabel, color: "#FF6B35", active: category === "saveurs" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                item.active ? "bg-gray-100 font-bold" : "hover:bg-gray-50 font-medium text-gray-700"
              }`}
            >
              <item.icon size={18} style={{ color: item.color }} />
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

