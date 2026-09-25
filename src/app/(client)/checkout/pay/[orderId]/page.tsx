"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Heart, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useCurrency } from "@/context/CurrencyContext";

type Provider = "MAKUTA" | "ORANGE_MONEY" | "AIRTEL_MONEY" | "MANUAL";

const PAYMENT_METHODS: { id: Provider; label: string; sublabel: string; icon: string; available: boolean }[] = [
  { id: "MAKUTA",       label: "Makuta",          sublabel: "Mobile Money",      icon: "💳", available: false },
  { id: "ORANGE_MONEY", label: "Orange Money",    sublabel: "Paiement mobile",   icon: "🟠", available: false },
  { id: "AIRTEL_MONEY", label: "Airtel Money",    sublabel: "Paiement mobile",   icon: "🔴", available: false },
  { id: "MANUAL",       label: "Cash / Virement", sublabel: "Validé par admin",  icon: "💵", available: true  },
];

export default function FinalPaymentPage() {
  const { orderId } = useParams();
  const { formatPrice } = useCurrency();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("MANUAL");
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return;
    getDoc(doc(db, "orders", orderId as string))
      .then(snap => {
        if (snap.exists()) setOrder({ id: snap.id, ...snap.data() });
        else setError("Commande introuvable.");
      })
      .catch(() => setError("Erreur lors du chargement."))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handlePay = async () => {
    if (!order) return;
    setIsProcessing(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          type: "ORDER",
          amount: order.remainingBalance ?? order.total ?? 0,
          currency: "USD",
          orderId: order.id,
          clientId: order.clientId,
          clientPhone: order.clientPhone,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Échec du paiement");
      setPaymentRef(data.referenceId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erreur de paiement");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  if (error && !order) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/" className="text-gray-900 font-bold underline">Retour à l'accueil</Link>
      </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col items-center justify-center p-4 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.6 }}
        className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Heart size={44} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Paiement Confirmé !</h1>
        {paymentRef && <p className="text-xs text-gray-400 mb-4 font-mono">Réf : {paymentRef}</p>}
        <p className="text-gray-600 mb-8 max-w-md">Votre commande est réglée. Merci de votre confiance.</p>
        <Link href="/" className="px-8 py-3 bg-[#0F1D27] text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
          Retour à l'accueil
        </Link>
      </motion.div>
    </div>
  );

  if (order?.status === "COMPLETED") return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldCheck size={40} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Commande déjà réglée</h1>
      <p className="text-gray-600 mb-8 max-w-md">Cette commande a déjà été payée.</p>
      <Link href="/" className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
        Retour à l'accueil
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-20">
      {/* Header */}
      <div className="bg-[#0F1D27] text-white">
        <div className="max-w-xl mx-auto px-4 py-5 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Paiement du solde</h1>
            <p className="text-gray-300 text-xs">Commande #{order?.id?.slice(0, 6).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* Récapitulatif */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-semibold">Récapitulatif</p>
          <div className="bg-gray-50 p-3 rounded-xl mb-4">
            <p className="text-xs text-gray-500">Adresse de livraison</p>
            <p className="font-medium text-gray-900 text-sm">{order?.clientAddress || "—"}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Sous-total articles</span>
              <span>{formatPrice(order?.itemsTotal ?? 0)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Frais d'approche (déjà payé)</span>
              <span>3 USD</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-3 border-t border-gray-100 mt-2">
              <span>Reste à payer</span>
              <span className="text-[#C7D300] text-xl">{formatPrice(order?.remainingBalance ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Méthodes de paiement */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-semibold">Mode de paiement</p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(method => (
              <button
                key={method.id}
                onClick={() => method.available && setSelectedProvider(method.id)}
                disabled={!method.available}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  selectedProvider === method.id && method.available
                    ? "border-[#0F1D27] bg-[#0F1D27]/5"
                    : method.available
                    ? "border-gray-100 hover:border-gray-200 bg-gray-50"
                    : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                }`}
              >
                <span className="text-2xl">{method.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{method.label}</p>
                  <p className="text-xs text-gray-400">{method.available ? method.sublabel : "Bientôt disponible"}</p>
                </div>
                {selectedProvider === method.id && method.available && (
                  <CheckCircle2 size={20} className="text-[#0F1D27]" />
                )}
                {!method.available && (
                  <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                    À venir
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Info sécurité */}
        <div className="flex items-start gap-3 text-xs text-gray-400 px-1">
          <ShieldCheck size={16} className="shrink-0 mt-0.5 text-green-500" />
          <p>Paiement sécurisé. Votre commande sera marquée comme réglée et le livreur en sera informé instantanément.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {/* Bouton payer */}
        <button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full bg-[#0F1D27] text-white font-bold py-4 rounded-xl shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? (
            <><Loader2 size={18} className="animate-spin" /> Traitement en cours...</>
          ) : (
            <><ChevronRight size={18} /> Payer {formatPrice(order?.remainingBalance ?? 0)}</>
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          En payant, vous acceptez nos{" "}
          <Link href="/legal" className="underline hover:text-gray-600">Conditions Générales d'Utilisation</Link>
        </p>
      </div>
    </div>
  );
}
