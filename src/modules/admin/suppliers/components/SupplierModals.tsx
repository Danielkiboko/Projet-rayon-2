"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

export interface SupplierModalsProps {
  availableRayons: Array<{ id: string; label: string; icon?: string; desc?: string }>;
  isLoading: boolean;
  // Access modal
  isAccessModalOpen: boolean;
  setIsAccessModalOpen: (v: boolean) => void;
  selectedSupplierForAccess: any;
  selectedRayons: string[];
  setSelectedRayons: (v: string[]) => void;
  onUpdateAccess: (e: React.FormEvent) => void;
  // Create modal
  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  error: string;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  notificationMethod: "email" | "sms";
  setNotificationMethod: (v: "email" | "sms") => void;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  supplierCategory: "immo" | "mode" | "connect" | "saveurs";
  setSupplierCategory: (v: "immo" | "mode" | "connect" | "saveurs") => void;
  setRole: (v: string) => void;
  setRayon: (v: string) => void;
  isOfficialAdminStore: boolean;
  setIsOfficialAdminStore: (v: boolean) => void;
  isSubmitting: boolean;
  onCreateSupplier: (e: React.FormEvent) => void;
  // Subscription modal
  isSubModalOpen: boolean;
  setIsSubModalOpen: (v: boolean) => void;
  selectedSupplierSub: any;
  setSelectedSupplierSub: (v: any) => void;
  selectedSubStatus: "TRIAL" | "ACTIVE" | "SUSPENDED_PAYMENT";
  setSelectedSubStatus: (v: "TRIAL" | "ACTIVE" | "SUSPENDED_PAYMENT") => void;
  daysToAdd: number;
  setDaysToAdd: (v: number) => void;
  customExpiryDate: string;
  setCustomExpiryDate: (v: string) => void;
  onUpdateSubscription: (e: React.FormEvent) => void;
  // Review / KYC modal
  isReviewModalOpen: boolean;
  setIsReviewModalOpen: (v: boolean) => void;
  selectedSupplierToApprove: any;
  approvalRayons: string[];
  setApprovalRayons: React.Dispatch<React.SetStateAction<string[]>>;
  approvalDays: number;
  setApprovalDays: (v: number) => void;
  approvalNote: string;
  setApprovalNote: (v: string) => void;
  isApprovingApp: boolean;
  onEvaluateApplication: (decision: "approve" | "reject") => void;
  onConfirmApproveProfile: () => void;
}

export function SupplierModals(p: SupplierModalsProps) {
  return (
    <>
      <AnimatePresence>
        {p.isAccessModalOpen && p.selectedSupplierForAccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">Gérer les accès</h2>
                <button onClick={() => p.setIsAccessModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={p.onUpdateAccess} className="p-6 space-y-4">
                <p className="text-sm text-gray-300 mb-2">
                  Sélectionnez les rayons auxquels <strong>{p.selectedSupplierForAccess.name}</strong> a le droit de vendre :
                </p>
                <div className="space-y-3">
                  {p.availableRayons.map((r) => (
                    <label key={r.id} className="flex items-center space-x-3 bg-white/5 border border-white/10 p-3 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={p.selectedRayons.includes(r.id)}
                        onChange={(e) => p.setSelectedRayons(e.target.checked ? [...p.selectedRayons, r.id] : p.selectedRayons.filter((id) => id !== r.id))}
                        className="w-4 h-4 text-primary bg-black border-white/20 rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-white text-sm font-medium">{r.label}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-6 flex justify-end space-x-3">
                  <button type="button" onClick={() => p.setIsAccessModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Annuler</button>
                  <button type="submit" disabled={p.isLoading} className="bg-primary hover:bg-primary-light text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">{p.isLoading ? "En cours..." : "Valider"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0F1D27] z-10">
                <h2 className="text-xl font-semibold text-white">Créer un compte</h2>
                <button onClick={() => p.setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={p.onCreateSupplier} className="p-6 space-y-4">
                {p.error && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{p.error}</div>}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm mb-2">
                  Un e-mail de configuration de mot de passe sera automatiquement envoyé à l&apos;adresse indiquée une fois le compte créé.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Prénom</label>
                    <input type="text" required value={p.firstName} onChange={(e) => p.setFirstName(e.target.value)} className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Nom (Post-nom)</label>
                    <input type="text" required value={p.lastName} onChange={(e) => p.setLastName(e.target.value)} className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Nom de l&apos;entreprise (Optionnel)</label>
                  <input type="text" value={p.name} onChange={(e) => p.setName(e.target.value)} className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Email (identifiant de connexion)</label>
                  <input type="email" required value={p.email} onChange={(e) => p.setEmail(e.target.value)} className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Méthode de notification</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2 text-white cursor-pointer">
                      <input type="radio" name="notificationMethod" value="email" checked={p.notificationMethod === "email"} onChange={() => p.setNotificationMethod("email")} className="text-primary focus:ring-primary bg-black/20 border-white/10" />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center space-x-2 text-white cursor-pointer">
                      <input type="radio" name="notificationMethod" value="sms" checked={p.notificationMethod === "sms"} onChange={() => p.setNotificationMethod("sms")} className="text-primary focus:ring-primary bg-black/20 border-white/10" />
                      <span>SMS</span>
                    </label>
                  </div>
                </div>
                {p.notificationMethod === "sms" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Numéro de téléphone</label>
                    <input type="tel" required value={p.phoneNumber} onChange={(e) => p.setPhoneNumber(e.target.value)} placeholder="+243..." className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Type de Prestataire &amp; Rayon d&apos;Affectation <span className="text-red-400">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "immo" as const, role: "SUPPLIER_IMMO", emoji: "🏠", title: "Immobilier & Hôtels", desc: "Appartements, villas, résidences, hôtels & nuitées", activeCls: "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10", checkCls: "text-emerald-400" },
                      { id: "mode" as const, role: "supplier", emoji: "👗", title: "Mode & Vêtements", desc: "Prêt-à-porter, chaussures, sacs & accessoires", activeCls: "bg-pink-500/15 border-pink-500 text-white shadow-md shadow-pink-500/10", checkCls: "text-pink-400" },
                      { id: "connect" as const, role: "supplier", emoji: "⚡", title: "Matériel & Connect", desc: "Smartphones, matériel informatique & réseaux", activeCls: "bg-cyan-500/15 border-cyan-500 text-white shadow-md shadow-cyan-500/10", checkCls: "text-cyan-400" },
                      { id: "saveurs" as const, role: "supplier", emoji: "🍽️", title: "Saveurs & Gastronomie", desc: "Restaurants, plats cuisinés & ustensiles de cuisine", activeCls: "bg-[#FF6B35]/15 border-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/10", checkCls: "text-[#FF6B35]" },
                    ].map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => { p.setSupplierCategory(cat.id); p.setRole(cat.role); p.setRayon(cat.id); }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${p.supplierCategory === cat.id ? cat.activeCls : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xl">{cat.emoji}</span>
                          {p.supplierCategory === cat.id ? <CheckCircle2 size={18} className={cat.checkCls} /> : <span className="w-4 h-4 rounded-full border border-white/20" />}
                        </div>
                        <div className="font-semibold text-sm text-white">{cat.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{cat.desc}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Un abonnement d&apos;essai de 30 jours sera automatiquement attribué au fournisseur standard pour commencer à vendre.</p>
                </div>
                <div onClick={() => p.setIsOfficialAdminStore(!p.isOfficialAdminStore)} className={`p-4 rounded-xl border cursor-pointer transition-all ${p.isOfficialAdminStore ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">🏷️</span>
                      <div>
                        <p className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>Boutique Officielle Rayons (Magasin Plateforme)</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase">Exempté d&apos;abonnement</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          Ce compte est une vitrine marchande officielle appartenant à Rayons.net pour vendre des produits ou biens propres. <strong>Il est exempté d&apos;abonnement mensuel</strong>.
                        </p>
                      </div>
                    </div>
                    <input type="checkbox" checked={p.isOfficialAdminStore} onChange={(e) => p.setIsOfficialAdminStore(e.target.checked)} className="mt-1 h-4 w-4 rounded text-amber-500 focus:ring-amber-400 bg-black/40 border-white/20 shrink-0" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => p.setIsModalOpen(false)} disabled={p.isSubmitting} className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50">Annuler</button>
                  <button type="submit" disabled={p.isSubmitting} className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors flex items-center disabled:opacity-50">{p.isSubmitting ? "Création en cours..." : "Créer le compte"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isSubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#0B0F17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white">Gérer Période d&apos;Essai &amp; Abonnement</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Partenaire : <span className="text-white font-semibold">{p.selectedSupplierSub?.name}</span></p>
                </div>
                <button onClick={() => { p.setIsSubModalOpen(false); p.setSelectedSupplierSub(null); }} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"><X size={20} /></button>
              </div>
              <form onSubmit={p.onUpdateSubscription} className="p-5 space-y-4">
                {p.selectedSupplierSub && (() => {
                  const currentEnd = p.selectedSupplierSub.subscriptionEndDate
                    ? (p.selectedSupplierSub.subscriptionEndDate.toDate ? p.selectedSupplierSub.subscriptionEndDate.toDate() : new Date(p.selectedSupplierSub.subscriptionEndDate))
                    : null;
                  const daysLeft = currentEnd ? Math.ceil((currentEnd.getTime() - Date.now()) / 86400000) : null;
                  const status = p.selectedSupplierSub.subscriptionStatus || "TRIAL";
                  return (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 uppercase font-semibold text-[10px]">Statut en base :</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold ${status === "TRIAL" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"}`}>
                          {status === "TRIAL" ? "Période d'essai" : status === "ACTIVE" ? "Abonnement Actif" : "Suspendu"}
                        </span>
                      </div>
                      {currentEnd ? (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-gray-300">Échéance actuelle :</span>
                          <span className="font-semibold text-white">{currentEnd.toLocaleDateString("fr-FR")} ({daysLeft && daysLeft > 0 ? `${daysLeft}j restants` : "Expiré"})</span>
                        </div>
                      ) : <p className="text-gray-400 pt-1">Aucune date d&apos;échéance renseignée.</p>}
                    </div>
                  );
                })()}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">Statut du compte fournisseur</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "TRIAL" as const, label: "⏱️ Essai (15j)", cls: "bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm" },
                      { id: "ACTIVE" as const, label: "✅ Actif (Payé)", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm" },
                      { id: "SUSPENDED_PAYMENT" as const, label: "⛔ Suspendu", cls: "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm" },
                    ].map((st) => (
                      <button key={st.id} type="button" onClick={() => p.setSelectedSubStatus(st.id)} className={`p-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${p.selectedSubStatus === st.id ? st.cls : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"}`}>{st.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300">Durée ou prolongation</label>
                  <div className="flex items-center gap-2">
                    {[15, 30, 60, 90].map((d) => (
                      <button key={d} type="button" onClick={() => { p.setDaysToAdd(d); p.setCustomExpiryDate(""); }} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${p.daysToAdd === d && !p.customExpiryDate ? "bg-primary text-gray-950 shadow-sm" : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"}`}>
                        {d === 15 ? "15j (Essai)" : `+${d}j`}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <label className="text-[11px] text-gray-400 block mb-1">Ou fixer une date d&apos;échéance précise au calendrier :</label>
                    <input type="date" value={p.customExpiryDate} onChange={(e) => p.setCustomExpiryDate(e.target.value)} className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer" />
                  </div>
                </div>
                {p.selectedSupplierSub && (() => {
                  let preview: Date;
                  if (p.customExpiryDate) {
                    preview = new Date(p.customExpiryDate);
                  } else {
                    const currentEnd = p.selectedSupplierSub.subscriptionEndDate
                      ? (p.selectedSupplierSub.subscriptionEndDate.toDate ? p.selectedSupplierSub.subscriptionEndDate.toDate() : new Date(p.selectedSupplierSub.subscriptionEndDate))
                      : null;
                    const base = currentEnd && currentEnd > new Date() ? currentEnd : new Date();
                    preview = new Date(base);
                    preview.setDate(preview.getDate() + Number(p.daysToAdd));
                  }
                  return (
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-xs text-gray-300 flex items-center justify-between">
                      <span>Nouvelle échéance calculée :</span>
                      <span className="text-primary-light font-bold">{preview.toLocaleDateString("fr-FR")}</span>
                    </div>
                  );
                })()}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                  <span className="text-base shrink-0">⚡</span>
                  <div>
                    <strong className="block font-bold">Déblocage &amp; Réactivation immédiate :</strong>
                    En validant un statut <em>Essai</em> ou <em>Actif</em>, le fournisseur est instantanément débloqué et autorisé à publier.
                  </div>
                </div>
                <div className="pt-2 flex justify-end space-x-3">
                  <button type="button" onClick={() => { p.setIsSubModalOpen(false); p.setSelectedSupplierSub(null); }} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer">Annuler</button>
                  <button type="submit" disabled={p.isLoading} className="bg-primary hover:bg-primary-light text-gray-950 font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50">{p.isLoading ? "Enregistrement..." : "Appliquer"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {p.isReviewModalOpen && p.selectedSupplierToApprove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 shrink-0">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Dossier Identité, Pièces &amp; Coordonnées (Base de données)</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Fournisseur : <strong className="text-white">{p.selectedSupplierToApprove.name}</strong> ({p.selectedSupplierToApprove.email})</p>
                </div>
                <button onClick={() => p.setIsReviewModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer"><X size={24} /></button>
              </div>
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                {(p.selectedSupplierToApprove.supplierApplication || p.selectedSupplierToApprove.supplierApplicationStatus === "PENDING_APPROVAL") && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">📋 Projet déclaré &amp; Attribution du Rayon (Décision Admin)</h3>
                      {p.selectedSupplierToApprove.supplierApplication?.paymentRef && (
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Payé ${p.selectedSupplierToApprove.supplierApplication.amountPaid ?? 50} • Réf: {p.selectedSupplierToApprove.supplierApplication.paymentRef}
                        </span>
                      )}
                    </div>
                    <div className="bg-black/35 rounded-xl p-3.5 border border-white/10">
                      <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Ce que le candidat vend / Description du projet :</span>
                      <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{p.selectedSupplierToApprove.supplierApplication?.projectDescription || "Aucune description renseignée."}</p>
                      <div className="mt-2.5 pt-2.5 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-300">
                        {p.selectedSupplierToApprove.supplierApplication?.company && <span>Boutique : <strong className="text-white">{p.selectedSupplierToApprove.supplierApplication.company}</strong></span>}
                        {p.selectedSupplierToApprove.supplierApplication?.commune && <span>Commune : <strong className="text-white">{p.selectedSupplierToApprove.supplierApplication.commune}</strong></span>}
                        {p.selectedSupplierToApprove.supplierApplication?.paymentMethod && <span>Paiement : <strong className="text-emerald-300">{p.selectedSupplierToApprove.supplierApplication.paymentMethod}</strong></span>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white mb-2">Attribuer le(s) rayon(s) officiel(s) en fonction de son activité *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {p.availableRayons.map((r) => {
                          const isChecked = p.approvalRayons.includes(r.id);
                          return (
                            <button key={r.id} type="button" onClick={() => p.setApprovalRayons((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])} className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${isChecked ? "bg-[#C7D300]/15 border-[#C7D300] text-white" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold flex items-center gap-1.5"><span>{r.icon}</span><span>{r.label}</span></span>
                                {isChecked && <CheckCircle2 size={16} className="text-[#C7D300] shrink-0" />}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{r.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Durée (jours)</label>
                        <input type="number" min={1} max={365} value={p.approvalDays} onChange={(e) => p.setApprovalDays(Number(e.target.value) || 30)} className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Message / Motif envoyé dans la notification (optionnel)</label>
                        <input type="text" value={p.approvalNote} onChange={(e) => p.setApprovalNote(e.target.value)} placeholder="Ex : Bienvenue dans Rayons Connect !" className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder:text-gray-500" />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-3">1. Numéros de Téléphone &amp; Adresse</h3>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Téléphone Principal</span><span className="text-sm text-white font-mono font-bold">{p.selectedSupplierToApprove.pendingProfile?.phone || p.selectedSupplierToApprove.phone || "Non renseigné"}</span></div>
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">WhatsApp</span><span className="text-sm text-emerald-300 font-mono">{p.selectedSupplierToApprove.pendingProfile?.whatsappPhone || p.selectedSupplierToApprove.whatsappPhone || "Non renseigné"}</span></div>
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Mobile Money ({p.selectedSupplierToApprove.payoutProvider || "MPESA"})</span><span className="text-sm text-[#C7D300] font-mono font-bold">{p.selectedSupplierToApprove.pendingProfile?.payoutPhone || p.selectedSupplierToApprove.payoutPhone || "Non renseigné"}</span></div>
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Adresse physique</span><span className="text-sm text-gray-200">{p.selectedSupplierToApprove.pendingProfile?.address || p.selectedSupplierToApprove.address || "Non renseignée"}</span></div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-3">2. Pièce d&apos;Identité Officielle (KYC)</h3>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Type de Pièce</span><span className="text-sm text-white font-semibold">{p.selectedSupplierToApprove.pendingProfile?.idDocumentType || p.selectedSupplierToApprove.idDocumentType || "Non renseigné"}</span></div>
                      <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Numéro de la Pièce</span><span className="text-sm text-[#C7D300] font-mono font-bold">{p.selectedSupplierToApprove.pendingProfile?.idDocumentNumber || p.selectedSupplierToApprove.idDocumentNumber || "Non renseigné"}</span></div>
                      <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Nationalité</span><span className="text-sm text-gray-200">{p.selectedSupplierToApprove.pendingProfile?.nationality || p.selectedSupplierToApprove.nationality || "Congolaise (RDC)"}</span></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold mb-2">Pièce d&apos;identité — RECTO</span>
                        {(p.selectedSupplierToApprove.pendingProfile?.idDocumentFrontUrl || p.selectedSupplierToApprove.idDocumentFrontUrl) ? (
                          <img src={p.selectedSupplierToApprove.pendingProfile?.idDocumentFrontUrl || p.selectedSupplierToApprove.idDocumentFrontUrl} alt="Pièce Recto" className="w-full h-36 max-h-36 object-contain rounded-lg bg-black/50" />
                        ) : <div className="h-28 flex items-center justify-center text-xs text-gray-500 border border-dashed border-white/10 rounded-lg">Aucune photo Recto fournie</div>}
                      </div>
                      <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold mb-2">Pièce d&apos;identité — VERSO</span>
                        {(p.selectedSupplierToApprove.pendingProfile?.idDocumentBackUrl || p.selectedSupplierToApprove.idDocumentBackUrl) ? (
                          <img src={p.selectedSupplierToApprove.pendingProfile?.idDocumentBackUrl || p.selectedSupplierToApprove.idDocumentBackUrl} alt="Pièce Verso" className="w-full h-36 max-h-36 object-contain rounded-lg bg-black/50" />
                        ) : <div className="h-28 flex items-center justify-center text-xs text-gray-500 border border-dashed border-white/10 rounded-lg">Aucune photo Verso fournie</div>}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-3">3. Mentions Légales &amp; Entreprise</h3>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Entreprise</span><span className="text-sm text-white">{p.selectedSupplierToApprove.pendingProfile?.companyName || p.selectedSupplierToApprove.companyName || "Non renseigné"}</span></div>
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">RCCM</span><span className="text-sm text-gray-200 font-mono">{p.selectedSupplierToApprove.pendingProfile?.rccm || p.selectedSupplierToApprove.rccm || "Non renseigné"}</span></div>
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">ID. NAT</span><span className="text-sm text-gray-200 font-mono">{p.selectedSupplierToApprove.pendingProfile?.idNat || p.selectedSupplierToApprove.idNat || "Non renseigné"}</span></div>
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">NIF</span><span className="text-sm text-gray-200 font-mono">{p.selectedSupplierToApprove.pendingProfile?.nif || p.selectedSupplierToApprove.nif || "Non renseigné"}</span></div>
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-6 border-t border-white/10 shrink-0 flex flex-wrap items-center justify-end gap-3">
                <button onClick={() => p.setIsReviewModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm font-semibold cursor-pointer">Fermer</button>
                {p.selectedSupplierToApprove.supplierApplicationStatus === "PENDING_APPROVAL" ? (
                  <>
                    <button type="button" onClick={() => p.onEvaluateApplication("reject")} disabled={p.isApprovingApp} className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer">Refuser la demande</button>
                    <button type="button" onClick={() => p.onEvaluateApplication("approve")} disabled={p.isApprovingApp || p.approvalRayons.length === 0} className="bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-colors disabled:opacity-50 cursor-pointer shadow-lg">{p.isApprovingApp ? "Attribution..." : "✅ Approuver & Attribuer ce Rayon (+ Notifier)"}</button>
                  </>
                ) : (
                  <button onClick={p.onConfirmApproveProfile} disabled={p.isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-lg">{p.isLoading ? "Validation..." : "✅ Valider & Certifier l'Identité en BDD"}</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
