"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Check, ThumbsUp, Sparkles, ArrowRight } from "lucide-react";

interface ValidationSuccessViewProps {
  /** Titre principal (par défaut : "C'est fait !") */
  title?: string;
  /** Message détaillant la validation ou la modification effectuée */
  message: string;
  /** Sous-titre ou badge optionnel */
  badgeLabel?: string;
  /** Fonction appelée automatiquement après le délai ou au clic sur le bouton */
  onDone: () => void;
  /** Durée d'affichage automatique en ms (par défaut 2500ms, 0 pour désactiver l'auto-fermeture) */
  autoHideMs?: number;
  /** Libellé du bouton d'action (par défaut : "Continuer") */
  actionLabel?: string;
}

/**
 * Vue de confirmation visuelle qui remplace temporairement un tableau ou un formulaire
 * après une validation ou une modification réussie.
 */
export default function ValidationSuccessView({
  title = "C'est fait !",
  message,
  badgeLabel = "Validation & Modification Enregistrées",
  onDone,
  autoHideMs = 2600,
  actionLabel = "Continuer",
}: ValidationSuccessViewProps) {
  useEffect(() => {
    if (!autoHideMs || autoHideMs <= 0) return;
    const timer = setTimeout(() => {
      onDone();
    }, autoHideMs);
    return () => clearTimeout(timer);
  }, [autoHideMs, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="w-full py-12 px-6 bg-[#0F1D27] border border-emerald-500/25 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden my-4"
    >
      {/* Lueurs d'arrière-plan */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-[#C7D300]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Icône centrale animée : Signe "Très Bien" + Check de validation */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Onde pulsante externe */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0.8 }}
          animate={{ scale: 1.55, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          className="absolute w-24 h-24 rounded-full bg-emerald-500/25 pointer-events-none"
        />

        {/* Second anneau lumineux */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-[#C7D300]/20 border-2 border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/20"
        >
          {/* Cercle central */}
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.08 }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-[#08131A] flex items-center justify-center shadow-md"
          >
            <Check size={36} strokeWidth={3.5} className="text-[#08131A]" />
          </motion.div>
        </motion.div>

        {/* Pastille "Très bien" (Pouce levé) en coin */}
        <motion.div
          initial={{ scale: 0, y: 8 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 15, delay: 0.2 }}
          className="absolute -bottom-1 -right-2 w-10 h-10 rounded-2xl bg-[#C7D300] text-[#0F1D27] border-2 border-[#0F1D27] flex items-center justify-center shadow-lg"
          title="Très bien !"
        >
          <ThumbsUp size={18} strokeWidth={2.6} />
        </motion.div>
      </div>

      {/* Badge supérieur */}
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 mb-3"
      >
        <Sparkles size={12} className="text-[#C7D300]" />
        <span>{badgeLabel}</span>
      </motion.span>

      {/* Titre percutant */}
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2"
      >
        {title}
      </motion.h3>

      {/* Description de ce qui a été validé ou modifié */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="text-sm text-gray-300 max-w-md leading-relaxed mb-7"
      >
        {message}
      </motion.p>

      {/* Bouton pour revenir immédiatement au tableau */}
      <motion.button
        type="button"
        onClick={onDone}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-extrabold text-xs sm:text-sm shadow-lg shadow-[#C7D300]/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
      >
        <span>{actionLabel}</span>
        <ArrowRight size={15} />
      </motion.button>

      {/* Barre de progression avant retour automatique */}
      {autoHideMs > 0 && (
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-6">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: autoHideMs / 1000, ease: "linear" }}
            className="h-full bg-gradient-to-r from-emerald-400 to-[#C7D300]"
          />
        </div>
      )}
    </motion.div>
  );
}
