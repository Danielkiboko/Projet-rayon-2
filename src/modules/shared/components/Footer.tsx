"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { TrendingUp, MessageCircle, User, ArrowRight } from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

export function Footer() {
  const { user } = useAuth();
  const { toggleChat } = useChat();

  return (
    <>
      {/* Footer / Accès Admin & Partenaires */}
      <footer className="w-full bg-[#0F1D27] text-white py-14 mt-16 mb-16 sm:mb-0 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10 text-center md:text-left">
          {/* Logo & Description */}
          <div className="flex flex-col items-center md:items-start md:col-span-2">
            <div className="mb-4">
              <RayonsLogo variant="dark" size="md" href="/" />
            </div>
            <p className="text-gray-300 text-sm max-w-md leading-relaxed">
              Rayons.net, une identité unifiée, quatre expertises complémentaires.
              Tout ce dont vous avez besoin, en un seul endroit.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10 font-medium">Rayons Connect</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10 font-medium">Rayons Immo</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10 font-medium">Rayons Mode</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10 font-medium">Rayons Saveurs</span>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-heading font-bold text-base mb-4 text-[#C7D300] uppercase tracking-wider">Contact & Support</h3>
            <div className="space-y-2.5 text-sm text-gray-300">
              <p className="flex items-center gap-2 justify-center md:justify-start">
                <span>📞</span> +243 85 91 800 31
              </p>
              <p className="flex items-center gap-2 justify-center md:justify-start">
                <span>✉️</span> contact@rayons.net
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Kinshasa, République Démocratique du Congo
              </p>
            </div>
          </div>

          {/* Admin & Liens */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-heading font-bold text-base mb-4 text-[#C7D300] uppercase tracking-wider">Espace Pro</h3>
            <p className="text-xs text-gray-400 mb-3">Accédez à votre console de gestion et cPanel.</p>
            <Link 
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C7D300] text-[#0F1D27] text-sm font-bold rounded-xl hover:bg-[#b5c000] transition-colors shadow-sm"
            >
              <span>{user ? "Accéder à mon Dashboard" : "Connexion C-Panel"}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/10 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-xs">© 2026 Rayons.net. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <Link href="/rayon/connect" className="hover:text-[#00B5A5] transition-colors">Connect</Link>
            <Link href="/rayon/immo" className="hover:text-[#4C6EF5] transition-colors">Immo & Hôtels</Link>
            <Link href="/rayon/mode" className="hover:text-[#D4B08C] transition-colors">Mode</Link>
            <Link href="/rayon/saveurs" className="hover:text-[#FF6B35] transition-colors">Saveurs</Link>
            <span className="text-white/20 hidden sm:inline">|</span>
            <Link href="/legal" className="text-[#C7D300] hover:underline transition-colors font-medium">Conditions d'utilisation & Confidentialité</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-safe sm:hidden z-50">
        <div className="flex justify-around p-3">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-900">
            <div className="p-1"><TrendingUp size={24} /></div>
            <span className="text-[10px] font-bold">Explorer</span>
          </Link>
          <button onClick={toggleChat} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors relative">
            <div className="p-1"><MessageCircle size={24} /></div>
            <span className="text-[10px] font-bold">Chat</span>
          </button>
          <Link href="/login" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
            <div className="p-1"><User size={24} /></div>
            <span className="text-[10px] font-bold">Menu</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
