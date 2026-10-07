import Link from "next/link";
import { Search, Home, HelpCircle, ArrowLeft, Shield } from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0F1D27] text-white flex flex-col justify-between selection:bg-[#C7D300] selection:text-[#0F1D27]">
      {/* Header */}
      <header className="p-6 border-b border-white/10 flex items-center justify-between max-w-7xl mx-auto w-full">
        <RayonsLogo href="/" size="md" variant="dark" />
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Retour à l&apos;accueil</span>
        </Link>
      </header>

      {/* Main 404 Hero */}
      <main className="flex-1 flex items-center justify-center p-6 my-8">
        <div className="max-w-xl w-full text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/25 text-[#C7D300] text-xs font-bold tracking-wider uppercase mb-6">
            <span>Erreur 404 • Page introuvable</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-4 font-heading text-white">
            Rayon <span className="text-[#C7D300]">Inexistant</span>
          </h1>

          <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
            La page ou le produit que vous cherchez a peut-être été déplacé, supprimé ou l&apos;adresse saisie est incorrecte.
          </p>

          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
            <Link
              href="/"
              className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#C7D300]/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#C7D300]/10 text-[#C7D300] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Home size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-0.5">Accueil</h3>
              <p className="text-[11px] text-gray-400">Tous les rayons & services</p>
            </Link>

            <Link
              href="/rayon/immo"
              className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Shield size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-0.5">Immobilier</h3>
              <p className="text-[11px] text-gray-400">Locations & Hôtels certifiés</p>
            </Link>

            <Link
              href="/help"
              className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <HelpCircle size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-0.5">Assistance</h3>
              <p className="text-[11px] text-gray-400">Tickets & Centre d&apos;aide</p>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#C7D300] hover:bg-[#b5bf00] text-[#0F1D27] font-bold text-sm transition-all shadow-lg shadow-[#C7D300]/15"
            >
              Explorer les Rayons
            </Link>
            <Link
              href="/help"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition-colors"
            >
              Contacter le support
            </Link>
          </div>
        </div>
      </main>

      {/* Footer minimal */}
      <footer className="p-6 border-t border-white/10 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Rayons.net — La marketplace de référence. Tous droits réservés.
      </footer>
    </div>
  );
}
