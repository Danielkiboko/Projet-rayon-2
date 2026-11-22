"use client";

import { useState, useEffect, useCallback } from "react";
import { Smartphone, CheckCircle2, XCircle, RefreshCw, Clock, Phone, Hash, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";

interface PaymentProofRequest {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  operator: string;
  operatorLabel: string;
  senderPhone: string;
  transactionRef: string;
  finalAmount: number;
  discountAmount: number;
  note: string;
  status: "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string | null;
}

export default function MobileMoneyRequestsPanel({ onApproved }: { onApproved?: () => void }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PaymentProofRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/payments/mobile-money", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.warn("MobileMoneyRequestsPanel fetch warning:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (reqItem: PaymentProofRequest, action: "APPROVE" | "REJECT") => {
    let rejectionReason = "";
    if (action === "REJECT") {
      const input = prompt(`Motif du rejet pour ${reqItem.supplierName} (Réf: ${reqItem.transactionRef}) :`);
      if (input === null) return;
      rejectionReason = input.trim() || "Référence introuvable sur le compte Mobile Money.";
    } else {
      if (
        !confirm(
          `Confirmer la réception de $${reqItem.finalAmount} USD (${reqItem.operatorLabel} · Réf ${reqItem.transactionRef}) de ${reqItem.supplierName} ?\n\nCette action active +30 jours, inscrit l'entrée en caisse et crédite automatiquement la commission partenaire ($5).`
        )
      ) {
        return;
      }
    }

    setProcessingId(reqItem.id);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/payments/mobile-money", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId: reqItem.id,
          action,
          rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du traitement.");
      }
      setSuccessMsg(data.message);
      await fetchRequests();
      if (action === "APPROVE") onApproved?.();
    } catch (err: any) {
      alert(err?.message || "Erreur lors de la validation.");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingList = requests.filter((r) => r.status === "PENDING_VERIFICATION");
  const recentHistory = requests.filter((r) => r.status !== "PENDING_VERIFICATION").slice(0, 5);

  if (!loading && requests.length === 0 && !successMsg) {
    return null;
  }

  return (
    <div className="bg-[#0F1D27] border border-[#C7D300]/25 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300] shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Preuves Mobile Money à Valider</h3>
              {pendingList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#C7D300] text-[#0F1D27] animate-pulse">
                  {pendingList.length} en attente
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Validation 1 clic : active +30 jours, inscrit au Grand Livre et crédite +$5 au Partenaire recruteur.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-[#C7D300]" : "text-[#C7D300]"} />
          Actualiser
        </button>
      </div>

      {successMsg ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={successMsg}
          badgeLabel="Paiement Mobile Money Traité"
          onDone={() => setSuccessMsg("")}
        />
      ) : loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2">
          <Loader2 size={15} className="animate-spin text-[#C7D300]" />
          Chargement des preuves Mobile Money...
        </div>
      ) : (
        <div className="space-y-3">
          {pendingList.length === 0 ? (
            <div className="text-xs text-gray-400 bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
              Aucune preuve Mobile Money en attente de vérification.
            </div>
          ) : (
            pendingList.map((item) => {
              const busy = processingId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-white/[0.04] border border-amber-500/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.supplierName}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#C7D300]/15 text-[#C7D300] border border-[#C7D300]/30">
                        {item.operatorLabel}
                      </span>
                      <span className="text-sm font-black text-emerald-400">${item.finalAmount} USD</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                      <span className="inline-flex items-center gap-1 font-mono bg-black/30 px-2 py-0.5 rounded">
                        <Hash size={11} className="text-[#C7D300]" />
                        {item.transactionRef}
                      </span>
                      {item.senderPhone && (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Phone size={11} />
                          {item.senderPhone}
                        </span>
                      )}
                      {item.createdAt && (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <Clock size={11} />
                          {new Date(item.createdAt).toLocaleString("fr-FR")}
                        </span>
                      )}
                    </div>
                    {item.note && <p className="text-xs text-gray-400 italic">« {item.note} »</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAction(item, "REJECT")}
                      className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Rejeter
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAction(item, "APPROVE")}
                      className="px-4 py-2 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-[#C7D300]/15"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Valider &amp; Activer (+30j)
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {recentHistory.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                Dernières validations traitées
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recentHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="truncate">
                      <span className="font-semibold text-gray-200">{h.supplierName}</span>
                      <span className="text-gray-500 ml-2 font-mono">{h.transactionRef}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        h.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {h.status === "APPROVED" ? `Validé ($${h.finalAmount})` : "Rejeté"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
