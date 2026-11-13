"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

export function Footer() {
  const { user } = useAuth();

  return (
    <>
      <footer className="w-full bg-[#0F1D27] text-white py-14 mt-16 mb-16 sm:mb-0 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-center sm:text-left">
          {/* 1. Logo & Présentation */}
          <div className="flex flex-col items-center sm:items-start">
            <div className="mb-4">
              <RayonsLogo variant="dark" size="md" href="/" />
            </div>
            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-4">
              La marketplace unifiée de référence en République Démocratique du Congo. Commandez vos équipements, biens et services en toute sérénité avec paiement consigné et livraisons vérifiées.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
              <Link href="/rayon/connect" className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 transition-colors">
                Connect
              </Link>
              <Link href="/rayon/immo" className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-blue-300 border border-white/10 transition-colors">
                Immo
              </Link>
              <Link href="/rayon/mode" className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-amber-200 border border-white/10 transition-colors">
                Mode
              </Link>
              <Link href="/rayon/saveurs" className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-orange-300 border border-white/10 transition-colors">
                Saveurs
              </Link>
            </div>
          </div>

          {/* 2. Entreprise & Informations (About, Contact, Legal, Help) */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="font-heading font-bold text-sm mb-4 text-[#C7D300] uppercase tracking-wider">
              À propos &amp; Support
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
              <li>
                <Link href="/about" className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 justify-center sm:justify-start">
                  <span>ℹ️</span>
                  <span>À propos de Rayons</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 justify-center sm:justify-start">
                  <span>✉️</span>
                  <span>Contactez-nous</span>
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 justify-center sm:justify-start">
                  <span>❓</span>
                  <span>Centre d&apos;aide &amp; FAQ</span>
                </Link>
              </li>
              <li>
                <Link href="/legal" className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 justify-center sm:justify-start">
                  <span>📜</span>
                  <span>Mentions Légales &amp; Confidentialité</span>
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 justify-center sm:justify-start">
                  <span>📦</span>
                  <span>Suivi de commande</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Assistance & Canaux Directs */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="font-heading font-bold text-sm mb-4 text-[#C7D300] uppercase tracking-wider">
              Contact &amp; Assistance 7j/7
            </h3>
            <div className="space-y-3 text-xs sm:text-sm text-gray-300">
              <a 
                href="https://wa.me/243859180031?text=Bonjour%20Rayons,%20j%27ai%20besoin%20d%27assistance"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-medium text-xs"
              >
                <MessageCircle size={14} />
                <span>WhatsApp : +243 85 91 800 31</span>
              </a>
              <p className="flex items-center gap-2 justify-center sm:justify-start text-xs">
                <Phone size={13} className="text-[#C7D300]" />
                <span>Appel : </span>
                <a href="tel:+243859180031" className="hover:underline text-white font-medium">+243 85 91 800 31</a>
              </p>
              <p className="flex items-center gap-2 justify-center sm:justify-start text-xs">
                <Mail size={13} className="text-[#C7D300]" />
                <a href="mailto:contact@rayons.net" className="hover:underline text-gray-300">contact@rayons.net</a>
              </p>
              <p className="flex items-center gap-2 justify-center sm:justify-start text-xs text-gray-400">
                <MapPin size={13} className="text-[#C7D300]" />
                <span>Kinshasa (Gombe) &amp; Lubumbashi, RDC</span>
              </p>
            </div>
          </div>

          {/* 4. Espace Professionnel & Partenaires */}
          <div className="flex flex-col items-center sm:items-start">
            <h3 className="font-heading font-bold text-sm mb-4 text-[#C7D300] uppercase tracking-wider">
              Espace Professionnel
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Développez vos ventes et gérez vos stocks en direct sur Rayons.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[220px]">
              <Link 
                href="/supplier/register"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#C7D300] text-[#0F1D27] text-xs font-bold rounded-xl hover:bg-[#b5c000] transition-colors shadow-sm"
              >
                <span>Devenir Vendeur</span>
                <ArrowRight size={14} />
              </Link>
              <Link 
                href="/partner"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl border border-white/15 transition-colors"
              >
                <span>Espace Partenaires</span>
              </Link>
              <Link 
                href="/login"
                className="text-xs text-gray-400 hover:text-white transition-colors text-center mt-1 underline"
              >
                {user ? "Accéder à mon Dashboard" : "Connexion C-Panel"}
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-Footer avec liens directs explicites */}
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/10 text-center flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-xs">
            &copy; 2026 Rayons.net &mdash; Plateforme unifiée de commerce en République Démocratique du Congo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-gray-400">
            <Link href="/about" className="hover:text-white transition-colors">À propos</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            <Link href="/help" className="hover:text-white transition-colors">Aide &amp; FAQ</Link>
            <span className="text-white/20 hidden sm:inline">|</span>
            <Link href="/legal" className="text-[#C7D300] hover:underline transition-colors font-medium">
              Conditions d&apos;utilisation &amp; Confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
