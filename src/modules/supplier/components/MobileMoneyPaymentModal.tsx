"use client";

import { useState, useEffect } from "react";
import { X, Smartphone, CheckCircle2, Clock, ShieldCheck, Loader2, Copy, Check, Building2, AlertCircle, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";
import { buildVisaPaymentUrl, VisaPaymentConfig } from "@/lib/visaPayments";

interface MobileMoneyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  baseAmount: number;
  pendingDiscount: number;
  onSubmitted?: () => void;
}

const OPERATORS = [
  { id: "MPESA", name: "M-Pesa", sub: "Vodacom RDC", color: "border-red-500/40 bg-red-500/10 text-red-300" },
  { id: "AIRTEL_MONEY", name: "Airtel Money", sub: "Airtel RDC", color: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  { id: "ORANGE_MONEY", name: "Orange Money", sub: "Orange RDC", color: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  { id: "AFRIMONEY", name: "Afrimoney", sub: "Africell RDC", color: "border-purple-500/40 bg-purple-500/10 text-purple-300" },
  { id: "CASH_OFFICE", name: "Caisse Bureau", sub: "Paiement espèces", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
] as const;

export default function MobileMoneyPaymentModal({
  isOpen,
  onClose,
  supplierId,
  baseAmount,
  pendingDiscount,
  onSubmitted,
}: MobileMoneyPaymentModalProps) {
  const { user, userData } = useAuth();
  const [operator, setOperator] = useState<string>("MPESA");
  const [senderPhone, setSenderPhone] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");
  const [supportPhone, setSupportPhone] = useState("+243 81 000 0000");
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [payChannelTab, setPayChannelTab] = useState<"MOBILE_MONEY" | "VISA">("MOBILE_MONEY");
  const [visaConfig, setVisaConfig] = useState<VisaPaymentConfig | null>(null);

  const effectiveAmount = Math.max(0, baseAmount - pendingDiscount);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSuccessMsg("");
    if (userData?.phone && !senderPhone) {
      setSenderPhone(String(userData.phone));
    }

    // Charger la configuration dynamique Carte Visa / prélèvement automatique
    fetch("/api/payments/visa-config")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.config) {
          setVisaConfig(json.config);
        }
      })
      .catch(() => {});

    // Charger le numéro officiel de réception Mobile Money depuis settings/platform
    getDoc(doc(db, "settings", "platform"))
      .then((snap) => {
        if (snap.exists()) {
          const phone = snap.data()?.adminContactPhone;
          if (phone) setSupportPhone(String(phone));
        }
      })
      .catch(() => {});

    // Charger l'historique récent des preuves soumises par ce fournisseur
    user
      ?.getIdToken()
      .then((token) =>
        fetch("/api/payments/mobile-money?scope=mine", {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.requests)) {
          setMyRequests(data.requests.slice(0, 3));
        }
      })
      .catch(() => {});
  }, [isOpen, user, userData?.phone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/payments/mobile-money", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplierId,
          operator,
          senderPhone,
          transactionRef,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossible d'envoyer la preuve de paiement.");
      }
      setSuccessMsg(data.message);
      setTransactionRef("");
      setNote("");
      onSubmitted?.();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0F1D27] border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#122431]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300]">
              {payChannelTab === "VISA" ? <CreditCard size={18} /> : <Smartphone size={18} />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Régler mon Abonnement</h3>
              <p className="text-[11px] text-gray-400">Mobile Money ou Carte Visa / Mastercard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sélecteur de canal : Mobile Money vs Carte Visa (Prélèvement Auto) */}
        {visaConfig?.enabled && visaConfig.subscriptionUrl && (
          <div className="px-5 pt-4 bg-[#0F1D27]">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/30 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setPayChannelTab("MOBILE_MONEY")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  payChannelTab === "MOBILE_MONEY"
                    ? "bg-white/15 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Smartphone size={13} />
                <span>Mobile Money</span>
              </button>
              <button
                type="button"
                onClick={() => setPayChannelTab("VISA")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  payChannelTab === "VISA"
                    ? "bg-[#C7D300] text-[#0F1D27]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <CreditCard size={13} />
                <span>Carte Visa {visaConfig.autoBillingEnabled ? "· Auto" : ""}</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-5 max-h-[82vh] overflow-y-auto rayons-scroll">
          {payChannelTab === "VISA" && visaConfig?.enabled && visaConfig.subscriptionUrl ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#C7D300]/15 via-[#C7D300]/5 to-transparent border border-[#C7D300]/30 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase font-bold tracking-wider text-[#C7D300]">
                    Abonnement Mensuel Carte Visa ({visaConfig.providerName})
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-white tabular-nums">${effectiveAmount} USD</span>
                    <span className="text-xs text-gray-400">/ mois</span>
                  </div>
                </div>
                <CreditCard size={28} className="text-[#C7D300] shrink-0" />
              </div>

              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-2 text-xs text-gray-300">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <RefreshCw size={14} />
                  <span>
                    {visaConfig.autoBillingEnabled
                      ? "Prélèvement mensuel automatique activé"
                      : "Paiement sécurisé par Carte Visa / Mastercard"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Vous allez être redirigé vers la page de paiement chiffrée officielle (<strong>{visaConfig.providerName}</strong>).
                  Dès validation de votre carte, votre abonnement est activé et prolongé automatiquement de 30 jours. Aucune donnée bancaire n&apos;est stockée sur Rayons.net.
                </p>
              </div>

              <a
                href={buildVisaPaymentUrl(visaConfig.subscriptionUrl, {
                  referenceId: `sub_${supplierId}`,
                  email: user?.email || userData?.email || "",
                  amount: effectiveAmount,
                  currency: "USD",
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] font-extrabold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <CreditCard size={15} />
                <span>Payer ${effectiveAmount} USD par Carte Visa</span>
                <ExternalLink size={13} />
              </a>

              <p className="text-[10px] text-center text-gray-500 flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-400" />
                <span>Paiement 3D-Secure PCI-DSS · Activation automatique via Webhook</span>
              </p>
            </div>
          ) : successMsg ? (
            <ValidationSuccessView
              title="Preuve envoyée !"
              message={successMsg}
              badgeLabel="En cours de vérification Caisse"
              onDone={() => {
                setSuccessMsg("");
                onClose();
              }}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Récapitulatif Montant */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#C7D300]/15 via-[#C7D300]/5 to-transparent border border-[#C7D300]/30 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase font-bold tracking-wider text-[#C7D300]">Montant à transférer (30 jours)</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-white">${effectiveAmount} USD</span>
                    {pendingDiscount > 0 && (
                      <span className="text-xs line-through text-gray-400">${baseAmount} USD</span>
                    )}
                  </div>
                  {pendingDiscount > 0 && (
                    <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                      Réduction parrainage appliquée : -${pendingDiscount} USD
                    </p>
                  )}
                </div>
                <ShieldCheck size={28} className="text-[#C7D300] shrink-0" />
              </div>

              {/* Numéro officiel de paiement */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    Numéro Marchand Officiel Rayons.net
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate mt-0.5">{supportPhone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(supportPhone);
                    setCopiedPhone(true);
                    setTimeout(() => setCopiedPhone(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedPhone ? <Check size={13} className="text-[#C7D300]" /> : <Copy size={13} />}
                  <span>{copiedPhone ? "Copié" : "Copier"}</span>
                </button>
              </div>

              {/* Choix opérateur */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2">1. Choisissez votre opérateur</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OPERATORS.map((op) => {
                    const active = operator === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOperator(op.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? "bg-[#C7D300]/15 border-[#C7D300] text-white shadow-sm"
                            : "bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          {op.id === "CASH_OFFICE" ? <Building2 size={13} /> : <Smartphone size={13} />}
                          <span className="truncate">{op.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{op.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Numéro expéditeur & Référence SMS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    2. Votre numéro {operator === "CASH_OFFICE" ? "(optionnel)" : "*"}
                  </label>
                  <input
                    type="tel"
                    required={operator !== "CASH_OFFICE"}
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="+243 8XX XXX XXX"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C7D300]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    3. Référence / ID SMS *
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value.toUpperCase())}
                    placeholder="Ex: MP261122.1432.A9821"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#C7D300]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Note complémentaire (optionnel)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: Transfert effectué depuis le numéro du gérant..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#C7D300]"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Historique récent des preuves soumises */}
              {myRequests.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Vos dernières preuves soumises
                  </p>
                  <div className="space-y-1.5">
                    {myRequests.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="truncate">
                          <span className="font-mono font-bold text-white">{r.transactionRef}</span>
                          <span className="text-gray-400 ml-2">({r.operatorLabel} · ${r.finalAmount})</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            r.status === "APPROVED"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : r.status === "REJECTED"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {r.status === "APPROVED" ? "Validé" : r.status === "REJECTED" ? "Rejeté" : "En attente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-xs font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-2.5 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#C7D300]/15"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  <span>{submitting ? "Envoi en cours..." : `Soumettre la preuve ($${effectiveAmount})`}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
