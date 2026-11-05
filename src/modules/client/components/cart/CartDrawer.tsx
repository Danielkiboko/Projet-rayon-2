"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  ShoppingBag, 
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
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
import { useClientProformas } from "@/hooks/useClientProformas";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import Link from "next/link";
import { generateHotelBookingReceiptPDF } from "@/lib/invoiceGenerator";
import { DirectBuyModal } from "@/modules/client/components/DirectBuyModal";

export function CartDrawer() {
  const { isCartOpen, closeCart, items, removeFromCart, updateQuantity, clearCart, subtotal, totalItems } = useCart();
  const { user, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  // 3 sections : Panier direct, Proformas Produits (style Alibaba), Immo & Hôtels
  const [activeSection, setActiveSection] = useState<"cart" | "proformas" | "immo">("cart");
  const [isDirectCheckoutOpen, setIsDirectCheckoutOpen] = useState(false);

  // Pending Proformas via unified hook
  const { pendingProformas, isLoading: isLoadingProformas } = useClientProformas();
  const [payingProformaId, setPayingProformaId] = useState<string | null>(null);
  const [proformaError, setProformaError] = useState("");

  // Pending Immo & Hotels
  const [pendingHotels, setPendingHotels] = useState<any[]>([]);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);

  // Listen to user's pending immo bookings
  useEffect(() => {
    if (!user || !isCartOpen) return;

    // 1. Fetch pending hotel bookings
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

    // 2. Fetch pending property visits
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
      unsubHotels();
      unsubVisits();
    };
  }, [user, isCartOpen]);

  // Reset error when cart closes
  useEffect(() => {
    if (!isCartOpen) {
      setProformaError("");
      setPayingProformaId(null);
    } else {
      if (items.length > 0) {
        setActiveSection("cart");
      } else if (pendingProformas.length > 0) {
        setActiveSection("proformas");
      }
    }
  }, [isCartOpen, items.length, pendingProformas.length]);

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

      <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto max-w-full flex">
        <div className="w-full sm:w-screen sm:max-w-md max-h-[92vh] sm:max-h-full bg-white shadow-2xl flex flex-col rounded-t-3xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-gray-100 animate-in slide-in-from-bottom sm:slide-in-from-right duration-250">
          
          {/* Mobile Drag Indicator Handle */}
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

          {/* Header */}
          <div className="p-4 sm:p-5 bg-[#0F1D27] text-white flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#C7D300] text-[#0F1D27] flex items-center justify-center font-bold shadow-md shadow-[#C7D300]/30">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="font-heading font-black text-sm sm:text-base tracking-tight">Panier & Proformas Rayons</h2>
                <p className="text-[11px] text-gray-400">
                  Commandes et cotations en attente de paiement
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

          {/* Segmented Top Selector: Panier Direct | Devis Proforma | Immo & Hôtels */}
          <div className="flex border-b border-gray-200 bg-gray-50/90 px-3 pt-2 gap-2 overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection("cart")}
              className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSection === "cart"
                  ? "bg-white text-gray-900 border-[#C7D300] shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <ShoppingCart size={14} className={activeSection === "cart" || items.length > 0 ? "text-[#0F1D27]" : "text-gray-400"} />
              <span>Mon Panier</span>
              {items.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#C7D300] text-[#0F1D27] text-[10px] rounded-full font-black">
                  {items.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("proformas")}
              className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSection === "proformas"
                  ? "bg-white text-gray-900 border-[#FF6B35] shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <FileText size={14} className={activeSection === "proformas" || pendingProformas.length > 0 ? "text-[#FF6B35]" : "text-gray-400"} />
              <span>Devis &amp; Proformas</span>
              {pendingProformas.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#FF6B35] text-white text-[10px] rounded-full font-black animate-pulse">
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
              <span>Immo &amp; Hôtels</span>
              {pendingImmoTotal > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded-full font-black">
                  {pendingImmoTotal}
                </span>
              )}
            </button>
          </div>

          {/* SECTION 0: ARTICLES DU PANIER DIRECT */}
          {activeSection === "cart" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-8">
                {/* Banner Réassurance */}
                <div className="bg-[#0F1D27]/5 border border-[#C7D300]/40 rounded-2xl p-3 text-xs text-gray-800 bg-linear-to-br from-[#0F1D27]/5 to-[#C7D300]/10">
                  <div className="flex items-center gap-1.5 font-bold text-[#0F1D27] mb-1">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>Livraison Express &amp; Paiement Garanti</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Réglez en espèces à la livraison (Cash on Delivery) ou par Mobile Money après réception et inspection de vos articles.
                  </p>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-3xl bg-gray-100 text-gray-500 flex items-center justify-center mb-3">
                      <ShoppingCart size={32} />
                    </div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1">Votre panier est vide</h4>
                    <p className="text-xs text-gray-500 max-w-xs mb-5">
                      Explorez nos rayons Connect, Mode et Saveurs et ajoutez des articles pour une livraison rapide à Kinshasa et Lubumbashi.
                    </p>
                    <Link
                      href="/"
                      onClick={closeCart}
                      className="px-5 py-2.5 bg-[#C7D300] text-[#0F1D27] text-xs font-bold rounded-xl hover:bg-[#b5c000] transition-colors"
                    >
                      Découvrir les Rayons
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                      <span>{items.length} article(s) dans le panier</span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-red-500 hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        Vider le panier
                      </button>
                    </div>

                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="bg-white rounded-2xl border border-gray-200/90 p-3 shadow-2xs flex items-center gap-3"
                      >
                        <div className="w-16 h-16 rounded-xl bg-gray-50 overflow-hidden border border-gray-100 shrink-0">
                          <img
                            src={it.image || "/images/placeholder.png"}
                            alt={it.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-xs truncate leading-snug">
                            {it.title}
                          </h4>
                          <span className="text-[10px] font-semibold uppercase text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            {it.rayon || it.category || "Rayon"}
                          </span>
                          <div className="font-extrabold text-sm text-[#0F1D27] mt-1">
                            {formatPrice(it.price * it.quantity)}
                          </div>
                        </div>

                        {/* Stepper + Remove */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => removeFromCart(it.id)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>

                          <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (it.quantity <= 1) {
                                  removeFromCart(it.id);
                                } else {
                                  updateQuantity(it.id, it.quantity - 1);
                                }
                              }}
                              className="w-6 h-6 flex items-center justify-center font-bold text-gray-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-xs font-bold text-gray-900 w-5 text-center">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(it.id, it.quantity + 1)}
                              className="w-6 h-6 flex items-center justify-center font-bold text-gray-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Panier Footer Checkout Bar */}
              {items.length > 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 block">Total estimé :</span>
                      <span className="text-lg font-black text-gray-900">{formatPrice(subtotal)}</span>
                    </div>
                    <span className="text-[11px] text-gray-500 text-right">
                      Livraison Kinshasa calculée<br />à l'étape suivante
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDirectCheckoutOpen(true)}
                    className="w-full py-3.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-black rounded-xl text-sm transition-all shadow-md shadow-[#C7D300]/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag size={17} />
                    <span>Commander ({items.length} article{items.length > 1 ? "s" : ""}) — {formatPrice(subtotal)}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: PRODUITS & FACTURES PROFORMA EN ATTENTE DE PAIEMENT */}
          {activeSection === "proformas" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-8">
                
                {/* Banner Séquestre Garanti Rayons 100% */}
                <div className="bg-[#0F1D27]/5 border border-[#C7D300]/40 rounded-2xl p-3 text-xs text-gray-800 bg-linear-to-br from-[#0F1D27]/5 to-[#C7D300]/10">
                  <div className="flex items-center gap-1.5 font-bold text-[#0F1D27] mb-1">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>Paiement Séquestré & Garanti Rayons 100%</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Votre argent reste bloqué en sécurité par Rayons et n&apos;est déversé au fournisseur qu&apos;après vérification et conformité de votre commande lors de la livraison.
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

      {/* Modal Achat Express pour les articles du panier */}
      <DirectBuyModal
        isOpen={isDirectCheckoutOpen}
        onClose={() => setIsDirectCheckoutOpen(false)}
        items={items}
        onOrderSuccess={() => {
          clearCart();
          closeCart();
        }}
      />
    </div>
  );
}
