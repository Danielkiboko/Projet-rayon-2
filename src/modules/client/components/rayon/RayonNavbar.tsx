"use client";

import { useState } from "react";
import Link from "next/link";
import { Home as HomeIcon, Wifi, Building2, Globe, Shirt, User, UtensilsCrossed, ShoppingBag, Menu, X, ArrowLeft } from "lucide-react";
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
    <header className="sticky top-2 z-50 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto bg-[#0F1D27]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/30 px-4 h-16 flex items-center justify-between gap-3 text-white">
        
        {/* Logo & Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 text-gray-300 hover:text-white lg:hidden rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <RayonsLogo rayon={category} size="md" href="/" />
        </div>

        {/* Desktop Categories Hub */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <HomeIcon size={14} /> 
            <span>{homeLabel}</span>
          </Link>
          
          <Link 
            href="/rayon/connect" 
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              category === 'connect' 
                ? 'bg-[#00B5A5] text-[#0F1D27] font-bold shadow-md shadow-[#00B5A5]/20' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Wifi size={14} className={category === 'connect' ? 'text-[#0F1D27]' : 'text-[#00B5A5]'} /> 
            <span>{connectLabel}</span>
          </Link>

          <Link 
            href="/rayon/immo" 
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              category === 'immo' 
                ? 'bg-[#4C6EF5] text-white font-bold shadow-md shadow-[#4C6EF5]/20' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Building2 size={14} className={category === 'immo' ? 'text-white' : 'text-[#4C6EF5]'} /> 
            <span>{immoLabel}</span>
          </Link>
          
          <Link 
            href="/rayon/mode" 
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              category === 'mode' 
                ? 'bg-[#D4B08C] text-[#0F1D27] font-bold shadow-md shadow-[#D4B08C]/20' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Shirt size={14} className={category === 'mode' ? 'text-[#0F1D27]' : 'text-[#D4B08C]'} /> 
            <span>{modeLabel}</span>
          </Link>

          <Link 
            href="/rayon/saveurs" 
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              category === 'saveurs' 
                ? 'bg-[#FF6B35] text-white font-bold shadow-md shadow-[#FF6B35]/20' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <UtensilsCrossed size={14} className={category === 'saveurs' ? 'text-white' : 'text-[#FF6B35]'} /> 
            <span>{saveursLabel}</span>
          </Link>
        </nav>

        {/* Right Utilities */}
        <div className="flex items-center gap-2 sm:gap-3">
          <CurrencySelector />

          <button 
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="hidden md:flex items-center px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <Globe size={13} className="mr-1 text-[#C7D300]" /> {lang.toUpperCase()}
          </button>

          <NotificationBell />

          {/* Cart Trigger */}
          <button
            onClick={openCart}
            className="relative p-2.5 text-white bg-white/10 hover:bg-[#C7D300] hover:text-[#0F1D27] rounded-xl border border-white/15 transition-all duration-200 group cursor-pointer shadow-md"
            title="Votre panier"
          >
            <ShoppingBag size={19} className="group-hover:scale-110 transition-transform" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF6B35] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0F1D27] shadow-sm animate-pulse">
                {totalItems}
              </span>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 rounded-xl transition-all"
              >
                <User size={14} className="text-[#C7D300]" />
                <span className="hidden sm:inline-block max-w-[110px] truncate">
                  {user.displayName || "Mon compte"}
                </span>
              </Link>
              <button 
                onClick={() => signOut()} 
                className="hidden md:block text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <Link 
              href="/login" 
              className="text-xs font-bold text-gray-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-3.5 py-2 rounded-xl transition-colors"
            >
              {t?.login || "Connexion"}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 max-w-7xl mx-auto bg-[#0F1D27]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 flex flex-col gap-1 shadow-2xl text-white animate-in slide-in-from-top-2 duration-200">
          {[
            { href: "/", icon: HomeIcon, label: homeLabel, color: "#C7D300", active: false },
            { href: "/rayon/connect", icon: Wifi, label: connectLabel, color: "#00B5A5", active: category === "connect" },
            { href: "/rayon/immo", icon: Building2, label: immoLabel, color: "#4C6EF5", active: category === "immo" },
            { href: "/rayon/mode", icon: Shirt, label: modeLabel, color: "#D4B08C", active: category === "mode" },
            { href: "/rayon/saveurs", icon: UtensilsCrossed, label: saveursLabel, color: "#FF6B35", active: category === "saveurs" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors text-sm ${
                item.active ? "bg-white/15 font-bold" : "hover:bg-white/10 font-medium text-gray-200"
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${item.color}20`, color: item.color }}
              >
                <item.icon size={16} />
              </div>
              <span>{item.label}</span>
            </Link>
          ))}
          <div className="border-t border-white/10 mt-2 pt-3 flex gap-2">
            <Link
              href="/supplier/register"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 py-2.5 text-center text-xs font-bold bg-[#C7D300] text-[#0F1D27] rounded-xl"
            >
              Devenir Fournisseur
            </Link>
            <button
              onClick={() => {
                setLang(lang === "fr" ? "en" : "fr");
                setMobileMenuOpen(false);
              }}
              className="py-2.5 px-4 text-center text-xs font-semibold bg-white/10 text-white rounded-xl"
            >
              {lang.toUpperCase()}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
