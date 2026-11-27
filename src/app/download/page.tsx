"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function DownloadAppPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/i.test(ua)) {
      setPlatform("ios");
    } else if (/Android/i.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any)?.standalone === true;
    setIsStandalone(Boolean(standalone));
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1D27] text-gray-100 pb-16">
      <header className="sticky top-0 z-40 bg-[#0B161E]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Retour sur Rayons.net</span>
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C7D300]">
            App Officielle
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#152836] to-[#0E1C26] border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden border border-[#C7D300]/35 shadow-xl shadow-[#C7D300]/10 bg-[#0F1D27] flex items-center justify-center">
            <img src="/icon.png" alt="Rayons.net" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/30 text-[#C7D300] text-[11px] font-bold">
              <Sparkles size={12} />
              <span>iPhone (Apple iOS) &amp; Android</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Installer l&apos;application Rayons.net
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 max-w-lg mx-auto leading-relaxed">
              Accédez en 1 clic à vos boutiques, commandes, livraisons et notifications Push directement depuis votre écran d&apos;accueil.
            </p>
          </div>

          {isStandalone && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <CheckCircle2 size={15} />
              <span>Application déjà installée sur cet appareil !</span>
            </div>
          )}
        </div>

        {/* Section iPhone / Apple iOS */}
        <section
          id="ios"
          className={`rounded-2xl p-6 border space-y-5 ${
            platform === "ios"
              ? "bg-white/[0.06] border-[#C7D300]/40 shadow-lg shadow-[#C7D300]/5"
              : "bg-white/[0.03] border-white/10"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 text-white shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Installer sur iPhone / iPad (Apple iOS)
                </h2>
                <p className="text-xs text-gray-400">
                  Installation officielle instantanée en mode plein écran (Web App iOS · 0 Mo de stockage lourd)
                </p>
              </div>
            </div>
            {platform === "ios" && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#C7D300] text-[#0F1D27] shrink-0">
                Votre appareil
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-black/25 border border-white/[0.07] rounded-xl p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-[#C7D300]/15 text-[#C7D300] font-extrabold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white">Ouvrez dans Safari</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Ouvrez <strong className="text-white">rayons.net</strong> dans le navigateur <strong className="text-white">Safari</strong> de votre iPhone.
              </p>
            </div>

            <div className="bg-black/25 border border-white/[0.07] rounded-xl p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-[#C7D300]/15 text-[#C7D300] font-extrabold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Share size={14} className="text-sky-400" />
                <span>Appuyez sur Partager</span>
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Touchez l&apos;icône <strong className="text-white">Partager</strong> (carré avec flèche vers le haut) en bas de Safari.
              </p>
            </div>

            <div className="bg-black/25 border border-white/[0.07] rounded-xl p-4 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-[#C7D300]/15 text-[#C7D300] font-extrabold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <PlusSquare size={14} className="text-emerald-400" />
                <span>Sur l&apos;écran d&apos;accueil</span>
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Choisissez <strong className="text-white">« Sur l&apos;écran d&apos;accueil »</strong> puis touchez <strong className="text-white">Ajouter</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
              <span>Fonctionne en plein écran avec notifications Push sur iOS 16.4+.</span>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs sm:text-sm font-extrabold transition-colors shrink-0"
            >
              <span>Ouvrir Rayons.net</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </section>

        {/* Section Android */}
        <section
          id="android"
          className={`rounded-2xl p-6 border space-y-4 ${
            platform === "android"
              ? "bg-white/[0.06] border-[#C7D300]/40 shadow-lg shadow-[#C7D300]/5"
              : "bg-white/[0.03] border-white/10"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 shrink-0">
                <Download size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Télécharger sur Android (APK Officiel)
                </h2>
                <p className="text-xs text-gray-400">
                  Téléchargement direct de l&apos;application Rayons pour smartphones Android
                </p>
              </div>
            </div>
            {platform === "android" && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#C7D300] text-[#0F1D27] shrink-0">
                Votre appareil
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/download/client-apk"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm transition-colors"
            >
              <Download size={16} />
              <span>Télécharger Rayons Client (Android)</span>
            </a>
            <a
              href="/download/driver-apk"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs sm:text-sm transition-colors"
            >
              <Download size={15} />
              <span>App Livreur (Android)</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
