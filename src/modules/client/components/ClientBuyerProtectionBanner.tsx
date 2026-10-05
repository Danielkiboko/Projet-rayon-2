"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Truck, RotateCcw, Headphones, Lock } from "lucide-react";

export default function ClientBuyerProtectionBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-2xl bg-gradient-to-r from-[#0F1D27] via-[#162A38] to-[#0F1D27] border border-[#C7D300]/30 p-4 sm:p-5 text-white shadow-lg relative overflow-hidden"
    >
      {/* Decorative background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#C7D300]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Brand and Guarantee Title */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C7D300]/15 border border-[#C7D300]/30 text-[#C7D300] text-xs font-bold tracking-wide uppercase mb-2.5">
            <ShieldCheck size={14} className="shrink-0" />
            Rayons Trade Assurance
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Vos achats et transactions sont protégés à 100%
          </h3>
          <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
            De la commande au déballage, chaque transaction sur Rayons.net bénéficie de la protection acheteur certifiée : fonds séquestrés, livreurs vérifiés et assistance dédiée.
          </p>
        </div>

        {/* Right Side: 3 Key Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-lg bg-[#C7D300]/20 text-[#C7D300] flex items-center justify-center shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Paiement Sécurisé</div>
              <div className="text-[11px] text-gray-400">Mobile Money & Visa</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Truck size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Suivi GPS Direct</div>
              <div className="text-[11px] text-gray-400">Livreur en temps réel</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Headphones size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Médiation 7j/7</div>
              <div className="text-[11px] text-gray-400">Service client direct</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
