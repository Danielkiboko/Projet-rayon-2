"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { motion } from "framer-motion";
import { 
  FileText, 
  CreditCard, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Store, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useCurrency } from "@/context/CurrencyContext";

export interface ProformaItem {
  chatId: string;
  messageId: string;
  supplierId?: string;
  supplierName?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryFee: number;
  status: "pending" | "paid" | string;
  orderId?: string;
  createdAt?: any;
  type?: "product" | "hotel" | string;
}

interface ClientProformaSectionProps {
  onProformaCountChange?: (count: number) => void;
  onOpenChat?: (chatId: string, supplierId?: string) => void;
}

export default function ClientProformaSection({ 
  onProformaCountChange,
  onOpenChat 
}: ClientProformaSectionProps) {
  const { user, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const [proformas, setProformas] = useState<ProformaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch user's chats
    const qChats = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid),
      limit(40)
    );

    const messageUnsubs: (() => void)[] = [];

    const unsubChats = onSnapshot(qChats, (snapshot) => {
      // Clear previous message listeners
      messageUnsubs.forEach(unsub => unsub());
      messageUnsubs.length = 0;

      if (snapshot.empty) {
        setProformas([]);
        setIsLoading(false);
        onProformaCountChange?.(0);
        return;
      }

      const allProformasMap = new Map<string, ProformaItem>();

      snapshot.docs.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;
        const supplierName = chatData.productName || chatData.propertyTitle || "Fournisseur Partenaire";
        const supplierId = chatData.supplierId;

        // Query proforma messages in this chat
        const qMsg = query(
          collection(db, "chats", chatId, "messages"),
          where("type", "==", "proforma")
        );

        const unsubMsg = onSnapshot(qMsg, (msgSnap) => {
          msgSnap.docs.forEach((msgDoc) => {
            const m = msgDoc.data();
            if (m.proforma) {
              const pfKey = `${chatId}_${msgDoc.id}`;
              const unitP = Number(m.proforma.unitPrice || (m.proforma.price / (m.proforma.quantity || 1))) || 0;
              const totalP = Number(m.proforma.totalPrice || m.proforma.price) || 0;
              const deliveryF = Number(m.proforma.deliveryFee ?? 3);

              allProformasMap.set(pfKey, {
                chatId,
                messageId: msgDoc.id,
                supplierId: m.proforma.supplierId || supplierId,
                supplierName: supplierName,
                productName: m.proforma.productName || "Devis / Facture Proforma",
                quantity: Number(m.proforma.quantity) || 1,
                unitPrice: unitP,
                totalPrice: totalP,
                deliveryFee: deliveryF,
                status: m.proforma.status || "pending",
                orderId: m.proforma.orderId,
                createdAt: m.createdAt,
                type: m.proforma.type || "product"
              });
            }
          });

          // Convert map to sorted array
          const list = Array.from(allProformasMap.values());
          list.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
          });

          setProformas(list);
          setIsLoading(false);
          const pendingCount = list.filter(p => p.status === "pending").length;
          onProformaCountChange?.(pendingCount);
        }, (err) => {
          console.warn("Proforma messages listener warning:", err);
          setIsLoading(false);
        });

        messageUnsubs.push(unsubMsg);
      });
    }, (err) => {
      console.warn("Chats listener warning:", err);
      setIsLoading(false);
    });

    return () => {
      unsubChats();
      messageUnsubs.forEach(unsub => unsub());
    };
  }, [user, onProformaCountChange]);

  const handlePayProforma = async (pf: ProformaItem) => {
    if (!user) return;

    if (pf.status === "paid") {
      if (pf.orderId) {
        window.location.href = `/order/${pf.orderId}/tracking`;
      }
      return;
    }

    setPayingId(pf.messageId);

    try {
      const res = await fetch("/api/orders/pay-proforma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: pf.chatId,
          messageId: pf.messageId,
          clientId: user.uid,
          clientName: userData?.displayName || userData?.name || user.displayName || user.email || "Client",
          clientPhone: userData?.phone || userData?.phoneNumber || user.phoneNumber || "",
          clientAddress: userData?.address || "Kinshasa"
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du règlement de la proforma");
      }

      window.location.href = `/order/${data.orderId}/tracking`;
    } catch (error: any) {
      console.error("Erreur de règlement proforma:", error);
      alert(error.message || "Impossible de régler cette proforma. Veuillez réessayer.");
    } finally {
      setPayingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Recherche de vos devis et factures proforma...</p>
      </div>
    );
  }

  if (proformas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto mb-4">
          <FileText size={32} />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Aucun devis ou facture proforma en attente</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mb-5">
          Lorsque vous négociez ou demandez une cotation sur mesure à un fournisseur ou hôtel, ses factures proforma officielles apparaîtront ici pour validation et règlement en 1 clic.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors"
        >
          Découvrir les catalogues
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proformas.map((pf) => {
        const isPaid = pf.status === "paid";
        const grandTotal = pf.totalPrice + pf.deliveryFee;
        const isCurrentlyPaying = payingId === pf.messageId;

        return (
          <motion.div
            key={`${pf.chatId}_${pf.messageId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-5 sm:p-6 transition-all bg-white shadow-xs ${
              isPaid
                ? "border-emerald-200/80 bg-emerald-50/20"
                : "border-amber-200/80 hover:border-amber-400/80"
            }`}
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{pf.productName}</span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                      isPaid 
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                    }`}>
                      {isPaid ? "Payé / Confirmé" : "En attente de paiement"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <Store size={12} className="text-gray-400" />
                    <span>Émis par : <strong className="text-gray-700">{pf.supplierName}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-right sm:self-center">
                <div className="text-xs text-gray-400">Montant total de l'offre</div>
                <div className="text-lg sm:text-xl font-black text-gray-900">
                  {formatPrice(grandTotal)}
                </div>
              </div>
            </div>

            {/* Financial Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 text-xs bg-gray-50/80 rounded-xl my-4 px-4 border border-gray-100">
              <div>
                <span className="text-gray-400 block">Quantité</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{pf.quantity} pièce(s)</span>
              </div>
              <div>
                <span className="text-gray-400 block">Prix unitaire</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{formatPrice(pf.unitPrice)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Frais de livraison</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{formatPrice(pf.deliveryFee)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Garantie Trade Assurance</span>
                <span className="font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={13} /> Active 100%
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-gray-500">
                {isPaid ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} /> Commande validée et envoyée aux livreurs.
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium flex items-center gap-1">
                    <Clock size={13} /> Offre réservée • Règlement sécurisé garanti par Rayons.net.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* Chat with supplier */}
                <Link
                  href={`/dashboard/client/chats?supplierId=${pf.supplierId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors shadow-2xs"
                >
                  <MessageSquare size={13} className="text-primary" />
                  <span>Négocier / Discuter</span>
                </Link>

                {/* Pay Proforma */}
                {isPaid ? (
                  pf.orderId && (
                    <Link
                      href={`/order/${pf.orderId}/tracking`}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <Truck size={13} />
                      <span>Suivre la livraison</span>
                    </Link>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePayProforma(pf)}
                    disabled={isCurrentlyPaying}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20 active:scale-95 cursor-pointer disabled:opacity-60"
                  >
                    {isCurrentlyPaying ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Validation en cours...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        <span>Payer l'acompte / commande ({formatPrice(grandTotal)})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
