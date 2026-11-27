"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Award, Plus, ShieldCheck, Sliders, X } from "lucide-react";
import { ADJUSTMENT_REASONS } from "@/lib/accountingLedger";
import { PAYMENT_CHANNELS } from "./financeHelpers";

export interface FinanceModalsProps {
  isSuperAdmin: boolean;
  currentBalance: number;
  // Modal 1: Subscription payment
  paymentTargetSupplier: any;
  setPaymentTargetSupplier: (v: any) => void;
  targetAlreadyActive: boolean;
  targetSubInfo: any;
  subChannel: string;
  setSubChannel: (v: string) => void;
  subAmount: string;
  setSubAmount: (v: string) => void;
  subRef: string;
  setSubRef: (v: string) => void;
  subNote: string;
  setSubNote: (v: string) => void;
  isSubmittingSub: boolean;
  onConfirmSubscriptionPayment: (e: React.FormEvent) => void;
  // Modal 2: Manual entry
  isTxModalOpen: boolean;
  setIsTxModalOpen: (v: boolean) => void;
  txKind: "OTHER_INCOME" | "EXPENSE";
  setTxKind: (v: "OTHER_INCOME" | "EXPENSE") => void;
  txAmount: string;
  setTxAmount: (v: string) => void;
  txDescription: string;
  setTxDescription: (v: string) => void;
  txReference: string;
  setTxReference: (v: string) => void;
  isSubmittingTx: boolean;
  onSaveManualEntry: (e: React.FormEvent) => void;
  // Modal 3: Cash adjustment
  isAdjustmentModalOpen: boolean;
  setIsAdjustmentModalOpen: (v: boolean) => void;
  adjType: "ADD" | "SUBTRACT";
  setAdjType: (v: "ADD" | "SUBTRACT") => void;
  adjAmount: string;
  setAdjAmount: (v: string) => void;
  adjReason: string;
  setAdjReason: (v: string) => void;
  adjLabel: string;
  setAdjLabel: (v: string) => void;
  adjRef: string;
  setAdjRef: (v: string) => void;
  isSubmittingAdj: boolean;
  onSaveAdjustment: (e: React.FormEvent) => void;
  // Modal 4: Credit commission
  isCommissionModalOpen: boolean;
  setIsCommissionModalOpen: (v: boolean) => void;
  partners: any[];
  selectedPartnerId: string;
  setSelectedPartnerId: (v: string) => void;
  commissionAmount: string;
  setCommissionAmount: (v: string) => void;
  commissionReason: string;
  setCommissionReason: (v: string) => void;
  isSubmittingCommission: boolean;
  onCreditCommissionSubmit: (e: React.FormEvent) => void;
  // Modal 5: Financial settings proposal
  isProposalModalOpen: boolean;
  setIsProposalModalOpen: (v: boolean) => void;
  formUsdRate: string;
  setFormUsdRate: (v: string) => void;
  formCommission: string;
  setFormCommission: (v: string) => void;
  formSubscription: string;
  setFormSubscription: (v: string) => void;
  formPromo: string;
  setFormPromo: (v: string) => void;
  formReason: string;
  setFormReason: (v: string) => void;
  isSubmittingProposal: boolean;
  onProposeChangeSubmit: (e: React.FormEvent) => void;
  // Modal 6: Reject proposal
  isRejectModalOpen: boolean;
  setIsRejectModalOpen: (v: boolean) => void;
  rejectionReason: string;
  setRejectionReason: (v: string) => void;
  onRejectProposalSubmit: (e: React.FormEvent) => void;
}

export function FinanceModals(p: FinanceModalsProps) {
  return (
    <>
      <AnimatePresence>
        {p.paymentTargetSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>Enregistrer un Paiement d&apos;Abonnement</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {p.paymentTargetSupplier.displayName || p.paymentTargetSupplier.email}
                  </p>
                </div>
                <button onClick={() => p.setPaymentTargetSupplier(null)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={p.onConfirmSubscriptionPayment} className="p-6 space-y-4">
                {p.targetAlreadyActive && p.targetSubInfo && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Attention :</strong> ce fournisseur est <strong>déjà actif</strong> jusqu&apos;au{" "}
                      <strong>{p.targetSubInfo.formattedDueDate}</strong>. Ne validez que si vous avez effectivement reçu une avance supplémentaire (+30 jours).
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Canal de paiement *</label>
                    <select value={p.subChannel} onChange={(e) => p.setSubChannel(e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-white/25">
                      {PAYMENT_CHANNELS.map((c) => <option key={c} value={c} className="bg-[#0F1D27]">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant reçu ($ USD) *</label>
                    <input type="number" step="0.01" min="1" required value={p.subAmount} onChange={(e) => p.setSubAmount(e.target.value)} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:border-white/25" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Référence unique de transaction / Reçu *</label>
                  <input type="text" required minLength={3} value={p.subRef} onChange={(e) => p.setSubRef(e.target.value)} placeholder="ex: MP261123.1420.A123 ou REC-CAISSE-042" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#C7D300]/60 placeholder:text-gray-600" />
                  <p className="text-[10px] text-gray-500 mt-1">Verrou anti-doublon : une même référence ne peut jamais être encaissée deux fois.</p>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Note interne (optionnel)</label>
                  <input type="text" value={p.subNote} onChange={(e) => p.setSubNote(e.target.value)} placeholder="ex: Paiement mensuel décembre validé par la caisse" className="w-full px-3.5 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600" />
                </div>
                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => p.setPaymentTargetSupplier(null)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" disabled={p.isSubmittingSub} className="px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
                    {p.isSubmittingSub ? "Validation atomique..." : `Confirmer $${p.subAmount || 0} (+30j)`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus size={16} className="text-[#C7D300]" />
                    <span>Nouvelle Écriture Plateforme</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Enregistrée de façon immuable dans le Grand Livre Rayons.net</p>
                </div>
                <button onClick={() => p.setIsTxModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer"><X size={18} /></button>
              </div>
              <form onSubmit={p.onSaveManualEntry} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => p.setTxKind("OTHER_INCOME")} className={`py-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${p.txKind === "OTHER_INCOME" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-white/[0.04] text-gray-400 border-white/10"}`}>+ Recette Plateforme</button>
                  <button type="button" disabled={!p.isSuperAdmin} onClick={() => p.setTxKind("EXPENSE")} title={!p.isSuperAdmin ? "Réservé au Directeur Général (Super Admin)" : ""} className={`py-2.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${p.txKind === "EXPENSE" ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-white/[0.04] text-gray-400 border-white/10"}`}>- Dépense {!p.isSuperAdmin && "(DG)"}</button>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input type="number" step="0.01" min="0.01" required value={p.txAmount} onChange={(e) => p.setTxAmount(e.target.value)} placeholder="50.00" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Libellé comptable *</label>
                  <input type="text" required minLength={3} value={p.txDescription} onChange={(e) => p.setTxDescription(e.target.value)} placeholder="ex: Hébergement serveur cloud / Sponsoring campagne" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">N° Pièce justificative</label>
                  <input type="text" value={p.txReference} onChange={(e) => p.setTxReference(e.target.value)} placeholder="ex: FACT-2026-014" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white font-mono text-xs placeholder:text-gray-600" />
                </div>
                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => p.setIsTxModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" disabled={p.isSubmittingTx} className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{p.isSubmittingTx ? "Enregistrement..." : "Valider l'Écriture"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isAdjustmentModalOpen && p.isSuperAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-lg bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="text-[#C7D300]" size={15} />
                    <span>Ajustement de Caisse (Direction Générale)</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Solde actuel : <span className="text-white font-semibold tabular-nums">${p.currentBalance.toFixed(2)}</span> · Audité dans audit_logs</p>
                </div>
                <button onClick={() => p.setIsAdjustmentModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer"><X size={18} /></button>
              </div>
              <form onSubmit={p.onSaveAdjustment} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => p.setAdjType("ADD")} className={`py-2.5 rounded-lg text-xs font-bold border cursor-pointer ${p.adjType === "ADD" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-white/[0.04] text-gray-400 border-white/10"}`}>+ Entrée / Apport</button>
                  <button type="button" onClick={() => p.setAdjType("SUBTRACT")} className={`py-2.5 rounded-lg text-xs font-bold border cursor-pointer ${p.adjType === "SUBTRACT" ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-white/[0.04] text-gray-400 border-white/10"}`}>- Sortie / Prélèvement</button>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input type="number" step="0.01" min="0.01" required value={p.adjAmount} onChange={(e) => p.setAdjAmount(e.target.value)} placeholder="50.00" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Motif *</label>
                  <select value={p.adjReason} onChange={(e) => p.setAdjReason(e.target.value)} className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs">
                    {ADJUSTMENT_REASONS.map((r) => <option key={r} value={r} className="bg-[#0F1D27]">{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Libellé précis *</label>
                  <input type="text" required minLength={3} value={p.adjLabel} onChange={(e) => p.setAdjLabel(e.target.value)} placeholder="ex: Régularisation inventaire coffre central" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">N° Pièce justificative</label>
                  <input type="text" value={p.adjRef} onChange={(e) => p.setAdjRef(e.target.value)} placeholder="ex: REC-INV-2026-01" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white font-mono text-xs placeholder:text-gray-600" />
                </div>
                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => p.setIsAdjustmentModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" disabled={p.isSubmittingAdj} className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{p.isSubmittingAdj ? "Enregistrement..." : "Valider l'Ajustement"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isCommissionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="text-[#C7D300]" size={16} />
                  <span>Créditer une Commission Partenaire</span>
                </h2>
                <button onClick={() => p.setIsCommissionModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer"><X size={18} /></button>
              </div>
              <form onSubmit={p.onCreditCommissionSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Partenaire *</label>
                  <select value={p.selectedPartnerId} onChange={(e) => p.setSelectedPartnerId(e.target.value)} required className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs">
                    <option value="">Sélectionnez un partenaire</option>
                    {p.partners.map((pt) => <option key={pt.id} value={pt.id} className="bg-[#0F1D27]">{pt.displayName} ({pt.referralCode} · Solde: ${Number(pt.balance || 0).toFixed(2)})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant ($ USD) *</label>
                  <input type="number" step="0.01" min="0.5" required value={p.commissionAmount} onChange={(e) => p.setCommissionAmount(e.target.value)} placeholder="25.00" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Motif *</label>
                  <input type="text" required value={p.commissionReason} onChange={(e) => p.setCommissionReason(e.target.value)} placeholder="ex: Prime apport 5 nouvelles boutiques" className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600" />
                </div>
                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => p.setIsCommissionModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" disabled={p.isSubmittingCommission} className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{p.isSubmittingCommission ? "Enregistrement..." : "Créditer"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isProposalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-lg bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <h2 className="text-sm font-bold text-white">{p.isSuperAdmin ? "Modifier les Paramètres Financiers" : "Proposer une Modification Financière"}</h2>
                <button onClick={() => p.setIsProposalModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer"><X size={18} /></button>
              </div>
              <form onSubmit={p.onProposeChangeSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Taux USD / CDF *</label>
                    <input type="number" required value={p.formUsdRate} onChange={(e) => p.setFormUsdRate(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Commission ($ USD) *</label>
                    <input type="number" required value={p.formCommission} onChange={(e) => p.setFormCommission(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Abonnement ($ USD) *</label>
                    <input type="number" required value={p.formSubscription} onChange={(e) => p.setFormSubscription(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Réduction Promo ($ USD) *</label>
                    <input type="number" required value={p.formPromo} onChange={(e) => p.setFormPromo(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Justification *</label>
                  <textarea required rows={2} value={p.formReason} onChange={(e) => p.setFormReason(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                </div>
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => p.setIsProposalModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" disabled={p.isSubmittingProposal} className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{p.isSubmittingProposal ? "Traitement..." : p.isSuperAdmin ? "Appliquer" : "Soumettre au DG"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <span>Rejeter la proposition</span>
              </h3>
              <form onSubmit={p.onRejectProposalSubmit} className="space-y-4">
                <textarea required rows={3} value={p.rejectionReason} onChange={(e) => p.setRejectionReason(e.target.value)} placeholder="Motif du refus..." className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => p.setIsRejectModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg cursor-pointer">Confirmer le rejet</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
