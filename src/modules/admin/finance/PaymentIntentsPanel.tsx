"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Phone, Mail, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface PaymentIntentItem {
  id: string;
  reference: string;
  operatorTxRef?: string | null;
  email: string;
  phone: string;
  paymentPhone: string;
  paymentMethod: string;
  operator: string;
  amount: number;
  currency: string;
  status: "INITIATED" | "COMPLETED" | "RESOLVED" | "CANCELLED";
  resolutionNote?: string | null;
  createdAt: string | null;
}

export default function PaymentIntentsPanel() {
  const { user } = useAuth();
  const [intents, setIntents] = useState<PaymentIntentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadIntents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/supplier/payment-intent", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.intents)) {
        setIntents(json.intents);
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadIntents();
  }, [loadIntents]);

  const handleUpdate = async (item: PaymentIntentItem, action: "RESOLVE" | "CANCEL") => {
    const promptMsg =
      action === "RESOLVE"
        ? `Note de résolution pour ${item.email} (Réf: ${item.reference}) :`
        : `Motif d'annulation (ex: aucun dépôt reçu) pour ${item.email} :`;
    const note = prompt(promptMsg, action === "RESOLVE" ? "Paiement vérifié et compte activé" : "Aucun paiement reçu");
    if (note === null) return;

    setBusyId(item.id);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/supplier/payment-intent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ intentId: item.id, action, note }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de la mise à jour.");
      }
      await loadIntents();
    } catch (err: any) {
      alert(err.message || "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  const interrupted = intents.filter((i) => i.status === "INITIATED");
  if (!loading && interrupted.length === 0) return null;

  return (
    <div className="bg-amber-500/[0.07] border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                Traces Anti-Coupure — Inscriptions Fournisseurs Interrompues
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-[#0F1D27]">
                {interrupted.length} à vérifier
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Candidats ayant initié un paiement d&apos;adhésion ($50) mais dont la connexion a coupé avant la fin de l&apos;Étape 2. Recoupez la référence avec votre relevé Mobile Money / Visa.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadIntents}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      <div className="divide-y divide-amber-500/15">
        {interrupted.map((item) => (
          <div
            key={item.id}
            className="py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-[#C7D300] bg-black/30 px-2 py-0.5 rounded border border-white/10">
                  {item.reference}
                </span>
                {item.operatorTxRef && item.operatorTxRef !== item.reference && (
                  <span className="font-mono text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    SMS: {item.operatorTxRef}
                  </span>
                )}
                <span className="font-bold text-white">${item.amount} {item.currency}</span>
                <span className="text-[11px] text-amber-200/80">· {item.operator}</span>
                {item.createdAt && (
                  <span className="text-[10px] text-gray-400">
                    · {new Date(item.createdAt).toLocaleString("fr-FR")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap text-gray-300">
                <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1 hover:text-white">
                  <Mail size={12} className="text-sky-400" />
                  <span>{item.email}</span>
                </a>
                {(item.paymentPhone || item.phone) && (
                  <a
                    href={`tel:${item.paymentPhone || item.phone}`}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <Phone size={12} className="text-emerald-400" />
                    <span>{item.paymentPhone || item.phone}</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => handleUpdate(item, "RESOLVE")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={13} />
                <span>Résolu</span>
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => handleUpdate(item, "CANCEL")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                <XCircle size={13} />
                <span>Non payé</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
