"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Truck, 
  MapPin, 
  Banknote, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ShieldCheck,
  FileText,
  Hotel,
  Calendar,
  Clock,
  CreditCard,
  MessageSquare,
  Bed,
  Users,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, query, where, onSnapshot, limit } from "firebase/firestore";
import Link from "next/link";
import { sendClientInAppNotification } from "@/lib/inAppNotification";
import { generateHotelBookingReceiptPDF } from "@/lib/invoiceGenerator";
import { KINSHASA_COMMUNES } from "@/lib/kinshasaDelivery";

export function CartDrawer() {
  const { 
    items, 
    isCartOpen, 
    closeCart, 
    updateQuantity, 
    removeFromCart, 
    clearCart, 
    subtotal, 
    totalItems 
  } = useCart();
  const { user, userData } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const router = useRouter();

  // Navigation tabs in cart: Cart items | Pending Supplier Proformas | Real Estate & Hotels
  const [cartTab, setCartTab] = useState<"items" | "proformas" | "immo">("items");

  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [selectedCommune, setSelectedCommune] = useState("Gombe");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "MOBILE_MONEY">("CASH_ON_DELIVERY");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  // Pending Proformas & Orders
  const [pendingProformas, setPendingProformas] = useState<any[]>([]);
  const [payingProformaId, setPayingProformaId] = useState<string | null>(null);
  const [proformaError, setProformaError] = useState("");

  // Pending Immo & Hotels
  const [pendingHotels, setPendingHotels] = useState<any[]>([]);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setClientName(userData?.displayName || userData?.name || user.displayName || "");
      setClientPhone(userData?.phone || user.phoneNumber || "");
      if (userData?.commune) setSelectedCommune(userData.commune);
      if (userData?.address) setDeliveryAddress(userData.address);
    }
  }, [user, userData]);

  // Reset checkout view when drawer is closed
  useEffect(() => {
    if (!isCartOpen) {
      setStep("cart");
      setError("");
      setProformaError("");
      setCreatedOrder(null);
    }
  }, [isCartOpen]);

  // Listen to user's pending proformas and pending immo
  useEffect(() => {
    if (!user || !isCartOpen) return;

    // 1. Fetch user's chats to listen to pending proforma messages sent by suppliers
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
        return;
      }

      const proformasMap = new Map<string, any>();

      snapshot.docs.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;
        const supplierName = chatData.productName || chatData.propertyTitle || "Fournisseur Partenaire";
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
                productName: m.proforma.productName || "Devis / Facture Proforma",
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
        }, (err) => {
          console.warn("Cart proforma messages error:", err);
        });

        messageUnsubs.push(unsubMsg);
      });
    }, (err) => {
      console.warn("Cart chats listener error:", err);
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

  // Intelligent initial tab selection: if user has no standard cart items but has pending proformas, show proformas
  useEffect(() => {
    if (isCartOpen) {
      if (items.length === 0 && pendingProformas.length > 0) {
        setCartTab("proformas");
      } else if (items.length === 0 && (pendingHotels.length > 0 || pendingVisits.length > 0)) {
        setCartTab("immo");
      }
    }
  }, [isCartOpen, items.length, pendingProformas.length, pendingHotels.length, pendingVisits.length]);

  if (!isCartOpen) return null;

  const activeCommuneObj = KINSHASA_COMMUNES.find(c => c.name === selectedCommune) || KINSHASA_COMMUNES[0];
  const deliveryFee = items.length > 0 ? activeCommuneObj.fee : 0;
  const grandTotal = subtotal + deliveryFee;
  const pendingImmoTotal = pendingHotels.length + pendingVisits.length;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!clientName.trim()) {
      setError("Veuillez renseigner votre nom complet.");
      return;
    }
    if (!clientPhone.trim()) {
      setError("Veuillez renseigner votre numéro de téléphone pour le livreur.");
      return;
    }
    if (!deliveryAddress.trim()) {
      setError("Veuillez indiquer une adresse ou un repère précis à Kinshasa.");
      return;
    }

    setIsSubmitting(true);

    try {
      const orderId = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      
      const supplierIds = Array.from(new Set(items.map(it => it.supplierId || "admin")));
      const fullAddress = `${deliveryAddress.trim()}, ${selectedCommune}, Kinshasa`;

      const orderData = {
        id: orderId,
        clientId: user ? user.uid : "GUEST",
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientAddress: fullAddress,
        supplierId: items[0]?.supplierId || "admin",
        supplierIds: supplierIds,
        items: items.map(it => ({
          productId: it.id,
          productName: it.title,
          quantity: it.quantity,
          price: it.price,
          image: it.image || "",
          supplierId: it.supplierId || "admin"
        })),
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        totalAmount: grandTotal,
        remainingBalance: grandTotal,
        currency: currency,
        deliveryDetails: {
          city: "Kinshasa",
          commune: selectedCommune,
          address: deliveryAddress.trim(),
          recipientName: clientName.trim(),
          recipientPhone: clientPhone.trim()
        },
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === "CASH_ON_DELIVERY" ? "PAYMENT_ON_DELIVERY" : "AWAITING_PAYMENT",
        status: "CONFIRMED_AWAITING_DRIVER",
        createdAt: serverTimestamp(),
        clientLocation: {
          city: "Kinshasa",
          commune: selectedCommune
        }
      };

      // 1. Enregistrement Firestore
      await setDoc(doc(db, "orders", orderId), orderData);

      // 2. Décrémenter stock pour chaque produit
      for (const it of items) {
        try {
          await fetch("/api/orders/update-stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: it.id,
              quantity: it.quantity,
              action: "decrement"
            })
          });
        } catch (stkErr) {
          console.warn("Stock decrement warning for", it.id, stkErr);
        }
      }

      // 3. Clear cart and set success
      clearCart();
      setCreatedOrder(orderData);

      if (user) {
        await sendClientInAppNotification({
          userId: user.uid,
          clientId: user.uid,
          type: "order",
          title: "Commande confirmée 🎉",
          message: `Votre commande #${orderId.slice(-6)} (${items.length} article(s) - ${formatPrice(grandTotal)}) a bien été validée. Livraison vers ${selectedCommune}.`,
          link: "/dashboard/client",
        });
      }
    } catch (err: any) {
      console.error("Cart order error:", err);
      setError(err.message || "Erreur lors de la validation de la commande.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="p-4 sm:p-5 bg-[#0F1D27] text-white flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF6600] text-white flex items-center justify-center font-bold shadow-md shadow-[#FF6600]/30">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="font-heading font-black text-sm sm:text-base tracking-tight">Panier & Proformas Rayons</h2>
                <p className="text-[11px] text-gray-400">
                  Validez vos achats, devis et réservations
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

          {/* Segmented Top Tabs: Articles | Proformas | Immo */}
          <div className="flex border-b border-gray-200 bg-gray-50/90 px-2 pt-2 gap-1 overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => {
                setCartTab("items");
                setStep("cart");
              }}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                cartTab === "items"
                  ? "bg-white text-gray-900 border-[#FF6600] shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <ShoppingBag size={13} className={cartTab === "items" ? "text-[#FF6600]" : "text-gray-400"} />
              <span>Articles</span>
              {totalItems > 0 && (
                <span className="px-1.5 py-0.2 bg-[#FF6600] text-white text-[10px] rounded-full font-black">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCartTab("proformas")}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                cartTab === "proformas"
                  ? "bg-white text-gray-900 border-amber-500 shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <FileText size={13} className={cartTab === "proformas" || pendingProformas.length > 0 ? "text-amber-500" : "text-gray-400"} />
              <span>Proformas</span>
              {pendingProformas.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full font-black animate-pulse">
                  {pendingProformas.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCartTab("immo")}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                cartTab === "immo"
                  ? "bg-white text-gray-900 border-blue-600 shadow-2xs"
                  : "text-gray-500 hover:text-gray-800 border-transparent"
              }`}
            >
              <Hotel size={13} className={cartTab === "immo" || pendingImmoTotal > 0 ? "text-blue-600" : "text-gray-400"} />
              <span>Immo & Hôtels</span>
              {pendingImmoTotal > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded-full font-black">
                  {pendingImmoTotal}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: ARTICLES DU PANIER */}
          {cartTab === "items" && (
            <>
              {/* Order Created Success Screen */}
              {createdOrder ? (
                <div className="p-8 text-center flex flex-col items-center justify-center flex-1">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-gray-900 mb-1">Commande Validée !</h3>
                  <p className="text-xs text-gray-500 mb-4 max-w-xs">
                    Votre commande <strong className="text-gray-900">#{createdOrder.id}</strong> a été enregistrée avec succès. Nos chauffeurs partenaires sont notifiés.
                  </p>

                  <div className="bg-gray-50 rounded-2xl p-4 w-full text-left text-xs mb-6 space-y-1.5 border border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Commune de livraison :</span>
                      <span className="font-bold text-gray-800">{createdOrder.deliveryDetails?.commune}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total réglé / dû :</span>
                      <span className="font-bold text-emerald-600 text-sm">{formatPrice(createdOrder.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mode :</span>
                      <span className="font-medium text-gray-700">
                        {createdOrder.paymentMethod === "CASH_ON_DELIVERY" ? "💵 Cash à la livraison" : "📱 Mobile Money"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        closeCart();
                        router.push(`/order/${createdOrder.id}/tracking`);
                      }}
                      className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Truck size={15} /> Suivre la livraison en direct
                    </button>
                    <button
                      type="button"
                      onClick={closeCart}
                      className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-xs cursor-pointer"
                    >
                      Continuer mes achats
                    </button>
                  </div>
                </div>
              ) : items.length === 0 ? (
                /* Empty Cart Items View with helpful cross-links */
                <div className="p-8 text-center flex flex-col items-center justify-center flex-1 text-gray-400">
                  <ShoppingBag size={52} className="text-gray-200 mb-3" />
                  <h3 className="text-base font-bold text-gray-800 mb-1">Votre panier d'articles est vide</h3>
                  <p className="text-xs text-gray-400 max-w-xs mb-5">
                    Parcourez nos rayons Connect, Mode et Saveurs pour ajouter des articles d'exception.
                  </p>

                  {/* Notice if user has pending proformas waiting */}
                  {pendingProformas.length > 0 && (
                    <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-left w-full">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-1">
                        <FileText size={15} className="text-amber-600 shrink-0" />
                        <span>{pendingProformas.length} devis proforma en attente</span>
                      </div>
                      <p className="text-[11px] text-amber-700 mb-2">
                        Un fournisseur vous a envoyé un devis officiel prêt à être validé et réglé.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCartTab("proformas")}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Consulter mes proformas <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Notice if user has pending immo bookings */}
                  {pendingImmoTotal > 0 && (
                    <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200/80 rounded-2xl text-left w-full">
                      <div className="flex items-center gap-2 text-blue-800 font-bold text-xs mb-1">
                        <Hotel size={15} className="text-blue-600 shrink-0" />
                        <span>{pendingImmoTotal} réservation(s) immo / hôtel</span>
                      </div>
                      <p className="text-[11px] text-blue-700 mb-2">
                        Consultez vos séjours et visites en attente de confirmation.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCartTab("immo")}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 bg-blue-200/70 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Voir mes réservations <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={closeCart}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
                  >
                    Découvrir les rayons
                  </button>
                </div>
              ) : step === "cart" ? (
                /* Cart Items List */
                <>
                  {/* Proforma Alert banner if any pending proformas exist */}
                  {pendingProformas.length > 0 && (
                    <div 
                      onClick={() => setCartTab("proformas")}
                      className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-200/80 flex items-center justify-between text-xs cursor-pointer hover:bg-amber-500/15 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-amber-900 font-semibold truncate">
                        <FileText size={14} className="text-amber-600 shrink-0" />
                        <span className="truncate">
                          <strong>{pendingProformas.length}</strong> proforma(s) fournisseur en attente de paiement
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 shrink-0 flex items-center gap-0.5">
                        Voir <ArrowRight size={12} />
                      </span>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100">
                    {items.map((item) => (
                      <div key={item.id} className="py-3.5 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">📦</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-xs truncate">{item.title}</h4>
                          <div className="text-primary font-bold text-xs mt-0.5">{formatPrice(item.price)}</div>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-l-lg cursor-pointer"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="px-2 text-xs font-bold text-gray-800">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-r-lg cursor-pointer"
                              >
                                <Plus size={11} />
                              </button>
                            </div>

                            <span className="text-[11px] text-gray-500 font-medium">
                              Total: {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Cart Footer */}
                  <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 space-y-3 shrink-0">
                    <div className="flex justify-between items-center text-sm font-bold text-gray-900">
                      <span>Sous-total ({totalItems} articles) :</span>
                      <span className="text-primary text-base font-extrabold">{formatPrice(subtotal)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Frais de livraison calculés à l'étape suivante selon votre commune à Kinshasa.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearCart}
                        className="px-3 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors text-xs font-medium cursor-pointer"
                        title="Vider le panier"
                      >
                        Vider
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep("checkout")}
                        className="flex-1 py-3 bg-[#0F1D27] hover:bg-[#1c3040] text-[#C7D300] font-heading font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer"
                      >
                        <span>Passer à la commande</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Checkout View (Commune selection & Details) */
                <form onSubmit={handleOrderSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                    
                    <button
                      type="button"
                      onClick={() => setStep("cart")}
                      className="text-primary text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      ← Revenir au panier
                    </button>

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 text-xs">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* 1. Contact */}
                    <div className="space-y-2.5">
                      <span className="font-bold text-gray-800 text-xs uppercase tracking-wider block">
                        1. Destinataire
                      </span>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium block mb-1">Nom complet *</label>
                        <input
                          type="text"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Ex: David Mwamba"
                          className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium block mb-1">Téléphone (WhatsApp/Appel) *</label>
                        <input
                          type="tel"
                          required
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="Ex: +243 81 000 0000"
                          className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                        />
                      </div>
                    </div>

                    {/* 2. Kinshasa Delivery */}
                    <div className="space-y-2.5">
                      <span className="font-bold text-gray-800 text-xs uppercase tracking-wider block">
                        2. Lieu de livraison (Kinshasa)
                      </span>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium block mb-1">Commune de Kinshasa *</label>
                        <select
                          value={selectedCommune}
                          onChange={(e) => setSelectedCommune(e.target.value)}
                          className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                        >
                          {KINSHASA_COMMUNES.map((comm) => (
                            <option key={comm.name} value={comm.name}>
                              {comm.name} — Frais de livraison : {formatPrice(comm.fee)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium block mb-1">Adresse ou Repère précis *</label>
                        <input
                          type="text"
                          required
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Ex: Av. Colonel Mondjiba n° 30, Réf. Utexafrica..."
                          className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                        />
                      </div>
                    </div>

                    {/* 3. Payment Mode */}
                    <div className="space-y-2">
                      <span className="font-bold text-gray-800 text-xs uppercase tracking-wider block">
                        3. Mode de paiement
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                            paymentMethod === "CASH_ON_DELIVERY"
                              ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Banknote size={16} className="text-emerald-600 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold">Cash à la livraison</div>
                            <div className="text-[10px] text-gray-500">Paiement à réception</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("MOBILE_MONEY")}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                            paymentMethod === "MOBILE_MONEY"
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Smartphone size={16} className="text-primary shrink-0" />
                          <div>
                            <div className="text-xs font-semibold">Mobile Money</div>
                            <div className="text-[10px] text-gray-500">M-Pesa / Orange</div>
                          </div>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Checkout Footer */}
                  <div className="p-5 bg-gray-50 border-t border-gray-200 space-y-3 shrink-0">
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-500">
                        <span>Sous-total articles :</span>
                        <span className="font-semibold text-gray-800">{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Livraison ({selectedCommune}) :</span>
                        <span className="font-semibold text-gray-800">{formatPrice(deliveryFee)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm font-bold text-gray-900">
                        <span>Total Général :</span>
                        <span className="text-primary font-extrabold text-base">{formatPrice(grandTotal)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-[#0F1D27] hover:bg-[#1c3040] text-[#C7D300] font-heading font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Confirmation de votre commande...</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag size={15} />
                          <span>Confirmer la commande ({formatPrice(grandTotal)})</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* TAB 2: PROFORMAS FOURNISSEURS EN ATTENTE DE VALIDATION & RÈGLEMENT */}
          {cartTab === "proformas" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="bg-amber-500/10 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <ShieldCheck size={15} className="text-amber-600" />
                    <span>Factures Proforma Officielles</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Ces cotations vous sont envoyées directement par les fournisseurs partenaires après négociation. Validez et réglez en 1 clic pour déclencher l'expédition.
                  </p>
                </div>

                {proformaError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{proformaError}</span>
                  </div>
                )}

                {pendingProformas.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center text-gray-400 py-12">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center mb-3">
                      <FileText size={28} />
                    </div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1">Aucune proforma en attente</h4>
                    <p className="text-xs text-gray-400 max-w-xs mb-4">
                      Lorsque vous sollicitez un devis sur mesure auprès d'un fournisseur ou grossiste, ses proformas s'afficheront ici.
                    </p>
                    <Link
                      href="/"
                      onClick={closeCart}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors"
                    >
                      Explorer les catalogues
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingProformas.map((pf) => {
                      const isCurrentlyPaying = payingProformaId === pf.messageId;

                      return (
                        <div
                          key={`${pf.chatId}_${pf.messageId}`}
                          className="bg-white rounded-2xl border border-amber-200 p-4 shadow-2xs hover:shadow-xs transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider block">
                                {pf.supplierName || "Fournisseur Partenaire"}
                              </span>
                              <h4 className="font-bold text-gray-900 text-xs leading-snug">
                                {pf.productName}
                              </h4>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                              En attente
                            </span>
                          </div>

                          <div className="py-2.5 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                            <div>
                              <span className="text-gray-400 block text-[10px]">Quantité :</span>
                              <span className="font-semibold text-gray-800">{pf.quantity} pièce(s)</span>
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
                              <span className="text-gray-400 block text-[10px]">Livraison :</span>
                              <span className="font-semibold text-gray-800">{formatPrice(pf.deliveryFee)}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-gray-400 block">Total à payer :</span>
                              <span className="font-extrabold text-primary text-sm">
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
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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

              {pendingProformas.length > 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-center shrink-0">
                  <Link
                    href="/dashboard/client?tab=proformas"
                    onClick={closeCart}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
                  >
                    <span>Voir toutes mes cotations sur le tableau de bord</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMMOBILIER & HÔTELS EN ATTENTE */}
          {cartTab === "immo" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Section Hôtels */}
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
                      Aucune réservation d'hôtel en attente
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

                {/* Section Visites Immobilières */}
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
                  <span>Gérer tous mes séjours et visites sur mon espace</span>
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
