"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, LifeBuoy } from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for observability
    console.error("Rayons Global Runtime Exception:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0F1D27] text-white flex flex-col justify-between p-6 selection:bg-[#C7D300] selection:text-[#0F1D27]">
      {/* Header */}
      <header className="flex items-center justify-between max-w-7xl mx-auto w-full border-b border-white/10 pb-4">
        <Link href="/">
          <RayonsLogo className="h-8 w-auto text-white" />
        </Link>
        <span className="text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
          Système Sécurisé
        </span>
      </header>

      {/* Main Error Container */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="max-w-md w-full bg-white/5 border border-white/10 p-6 sm:p-8 rounded-3xl backdrop-blur-xl text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>

          <h2 className="text-2xl font-black text-white font-heading tracking-tight mb-2">
            Interruption Inattendue
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-6">
            Une erreur temporaire est survenue lors du chargement des données. Vos transactions et données de compte restent parfaitement en sécurité.
          </p>

          {process.env.NODE_ENV !== "production" && error.message && (
            <div className="text-left bg-black/40 border border-white/10 p-3 rounded-xl mb-6 overflow-x-auto text-[11px] font-mono text-rose-300">
              {error.message}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => reset()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#C7D300] hover:bg-[#b5bf00] text-[#0F1D27] font-bold text-sm transition-all shadow-lg shadow-[#C7D300]/20 cursor-pointer"
            >
              <RefreshCw size={16} />
              <span>Réessayer de charger la page</span>
            </button>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/10 transition-colors"
            >
              <Home size={14} />
              <span>Retour à la page d&apos;accueil</span>
            </Link>

            <Link
              href="/help"
              className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-gray-400 hover:text-white text-xs transition-colors"
            >
              <LifeBuoy size={14} />
              <span>Signaler au centre d&apos;assistance Rayons</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 border-t border-white/10 pt-4 max-w-7xl mx-auto w-full">
        Rayons Platform Health Protection System
      </footer>
    </div>
  );
}
