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
  ShieldCheck
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { sendClientInAppNotification } from "@/lib/inAppNotification";

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
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [selectedCommune, setSelectedCommune] = useState("Gombe");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "MOBILE_MONEY">("CASH_ON_DELIVERY");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

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
      setCreatedOrder(null);
    }
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const activeCommuneObj = KINSHASA_COMMUNES.find(c => c.name === selectedCommune) || KINSHASA_COMMUNES[0];
  const deliveryFee = items.length > 0 ? activeCommuneObj.fee : 0;
  const grandTotal = subtotal + deliveryFee;

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
        currency: "$",
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
          message: `Votre commande #${orderId.slice(-6)} (${items.length} article(s) - $${grandTotal.toFixed(2)}) a bien été validée. Livraison vers ${selectedCommune}.`,
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={closeCart}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-100 animate-in slide-in-from-right duration-250">
          
          {/* Header */}
          <div className="p-5 bg-gray-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#C7D300] text-[#0F1D27] flex items-center justify-center font-bold">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="font-heading font-bold text-base">Votre Panier Rayons</h2>
                <p className="text-[11px] text-gray-400">
                  {totalItems} article{totalItems > 1 ? "s" : ""} sélectionné{totalItems > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={closeCart}
              className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Success Screen */}
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
                  <span className="font-bold text-emerald-600 text-sm">${createdOrder.totalAmount}</span>
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
                  className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Truck size={15} /> Suivre la livraison en direct
                </button>
                <button
                  type="button"
                  onClick={closeCart}
                  className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-xs"
                >
                  Continuer mes achats
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            /* Empty Cart View */
            <div className="p-8 text-center flex flex-col items-center justify-center flex-1 text-gray-400">
              <ShoppingBag size={56} className="text-gray-200 mb-3" />
              <h3 className="text-base font-bold text-gray-700 mb-1">Votre panier est vide</h3>
              <p className="text-xs text-gray-400 max-w-xs mb-6">
                Parcourez nos rayons Connect, Mode et Saveurs pour ajouter des articles d'exception.
              </p>
              <button
                onClick={closeCart}
                className="px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-colors"
              >
                Découvrir les rayons
              </button>
            </div>
          ) : step === "cart" ? (
            /* Cart Items View */
            <>
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
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-l-lg"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="px-2 text-xs font-bold text-gray-800">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-r-lg"
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
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Cart Footer */}
              <div className="p-5 bg-gray-50 border-t border-gray-200 space-y-3">
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
                    className="px-3 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors text-xs font-medium"
                    title="Vider le panier"
                  >
                    Vider
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("checkout")}
                    className="flex-1 py-3 bg-[#0F1D27] hover:bg-[#1c3040] text-[#C7D300] font-heading font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
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
                  className="text-primary text-xs font-semibold hover:underline flex items-center gap-1"
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
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {KINSHASA_COMMUNES.map((comm) => (
                        <option key={comm.name} value={comm.name}>
                          {comm.name} — Frais de livraison : ${comm.fee}
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
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
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
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
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
              <div className="p-5 bg-gray-50 border-t border-gray-200 space-y-3">
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
                      <span>Confirmer la commande (${grandTotal.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
