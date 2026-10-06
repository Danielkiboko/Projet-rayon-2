"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  ShoppingBag, 
  ArrowRight, 
  CreditCard, 
  FileText, 
  Hotel, 
  Calendar, 
  Clock, 
  Bed, 
  MessageSquare, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  Users,
  Store,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import Link from "next/link";
import { generateHotelBookingReceiptPDF } from "@/lib/invoiceGenerator";

export function CartDrawer() {
  const { isCartOpen, closeCart } = useCart();
  const { user, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  // 2 main sections: Proformas Produits (Alibaba style) & Immo / Hôtels
  const [activeSection, setActiveSection] = useState<"proformas" | "immo">("proformas");

  // Pending Proformas & Orders
  const [pendingProformas, setPendingProformas] = useState<any[]>([]);
  const [payingProformaId, setPayingProformaId] = useState<string | null>(null);
  const [proformaError, setProformaError] = useState("");
  const [isLoadingProformas, setIsLoadingProformas] = useState(true);

  // Pending Immo & Hotels
  const [pendingHotels, setPendingHotels] = useState<any[]>([]);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);

  // Listen to user's pending proformas and pending immo bookings
  useEffect(() => {
    if (!user || !isCartOpen) {
      setIsLoadingProformas(false);
      return;
    }

    setIsLoadingProformas(true);

    // 1. Fetch user's chats to listen to pending proforma messages sent by suppliers (Alibaba Trade Assurance proformas)
    const qChats = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid),
      limit(40)
    );

    const messageUnsubs: (() => void)[] = [];

    const unsubChats = onSnapshot(qChats, (snapshot) => {
      messageUnsubs.forEach(unsub => unsub());
      messageUnsubs.length = 0;

      if (snapshot.empty) {
        setPendingProformas([]);
        setIsLoadingProformas(false);
        return;
      }

      const proformasMap = new Map<string, any>();

      snapshot.docs.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;
        const supplierName = chatData.supplierName || chatData.productName || chatData.propertyTitle || "Fournisseur Partenaire";
        const supplierId = chatData.supplierId;

        const qMsg = query(
          collection(db, "chats", chatId, "messages"),
          where("type", "==", "proforma")
        );

        const unsubMsg = onSnapshot(qMsg, (msgSnap) => {
          msgSnap.docs.forEach((msgDoc) => {
            const m = msgDoc.data();
            if (m.proforma && m.proforma.status === "pending") {
              const pfKey = `${chatId}_${msgDoc.id}`;
              const unitP = Number(m.proforma.unitPrice || (m.proforma.price / (m.proforma.quantity || 1))) || 0;
              const totalP = Number(m.proforma.totalPrice || m.proforma.price) || 0;
              const deliveryF = Number(m.proforma.deliveryFee ?? 3);

              proformasMap.set(pfKey, {
                chatId,
                messageId: msgDoc.id,
                supplierId: m.proforma.supplierId || supplierId,
                supplierName: supplierName,
                productName: m.proforma.productName || "Produit sous Facture Proforma",
                productId: m.proforma.productId || null,
                quantity: Number(m.proforma.quantity) || 1,
                unitPrice: unitP,
                totalPrice: totalP,
                deliveryFee: deliveryF,
                grandTotal: totalP + deliveryF,
                status: m.proforma.status,
                createdAt: m.createdAt,
                type: m.proforma.type || "product"
              });
            } else if (m.proforma && m.proforma.status !== "pending") {
              proformasMap.delete(`${chatId}_${msgDoc.id}`);
            }
          });

          const list = Array.from(proformasMap.values());
          list.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
          });
          setPendingProformas(list);
          setIsLoadingProformas(false);
        }, (err) => {
          console.warn("Cart proforma messages error:", err);
          setIsLoadingProformas(false);
        });

        messageUnsubs.push(unsubMsg);
      });
    }, (err) => {
      console.warn("Cart chats listener error:", err);
      setIsLoadingProformas(false);
    });

    // 2. Fetch pending hotel bookings
    const qHotels = query(
      collection(db, "hotel_bookings"),
      where("clientId", "==", user.uid),
      limit(20)
    );
    const unsubHotels = onSnapshot(qHotels, (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((h: any) => ["PENDING", "pending", "AWAITING_PAYMENT"].includes(h.status || ""));
      setPendingHotels(list);
    }, (err) => {
      console.warn("Cart hotels listener error:", err);
    });

    // 3. Fetch pending property visits
    const qVisits = query(
      collection(db, "visits"),
      where("clientId", "==", user.uid),
      limit(20)
    );
    const unsubVisits = onSnapshot(qVisits, (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => ["PENDING", "pending"].includes(v.status || ""));
      setPendingVisits(list);
    }, (err) => {
      console.warn("Cart visits listener error:", err);
    });

    return () => {
      unsubChats();
      messageUnsubs.forEach(u => u());
      unsubHotels();
      unsubVisits();
    };
  }, [user, isCartOpen]);

  // Reset error when cart closes
  useEffect(() => {
    if (!isCartOpen) {
      setProformaError("");
      setPayingProformaId(null);
    }
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const pendingImmoTotal = pendingHotels.length + pendingVisits.length;
  const totalProformasSum = pendingProformas.reduce((sum, item) => sum + (item.grandTotal || 0), 0);

  const handlePayProforma = async (pf: any) => {
    if (!user) {
      router.push("/login");
      return;
    }

    setPayingProformaId(pf.messageId);
    setProformaError("");

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

      closeCart();
      router.push(`/order/${data.orderId}/tracking`);
    } catch (error: any) {
      console.error("Erreur de règlement proforma:", error);
      setProformaError(error.message || "Impossible de régler cette proforma. Veuillez réessayer.");
    } finally {
      setPayingProformaId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={closeCart}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-100 animate-in slide-in-from-right duration-250">
          
          {/* Header */}
          <div className="p-4 sm:p-5 bg-[#0F1D27] text-white flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF6600] text-white flex items-center justify-center font-bold shadow-md shadow-[#FF6600]/30">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="font-heading font-black text-sm sm:text-base tracking-tight">Panier & Proformas Rayons</h2>
                <p className="text-[11px] text-gray-400">
                  Produits et proformas en attente de paiement
                </p>
              </div>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Segmented Top Selector: Produits Proforma | Immo & Hôtels */}
          <div className="flex border-b border-gray-200 bg-gray-50/90 px-3 pt-2 gap-2 overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection("proformas")}
              className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSection === "proformas"
                  ? "bg-white text-gray-900 border-[#FF6600] shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <FileText size={14} className={activeSection === "proformas" || pendingProformas.length > 0 ? "text-[#FF6600]" : "text-gray-400"} />
              <span>Produits & Proformas</span>
              {pendingProformas.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#FF6600] text-white text-[10px] rounded-full font-black animate-pulse">
                  {pendingProformas.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("immo")}
              className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSection === "immo"
                  ? "bg-white text-gray-900 border-blue-600 shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <Hotel size={14} className={activeSection === "immo" || pendingImmoTotal > 0 ? "text-blue-600" : "text-gray-400"} />
              <span>Immo & Hôtels</span>
              {pendingImmoTotal > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded-full font-black">
                  {pendingImmoTotal}
                </span>
              )}
            </button>
          </div>

          {/* SECTION 1: PRODUITS & FACTURES PROFORMA EN ATTENTE DE PAIEMENT */}
          {activeSection === "proformas" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                
                {/* Banner Trade Assurance Style Alibaba */}
                <div className="bg-[#FF6600]/10 border border-[#FF6600]/30 rounded-2xl p-3 text-xs text-gray-800">
                  <div className="flex items-center gap-1.5 font-bold text-[#FF6600] mb-0.5">
                    <ShieldCheck size={16} />
                    <span>Factures Proforma & Commandes Prêtes à Payer</span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Ces produits correspondent aux cotations officielles envoyées par vos fournisseurs. Validez et payez pour expédition immédiate.
                  </p>
                </div>

                {proformaError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{proformaError}</span>
                  </div>
                )}

                {/* Not Logged In View */}
                {!user ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center mb-3">
                      <ShoppingBag size={28} />
                    </div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1">Connexion requise</h4>
                    <p className="text-xs text-gray-500 max-w-xs mb-4">
                      Connectez-vous à votre compte pour consulter les proformas et commandes en attente de paiement.
                    </p>
                    <Link
                      href="/login"
                      onClick={closeCart}
                      className="px-5 py-2.5 bg-[#FF6600] text-white text-xs font-bold rounded-xl hover:bg-[#e65c00] transition-colors"
                    >
                      Se connecter
                    </Link>
                  </div>
                ) : isLoadingProformas ? (
                  /* Loading State */
                  <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-[#FF6600] mb-2" />
                    <span className="text-xs">Chargement de vos proformas en attente...</span>
                  </div>
                ) : pendingProformas.length === 0 ? (
                  /* Empty Proformas State (Alibaba Style) */
                  <div className="p-8 text-center flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-3">
                      <FileText size={32} />
                    </div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1">Aucun produit en attente de paiement</h4>
                    <p className="text-xs text-gray-400 max-w-xs mb-5">
                      Dès qu'un fournisseur vous transmet une facture proforma suite à une négociation ou une commande, elle s'affiche ici pour être validée et réglée en 1 clic.
                    </p>
                    <Link
                      href="/"
                      onClick={closeCart}
                      className="px-5 py-2.5 bg-[#FF6600] text-white text-xs font-bold rounded-xl hover:bg-[#e65c00] transition-colors"
                    >
                      Explorer les Rayons & Contacter les Vendeurs
                    </Link>
                  </div>
                ) : (
                  /* List of Pending Proforma Products */
                  <div className="space-y-3">
                    {pendingProformas.map((pf) => {
                      const isCurrentlyPaying = payingProformaId === pf.messageId;

                      return (
                        <div
                          key={`${pf.chatId}_${pf.messageId}`}
                          className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-2xs hover:shadow-xs transition-shadow"
                        >
                          {/* Supplier Header */}
                          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
                            <div>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                                <Store size={12} className="text-[#FF6600]" />
                                <span className="truncate">{pf.supplierName || "Fournisseur Certifié"}</span>
                              </div>
                              <h4 className="font-bold text-gray-900 text-xs mt-0.5 leading-snug">
                                {pf.productName}
                              </h4>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                              Proforma envoyée
                            </span>
                          </div>

                          {/* Pricing Details */}
                          <div className="py-2.5 grid grid-cols-2 gap-2 text-[11px] text-gray-600 bg-gray-50/60 rounded-xl p-2.5 my-2">
                            <div>
                              <span className="text-gray-400 block text-[10px]">Quantité :</span>
                              <span className="font-bold text-gray-800">{pf.quantity} pièce(s)</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Prix unitaire :</span>
                              <span className="font-semibold text-gray-800">{formatPrice(pf.unitPrice)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Sous-total :</span>
                              <span className="font-semibold text-gray-800">{formatPrice(pf.totalPrice)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Expédition / Livraison :</span>
                              <span className="font-semibold text-gray-800">{formatPrice(pf.deliveryFee)}</span>
                            </div>
                          </div>

                          {/* Action Buttons & Total */}
                          <div className="pt-1 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-gray-400 block">Total à payer :</span>
                              <span className="font-black text-[#FF6600] text-sm sm:text-base">
                                {formatPrice(pf.grandTotal)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {pf.supplierId && (
                                <Link
                                  href={`/dashboard/client/chats?supplierId=${pf.supplierId}`}
                                  onClick={closeCart}
                                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
                                  title="Discuter avec le fournisseur"
                                >
                                  <MessageSquare size={14} />
                                </Link>
                              )}

                              <button
                                type="button"
                                disabled={isCurrentlyPaying}
                                onClick={() => handlePayProforma(pf)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                {isCurrentlyPaying ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Paiement...</span>
                                  </>
                                ) : (
                                  <>
                                    <CreditCard size={13} />
                                    <span>Valider & Payer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Footer Summary if Proformas exist */}
              {pendingProformas.length > 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-medium">Total proformas en attente ({pendingProformas.length}) :</span>
                    <span className="font-extrabold text-[#FF6600] text-sm">{formatPrice(totalProformasSum)}</span>
                  </div>
                  <Link
                    href="/dashboard/client?tab=proformas"
                    onClick={closeCart}
                    className="w-full py-2.5 bg-gray-900 hover:bg-[#0F1D27] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Gérer mes proformas sur mon tableau de bord</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: IMMOBILIER & HÔTELS EN ATTENTE */}
          {activeSection === "immo" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Hôtels */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Hotel size={14} className="text-blue-600" />
                      <span>Réservations d'Hôtels ({pendingHotels.length})</span>
                    </span>
                    <Link
                      href="/rayon/immo"
                      onClick={closeCart}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      Rayon Hôtels
                    </Link>
                  </div>

                  {pendingHotels.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-400">
                      Aucune réservation d'hôtel en attente de paiement
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingHotels.map((h) => (
                        <div key={h.id} className="bg-white rounded-2xl border border-blue-200/80 p-3.5 shadow-2xs">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-bold text-gray-900 text-xs">
                              {h.propertyTitle || "Séjour Hôtel"}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                              En attente
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-600 space-y-1 mb-2.5">
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-blue-500" />
                              <span>Séjour du <strong>{h.checkInDate || "—"}</strong> au <strong>{h.checkOutDate || "—"}</strong></span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Bed size={12} className="text-blue-500" />
                              <span>{h.roomType || "Chambre standard"} • {h.guestsCount || 1} personne(s)</span>
                            </div>
                            {h.totalPrice && (
                              <div className="font-bold text-primary text-xs mt-1">
                                Montant estimé : {formatPrice(h.totalPrice)}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => generateHotelBookingReceiptPDF(h)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Télécharger Bon officiel PDF"
                            >
                              <FileText size={12} />
                              Bon PDF
                            </button>

                            {h.supplierId && (
                              <Link
                                href={`/dashboard/client/chats?supplierId=${h.supplierId}`}
                                onClick={closeCart}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                <MessageSquare size={12} />
                                Contacter l'hôtel
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Visites Immobilières */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Calendar size={14} className="text-emerald-600" />
                      <span>Visites Immobilières ({pendingVisits.length})</span>
                    </span>
                    <Link
                      href="/rayon/immo"
                      onClick={closeCart}
                      className="text-[11px] text-emerald-600 hover:underline font-semibold"
                    >
                      Rayon Immo
                    </Link>
                  </div>

                  {pendingVisits.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-400">
                      Aucune demande de visite en attente
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingVisits.map((v) => (
                        <div key={v.id} className="bg-white rounded-2xl border border-emerald-200/80 p-3.5 shadow-2xs">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-bold text-gray-900 text-xs">
                              {v.propertyTitle || "Bien immobilier"}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                              Visite demandée
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-600 space-y-1 mb-2.5">
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-emerald-500" />
                              <span>Date souhaitée : <strong>{v.requestedDate || "Non spécifiée"}</strong></span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                            {v.supplierId && (
                              <Link
                                href={`/dashboard/client/chats?supplierId=${v.supplierId}`}
                                onClick={closeCart}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                <MessageSquare size={12} />
                                Contacter l'agent
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 text-center shrink-0">
                <Link
                  href="/dashboard/client?tab=hotels"
                  onClick={closeCart}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                >
                  <span>Gérer tous mes séjours et visites</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
