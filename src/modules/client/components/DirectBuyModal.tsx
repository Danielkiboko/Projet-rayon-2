"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  ShoppingBag, 
  Truck, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ShieldCheck,
  Package
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { sendClientInAppNotification } from "@/lib/inAppNotification";

interface DirectBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

import { KINSHASA_COMMUNES } from "@/lib/kinshasaDelivery";

export function DirectBuyModal({ isOpen, onClose, product }: DirectBuyModalProps) {
  const { user, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [selectedCommune, setSelectedCommune] = useState("Gombe");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "MOBILE_MONEY" | "CARD">("CASH_ON_DELIVERY");
  const [mobileMoneyOperator, setMobileMoneyOperator] = useState<"MPESA" | "ORANGE" | "AIRTEL">("MPESA");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState<any | null>(null);

  // Prefill user data if logged in
  useEffect(() => {
    if (user) {
      setClientName(userData?.displayName || userData?.name || user.displayName || "");
      setClientPhone(userData?.phone || user.phoneNumber || "");
      if (userData?.commune) setSelectedCommune(userData.commune);
      if (userData?.address) setDeliveryAddress(userData.address);
    }
  }, [user, userData]);

  if (!isOpen || !product) return null;

  const activeCommuneObj = KINSHASA_COMMUNES.find(c => c.name === selectedCommune) || KINSHASA_COMMUNES[0];
  const unitPrice = Number(product.price) || 0;
  const subtotal = unitPrice * quantity;
  const deliveryFee = activeCommuneObj.fee;
  const totalAmount = subtotal + deliveryFee;

  const productTitle = product.title?.fr || product.title?.en || product.title || "Produit Rayons";
  const productImage = product.imageUrl || product.image || "/images/placeholder.png";

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!clientName.trim()) {
      setError("Veuillez renseigner votre nom complet.");
      return;
    }
    if (!clientPhone.trim()) {
      setError("Veuillez renseigner votre numéro de téléphone pour la livraison.");
      return;
    }
    if (!deliveryAddress.trim()) {
      setError("Veuillez indiquer votre adresse ou un repère précis à Kinshasa.");
      return;
    }

    setIsSubmitting(true);

    try {
      const orderId = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      
      const targetSupplierId = product.supplierId || "admin";
      const fullAddress = `${deliveryAddress.trim()}, ${selectedCommune}, Kinshasa`;

      const orderData = {
        id: orderId,
        clientId: user ? user.uid : "GUEST",
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientAddress: fullAddress,
        supplierId: targetSupplierId,
        supplierIds: [targetSupplierId],
        rayon: product.rayon || product.category || "connect",
        items: [{
          productId: product.id,
          productName: productTitle,
          quantity: quantity,
          price: unitPrice,
          image: productImage,
          supplierId: targetSupplierId
        }],
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        totalAmount: totalAmount,
        remainingBalance: totalAmount,
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

      // 1. Save order to Firestore
      await setDoc(doc(db, "orders", orderId), orderData);

      // 2. Decrement stock if api is available
      try {
        await fetch("/api/orders/update-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            quantity: quantity,
            action: "decrement"
          })
        });
      } catch (stockErr) {
        console.warn("Stock update warn:", stockErr);
      }

      setSuccessOrder(orderData);

      if (user) {
        await sendClientInAppNotification({
          userId: user.uid,
          clientId: user.uid,
          type: "order",
          title: "Commande Express validée 🎉",
          message: `Votre commande #${orderId.slice(-6)} (${productTitle} x${quantity} - $${totalAmount.toFixed(2)}) a été enregistrée avec succès. Livraison à ${selectedCommune}.`,
          link: "/dashboard/client",
        });
      }
    } catch (err: any) {
      console.error("Order creation error:", err);
      setError(err.message || "Impossible d'enregistrer la commande. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#C7D300] text-[#0F1D27] flex items-center justify-center font-bold">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base">Commande Express Directe</h2>
              <p className="text-[11px] text-gray-400">Livraison rapide sécurisée à Kinshasa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success State */}
        {successOrder ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-heading font-bold text-gray-900 mb-1">Commande Confirmée !</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm">
              Votre commande <strong className="text-gray-900">#{successOrder.id}</strong> a été enregistrée avec succès. Un livreur est en cours d'attribution.
            </p>

            <div className="bg-gray-50 rounded-2xl p-4 w-full text-left text-xs mb-6 space-y-1.5 border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Produit :</span>
                <span className="font-bold text-gray-800">{productTitle} (x{quantity})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commune de livraison :</span>
                <span className="font-bold text-gray-800">{selectedCommune}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total TTC à régler :</span>
                <span className="font-bold text-emerald-600 text-sm">${totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mode :</span>
                <span className="font-medium text-gray-700">
                  {paymentMethod === "CASH_ON_DELIVERY" ? "💵 Cash à la livraison" : "📱 Mobile Money"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/order/${successOrder.id}/tracking`);
                }}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all text-sm flex items-center justify-center gap-1.5 shadow-md"
              >
                <Truck size={16} /> Suivre la livraison
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleOrderSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
            
            {/* Error banner */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Product Summary */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-white overflow-hidden border border-gray-200 shrink-0">
                <img src={productImage} alt={productTitle} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-sm truncate">{productTitle}</h4>
                <div className="text-gray-500 text-xs mt-0.5">{formatPrice(unitPrice)} / unité</div>
              </div>
              {/* Quantity selector */}
              <div className="flex items-center gap-2 border border-gray-200 bg-white rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-6 h-6 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  -
                </button>
                <span className="font-bold text-gray-800 text-sm px-1">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              <span className="font-bold text-gray-800 text-xs uppercase tracking-wider block">
                1. Coordonnées de contact
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>

            {/* Delivery Details */}
            <div className="space-y-3">
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
                  placeholder="Ex: Av. de la Paix n° 14, Réf. Arrêt Kin Mazière..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <span className="font-bold text-gray-800 text-xs uppercase tracking-wider block">
                3. Mode de paiement
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    paymentMethod === "CASH_ON_DELIVERY"
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Banknote size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">Cash à la livraison</div>
                    <div className="text-[10px] text-gray-500">Payez à réception</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("MOBILE_MONEY")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    paymentMethod === "MOBILE_MONEY"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Smartphone size={18} className="text-primary shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">Mobile Money</div>
                    <div className="text-[10px] text-gray-500">M-Pesa / Orange</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Sous-total ({quantity} art.) :</span>
                <span className="font-semibold text-gray-800">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Livraison ({selectedCommune}) :</span>
                <span className="font-semibold text-gray-800">{formatPrice(deliveryFee)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-gray-900">
                <span>Total à régler :</span>
                <span className="text-primary font-extrabold text-base">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#0F1D27] hover:bg-[#1c3040] text-[#C7D300] font-heading font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Validation de la commande...</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={17} />
                  <span>Confirmer la commande ({formatPrice(totalAmount)})</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Garantie Rayons : Vérification et conformité avant remise au client</span>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
