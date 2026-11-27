"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DollarSign, History, Wrench, X } from "lucide-react";

export interface TenantModalsProps {
  isSubmitting: boolean;
  // Create Tenant Modal
  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  leaseType: string;
  setLeaseType: (v: any) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  tenantIdCard: string;
  setTenantIdCard: (v: string) => void;
  properties: any[];
  selectedPropertyId: string;
  setSelectedPropertyId: (v: string) => void;
  selectedProperty: any;
  levels: any[];
  selectedLevelId: string;
  setSelectedLevelId: (v: string) => void;
  units: any[];
  selectedUnitId: string;
  setSelectedUnitId: (v: string) => void;
  rentAmount: number | "";
  setRentAmount: (v: any) => void;
  depositMonths: number;
  setDepositMonths: (v: number) => void;
  depositAmount: number | "";
  setDepositAmount: (v: any) => void;
  periodicity: string;
  setPeriodicity: (v: string) => void;
  leaseStartDate: string;
  setLeaseStartDate: (v: string) => void;
  nextPayment: string;
  setNextPayment: (v: string) => void;
  onCreateTenant: (e: React.FormEvent) => void;
  // Maintenance Modal
  isMaintenanceModalOpen: boolean;
  setIsMaintenanceModalOpen: (v: boolean) => void;
  maintenanceTenant: any;
  maintenanceCategory: string;
  setMaintenanceCategory: (v: string) => void;
  maintenanceTitle: string;
  setMaintenanceTitle: (v: string) => void;
  maintenanceCost: number | "";
  setMaintenanceCost: (v: number | "") => void;
  maintenanceChargedTo: string;
  setMaintenanceChargedTo: (v: any) => void;
  onCreateMaintenanceTicket: (e: React.FormEvent) => void;
  // Departure Modal
  isDepartureModalOpen: boolean;
  setIsDepartureModalOpen: (v: boolean) => void;
  tenantToDepart: any;
  departureDate: string;
  setDepartureDate: (v: string) => void;
  depositRestitutionStatus: string;
  setDepositRestitutionStatus: (v: any) => void;
  debtAmount: number | "";
  setDebtAmount: (v: number | "") => void;
  onDeclareDeparture: (e: React.FormEvent) => void;
  // Payment Modal
  isPaymentModalOpen: boolean;
  setIsPaymentModalOpen: (v: boolean) => void;
  tenantToPay: any;
  paymentAmount: number | "";
  setPaymentAmount: (v: number | "") => void;
  paymentReference: string;
  setPaymentReference: (v: string) => void;
  onDeclarePayment: (e: React.FormEvent) => void;
  // History Modal
  isHistoryModalOpen: boolean;
  setIsHistoryModalOpen: (v: boolean) => void;
  historyTenant: any;
  tenantPayments: any[];
  isLoadingHistory: boolean;
}

export function TenantModals(p: TenantModalsProps) {
  return (
    <>
      {/* CREATE TENANT / BAIL MODAL */}
      <AnimatePresence>
        {p.isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-xl bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0F1D27] z-10">
                <div>
                  <h2 className="text-xl font-bold text-white">Nouveau Bail &amp; Locataire</h2>
                  <p className="text-xs text-gray-400">Établissez le contrat, la garantie locative et les détails d&apos;occupation.</p>
                </div>
                <button onClick={() => p.setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={p.onCreateTenant} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Type de Bail</label>
                    <select value={p.leaseType} onChange={(e) => p.setLeaseType(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                      <option value="Habitation">Bail d&apos;Habitation (Résidentiel)</option>
                      <option value="Commercial">Bail Commercial / Bureaux</option>
                      <option value="Mixte">Usage Mixte</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Nom complet du locataire *</label>
                    <input type="text" required value={p.name} onChange={(e) => p.setName(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="ex: Jean Dupont" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Téléphone (SMS) *</label>
                    <input type="text" required value={p.phone} onChange={(e) => p.setPhone(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="+243..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Email</label>
                    <input type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="client@domaine.com" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">N° Pièce d&apos;identité</label>
                    <input type="text" value={p.tenantIdCard} onChange={(e) => p.setTenantIdCard(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="Passeport / C. Electeur" />
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Propriété louée *</label>
                  <select required value={p.selectedPropertyId} onChange={(e) => p.setSelectedPropertyId(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                    <option value="">Sélectionner une propriété...</option>
                    {p.properties.map((prop) => {
                      const maxOcc = Number(prop.maxOccupancy ?? 1);
                      const currOcc = Number(prop.currentOccupancy ?? 0);
                      const hasLevels = (prop.immoDetails?.levels ?? []).length > 0;
                      const isFull = !hasLevels && currOcc >= maxOcc;
                      const statusIcon = isFull ? "[PLEIN]" : currOcc > 0 ? "[PARTIEL]" : "[LIBRE]";
                      return (
                        <option key={prop.id} value={prop.id} disabled={isFull}>
                          {statusIcon} {prop.title?.fr || "Propriété"} — {prop.price} $/mois{!hasLevels ? ` (${currOcc}/${maxOcc} occupants)` : ""}
                        </option>
                      );
                    })}
                  </select>
                  {p.selectedProperty && (() => {
                    const hasLevels = (p.selectedProperty.immoDetails?.levels ?? []).length > 0;
                    if (hasLevels) return null;
                    const maxOcc = Number(p.selectedProperty.maxOccupancy ?? 1);
                    const currOcc = Number(p.selectedProperty.currentOccupancy ?? 0);
                    if (currOcc >= maxOcc) {
                      return (
                        <div className="mt-2 p-3 bg-red-500/15 border border-red-500/30 rounded-lg flex items-start gap-2">
                          <span className="text-red-400 text-lg">⛔</span>
                          <div>
                            <p className="text-xs font-bold text-red-300">Bien complet — Ajout impossible</p>
                            <p className="text-[11px] text-red-200/70 mt-0.5">{currOcc}/{maxOcc} occupant(s). Déclarez d&apos;abord le départ d&apos;un locataire existant.</p>
                          </div>
                        </div>
                      );
                    }
                    if (currOcc > 0) {
                      return (
                        <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-center gap-2">
                          <span className="text-amber-400">⚠️</span>
                          <p className="text-[11px] text-amber-200"><strong>Partiellement occupé</strong> — {currOcc}/{maxOcc} place(s) prise(s). Il reste <strong>{maxOcc - currOcc}</strong> place(s).</p>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                        <span className="text-emerald-400">✅</span>
                        <p className="text-[11px] text-emerald-200">Bien disponible — {maxOcc} place(s) libre(s)</p>
                      </div>
                    );
                  })()}
                </div>
                {p.levels.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 border-l-2 border-primary/50 pl-4 py-2 bg-white/5 rounded-r-lg">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Niveau / Étage</label>
                      <select required value={p.selectedLevelId} onChange={(e) => p.setSelectedLevelId(e.target.value)} className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                        <option value="">Sélectionner...</option>
                        {p.levels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    {p.selectedLevelId && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300">Sous-unité (Porte)</label>
                        <select required value={p.selectedUnitId} onChange={(e) => p.setSelectedUnitId(e.target.value)} className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                          <option value="">Sélectionner...</option>
                          {p.units.filter((u: any) => (u.capacity || 1) > 0).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div className="border-t border-white/10 pt-3">
                  <span className="text-xs font-bold text-primary-light uppercase tracking-wider block mb-3">Conditions Financières &amp; Garantie Locative</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Loyer convenu ($) *</label>
                      <input type="number" required value={p.rentAmount} onChange={(e) => { const val = Number(e.target.value); p.setRentAmount(val); p.setDepositAmount(val * (p.depositMonths || 3)); }} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm font-bold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Mois de caution</label>
                      <input type="number" min="1" max="12" value={p.depositMonths} onChange={(e) => { const m = Number(e.target.value); p.setDepositMonths(m); if (p.rentAmount) p.setDepositAmount(Number(p.rentAmount) * m); }} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Caution Totale ($)</label>
                      <input type="number" value={p.depositAmount} onChange={(e) => p.setDepositAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-bold text-sm" placeholder="Calculé auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Périodicité</label>
                      <select required value={p.periodicity} onChange={(e) => p.setPeriodicity(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                        <option value="Mensuel">Mensuel</option>
                        <option value="Trimestriel">Trimestriel</option>
                        <option value="Annuel">Annuel</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Date d&apos;effet (Début)</label>
                      <input type="date" value={p.leaseStartDate} onChange={(e) => p.setLeaseStartDate(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [color-scheme:dark]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Prochaine échéance *</label>
                      <input type="date" required value={p.nextPayment} onChange={(e) => p.setNextPayment(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [color-scheme:dark]" />
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => p.setIsModalOpen(false)} disabled={p.isSubmitting} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Annuler</button>
                  <button type="submit" disabled={p.isSubmitting} className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg text-sm flex items-center gap-2">{p.isSubmitting ? "Création en cours..." : "Enregistrer le Bail & Locataire"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAINTENANCE / INCIDENTS MODAL */}
      <AnimatePresence>
        {p.isMaintenanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#0F1D27]">
                <div className="flex items-center gap-2"><Wrench className="text-amber-400" size={20} /><h2 className="text-lg font-bold text-white">Signaler un Incident / Réparation</h2></div>
                <button onClick={() => p.setIsMaintenanceModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={p.onCreateMaintenanceTicket} className="p-6 space-y-4">
                <p className="text-xs text-gray-300">Pour <strong className="text-white">{p.maintenanceTenant?.name}</strong> dans le bien <strong className="text-white">{p.maintenanceTenant?.propertyName}</strong>.</p>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Catégorie</label>
                  <select value={p.maintenanceCategory} onChange={(e) => p.setMaintenanceCategory(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                    <option value="Plomberie">Plomberie &amp; Fuites d&apos;eau</option>
                    <option value="Électricité">Électricité &amp; SNEL / Disjoncteur</option>
                    <option value="Climatisation">Climatisation &amp; Froid</option>
                    <option value="Toiture">Toiture &amp; Infiltration</option>
                    <option value="Serrurerie">Serrurerie &amp; Portes</option>
                    <option value="Autre">Autre réparation</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Description de la panne</label>
                  <input type="text" required value={p.maintenanceTitle} onChange={(e) => p.setMaintenanceTitle(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="ex: Remplacement robinet cuisine" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Coût estimé ($)</label>
                    <input type="number" min="0" value={p.maintenanceCost} onChange={(e) => p.setMaintenanceCost(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Imputation (Qui paie ?)</label>
                    <select value={p.maintenanceChargedTo} onChange={(e) => p.setMaintenanceChargedTo(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#0F1D27]">
                      <option value="BAILLEUR">À la charge du Bailleur</option>
                      <option value="LOCATAIRE">À la charge du Locataire</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => p.setIsMaintenanceModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Annuler</button>
                  <button type="submit" disabled={p.isSubmitting} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm">{p.isSubmitting ? "Enregistrement..." : "Valider le ticket"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DECLARE DEPARTURE MODAL */}
      <AnimatePresence>
        {p.isDepartureModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-sm bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#0F1D27]">
                <h2 className="text-lg font-semibold text-white">Déclarer un départ &amp; Clôture du Bail</h2>
                <button onClick={() => p.setIsDepartureModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={p.onDeclareDeparture} className="p-6 space-y-4">
                <p className="text-xs text-gray-300 mb-2">Départ de <strong className="text-white">{p.tenantToDepart?.name}</strong> de <strong className="text-white">{p.tenantToDepart?.propertyName}</strong>.</p>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Date de libération des lieux</label>
                  <input type="date" required value={p.departureDate} onChange={(e) => p.setDepartureDate(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [color-scheme:dark]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Sort de la Garantie Locative (Caution)</label>
                  <select value={p.depositRestitutionStatus} onChange={(e) => p.setDepositRestitutionStatus(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [&>option]:bg-[#0F1D27]">
                    <option value="RESTITUTED">Restituée intégralement au locataire</option>
                    <option value="DEDUCTED">Retenue (déduite pour impayés ou réparations)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Dette restante nette ($)</label>
                  <input type="number" required min="0" value={p.debtAmount} onChange={(e) => p.setDebtAmount(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="0 si soldé" />
                </div>
                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => p.setIsDepartureModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Annuler</button>
                  <button type="submit" disabled={p.isSubmitting} className="px-5 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg text-sm">{p.isSubmitting ? "Traitement..." : "Clôturer le bail"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DECLARE PAYMENT MODAL */}
      <AnimatePresence>
        {p.isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-sm bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#0F1D27]">
                <h2 className="text-lg font-semibold text-white">Enregistrer un paiement de loyer</h2>
                <button onClick={() => p.setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={p.onDeclarePayment} className="p-6 space-y-4">
                <p className="text-xs text-gray-300 mb-2">Paiement de <strong className="text-white">{p.tenantToPay?.name}</strong> pour <strong className="text-white">{p.tenantToPay?.propertyName}</strong>.</p>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Montant perçu (USD) *</label>
                  <input type="number" required min="1" value={p.paymentAmount} onChange={(e) => p.setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-bold text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Référence ou Mois réglé</label>
                  <input type="text" value={p.paymentReference} onChange={(e) => p.setPaymentReference(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="ex: Loyer Mars 2024" />
                </div>
                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => p.setIsPaymentModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Annuler</button>
                  <button type="submit" disabled={p.isSubmitting} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm">{p.isSubmitting ? "Traitement..." : "Valider l'encaissement"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PAYMENT HISTORY MODAL */}
      <AnimatePresence>
        {p.isHistoryModalOpen && p.historyTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/15 rounded-lg"><History size={18} className="text-indigo-400" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Historique des Paiements</h3>
                    <p className="text-xs text-gray-400">{p.historyTenant.name} — {p.historyTenant.propertyName}{p.historyTenant.unitName ? ` (${p.historyTenant.unitName})` : ""}</p>
                  </div>
                </div>
                <button onClick={() => p.setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/10 bg-white/3 border-b border-white/10 shrink-0">
                <div className="p-3 text-center"><p className="text-xs text-gray-400">Paiements</p><p className="text-lg font-bold text-white">{p.tenantPayments.length}</p></div>
                <div className="p-3 text-center"><p className="text-xs text-gray-400">Total encaissé</p><p className="text-lg font-bold text-emerald-400">{p.tenantPayments.reduce((s, pm) => s + (pm.amount || 0), 0).toLocaleString()} $</p></div>
                <div className="p-3 text-center"><p className="text-xs text-gray-400">Loyer mensuel</p><p className="text-lg font-bold text-indigo-400">{p.historyTenant.rentAmount} $</p></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {p.isLoadingHistory ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Chargement de l&apos;historique...</div>
                ) : p.tenantPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                    <DollarSign size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">Aucun paiement enregistré pour ce locataire.</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />
                    <div className="space-y-3 pl-10">
                      {p.tenantPayments.map((pmt, idx) => {
                        const date = pmt.createdAt?.toDate?.() ? pmt.createdAt.toDate().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                        const isFirst = idx === 0;
                        return (
                          <div key={pmt.id} className="relative">
                            <div className={`absolute -left-[26px] top-3 w-3 h-3 rounded-full border-2 ${isFirst ? "bg-emerald-400 border-emerald-400" : "bg-white/20 border-white/30"}`} />
                            <div className={`rounded-xl p-3.5 border ${isFirst ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/3 border-white/8"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-400">{date}</p>
                                  <p className="text-sm font-medium text-white truncate mt-0.5">{pmt.reference || `Loyer — ${date}`}</p>
                                </div>
                                <span className={`text-sm font-bold shrink-0 ${isFirst ? "text-emerald-400" : "text-white"}`}>+{Number(pmt.amount).toLocaleString("fr-FR")} $</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-white/10 bg-black/20 shrink-0 flex justify-end">
                <button onClick={() => p.setIsHistoryModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Fermer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
