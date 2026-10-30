"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Truck, Clock, HeartHandshake, ChevronRight, Star } from "lucide-react";
import Link from "next/link";

interface ClientBuyerProtectionBannerProps {
  /** Si true, affiche une version compacte (une seule ligne) */
  compact?: boolean;
  /** Callback optionnel pour ouvrir l'onglet tickets directement sans rechargement */
  onOpenTickets?: () => void;
}

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: "Paiement Protégé",
    desc: "Vos fonds sont sécurisés jusqu'à la livraison confirmée",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200/60",
    glow: "shadow-emerald-100",
  },
  {
    icon: Truck,
    title: "Livraison Garantie",
    desc: "Remboursement intégral si votre commande n'arrive pas",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200/60",
    glow: "shadow-blue-100",
  },
  {
    icon: Clock,
    title: "Support 7j/7",
    desc: "Une équipe dédiée disponible pour résoudre tout litige",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200/60",
    glow: "shadow-purple-100",
  },
  {
    icon: HeartHandshake,
    title: "Satisfaction Garantie",
    desc: "Contestez toute commande non conforme en 48h",
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-200/60",
    glow: "shadow-rose-100",
  },
];

export default function ClientBuyerProtectionBanner({ compact = false, onOpenTickets }: ClientBuyerProtectionBannerProps) {
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 via-white to-blue-50 border border-emerald-200/70 rounded-2xl text-xs overflow-x-auto scrollbar-none"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck size={14} />
          </div>
          <span className="font-extrabold text-emerald-800 whitespace-nowrap">
            Rayons Trade Assurance
          </span>
        </div>

        <div className="flex items-center gap-3 ml-2 overflow-x-auto scrollbar-none">
          {GUARANTEES.map((g, i) => {
            const Icon = g.icon;
            return (
              <span key={i} className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap border ${g.bg} ${g.color}`}>
                <Icon size={11} />
                {g.title}
              </span>
            );
          })}
        </div>

        {onOpenTickets ? (
          <button
            onClick={onOpenTickets}
            className="ml-auto shrink-0 flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            En savoir plus <ChevronRight size={13} />
          </button>
        ) : (
          <Link
            href="/dashboard/client?tab=tickets"
            className="ml-auto shrink-0 flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold transition-colors whitespace-nowrap"
          >
            En savoir plus <ChevronRight size={13} />
          </Link>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-[#0F1D27] via-[#1a3040] to-[#0d2534] text-white mb-5 shadow-lg shadow-emerald-900/10"
    >
      {/* Decorative background glows */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

      {/* Top badge header */}
      <div className="relative z-10 px-5 sm:px-7 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shadow-md shadow-emerald-900/30">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base sm:text-lg tracking-tight text-white">
                Rayons Trade Assurance
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Star size={9} fill="currentColor" /> Actif
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              Chaque achat sur Rayons.net est protégé par notre garantie commerciale exclusive
            </p>
          </div>
        </div>

        {onOpenTickets ? (
          <button
            onClick={onOpenTickets}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 shrink-0 cursor-pointer"
          >
            Aide &amp; Litiges <ChevronRight size={13} />
          </button>
        ) : (
          <Link
            href="/dashboard/client?tab=tickets"
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 shrink-0"
          >
            Aide &amp; Litiges <ChevronRight size={13} />
          </Link>
        )}
      </div>

      {/* Guarantees grid */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-white/10">
        {GUARANTEES.map((g, i) => {
          const Icon = g.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className={`flex flex-col items-center text-center px-4 py-5 gap-2 ${
                i < 2 ? "border-b sm:border-b-0 border-white/10" : ""
              }`}
            >
              <div className={`w-9 h-9 rounded-xl ${g.bg} border flex items-center justify-center shadow-md ${g.glow}`}>
                <Icon size={18} className={g.color} />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white/90 leading-tight">
                  {g.title}
                </div>
                <div className="text-[10px] text-white/45 mt-0.5 leading-relaxed hidden sm:block">
                  {g.desc}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
