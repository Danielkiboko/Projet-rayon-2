"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Save, Target, X } from "lucide-react";

export interface StaffGoalsFormState {
  monthlyRevenueTargetUSD: number;
  deliveryRateTargetPct: number;
  supportResolutionTargetPct: number;
  catalogueApprovalTargetPct: number;
  monthlyNewSignupsTarget: number;
}

interface StaffGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalsForm: StaffGoalsFormState;
  setGoalsForm: React.Dispatch<React.SetStateAction<StaffGoalsFormState>>;
  savingGoals: boolean;
  onSaveGoals: (e: React.FormEvent) => void;
}

export function StaffGoalsModal({
  isOpen,
  onClose,
  goalsForm,
  setGoalsForm,
  savingGoals,
  onSaveGoals,
}: StaffGoalsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-[#C7D300]" />
                <h3 className="text-base font-bold text-white">Objectifs Mensuels du Team</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSaveGoals} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Objectif Encaissements du mois (USD)
                </label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={goalsForm.monthlyRevenueTargetUSD}
                  onChange={(e) =>
                    setGoalsForm((f) => ({ ...f, monthlyRevenueTargetUSD: Number(e.target.value) }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white text-sm font-bold focus:outline-hidden focus:border-[#C7D300]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Cible Livraison (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={goalsForm.deliveryRateTargetPct}
                    onChange={(e) =>
                      setGoalsForm((f) => ({ ...f, deliveryRateTargetPct: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white text-sm font-bold focus:outline-hidden focus:border-[#C7D300]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Cible Résolution SAV (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={goalsForm.supportResolutionTargetPct}
                    onChange={(e) =>
                      setGoalsForm((f) => ({ ...f, supportResolutionTargetPct: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white text-sm font-bold focus:outline-hidden focus:border-[#C7D300]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Cible Approbation Cat. (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={goalsForm.catalogueApprovalTargetPct}
                    onChange={(e) =>
                      setGoalsForm((f) => ({ ...f, catalogueApprovalTargetPct: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white text-sm font-bold focus:outline-hidden focus:border-[#C7D300]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Objectif Inscriptions / mois
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={goalsForm.monthlyNewSignupsTarget}
                    onChange={(e) =>
                      setGoalsForm((f) => ({ ...f, monthlyNewSignupsTarget: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white text-sm font-bold focus:outline-hidden focus:border-[#C7D300]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingGoals}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-extrabold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Save size={14} />
                  <span>{savingGoals ? "Enregistrement..." : "Enregistrer"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
