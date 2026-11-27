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
  Package,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useRouter } from "next/navigation";
import { buildVisaPaymentUrl, VisaPaymentConfig } from "@/lib/visaPayments";

interface DirectBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
  items?: any[];
  onOrderSuccess?: (order: any) => void;
}

import { KINSHASA_COMMUNES, isNegotiatedDeliveryCommune } from "@/lib/kinshasaDelivery";

export function DirectBuyModal({ isOpen, onClose, product, items, onOrderSuccess }: DirectBuyModalProps) {
  const { user, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const isMultiple = Array.isArray(items) && items.length > 0;
  const [quantity, setQuantity] = useState(1);
  const [selectedCommune, setSelectedCommune] = useState("Gombe");
  const [customDestination, setCustomDestination] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "MOBILE_MONEY" | "CARD">("CASH_ON_DELIVERY");
  const [mobileMoneyOperator, setMobileMoneyOperator] = useState<"MPESA" | "ORANGE" | "AIRTEL">("MPESA");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [visaConfig, setVisaConfig] = useState<VisaPaymentConfig | null>(null);

  // Réinitialiser l'état à la fermeture de la modale
  useEffect(() => {
    if (!isOpen) {
      setSuccessOrder(null);
      setError("");
    }
  }, [isOpen]);

  // Charger le lien dynamique de paiement Visa (configuré dans /admin/finance)
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/payments/visa-config")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.config) setVisaConfig(json.config);
      })
      .catch(() => {});
  }, [isOpen]);

  // Prefill user data if logged in
  useEffect(() => {
    if (user) {
      setClientName(userData?.displayName || userData?.name || user.displayName || "");
      setClientPhone(userData?.phone || user.phoneNumber || "");
      if (userData?.commune) setSelectedCommune(userData.commune);
      if (userData?.address) setDeliveryAddress(userData.address);
    }
  }, [user, userData]);

  if (!isOpen || (!successOrder && !product && !isMultiple)) return null;

  const activeCommuneObj = KINSHASA_COMMUNES.find(c => c.name === selectedCommune) || KINSHASA_COMMUNES[0];
  const isOtherDestination = isNegotiatedDeliveryCommune(selectedCommune);
  const unitPrice = isMultiple ? 0 : (Number(product?.price) || 0);
  const subtotal = isMultiple
    ? items.reduce((acc, it) => acc + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0)
    : unitPrice * quantity;
  const deliveryFee = isOtherDestination ? 0 : activeCommuneObj.fee;
  const totalAmount = subtotal + deliveryFee;

  const productTitle = isMultiple
    ? (items.length === 1 ? items[0].title : `${items[0].title} (+${items.length - 1} autre(s))`)
    : (product?.title?.fr || product?.title?.en || product?.title || "Produit Rayons");
  const productImage = isMultiple
    ? (items[0]?.image || "/images/placeholder.png")
    : (product?.imageUrl || product?.image || "/images/placeholder.png");

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
    if (isOtherDestination && !customDestination.trim()) {
      setError("Veuillez indiquer votre ville, commune ou destination souhaitée.");
      return;
    }
    if (!deliveryAddress.trim()) {
      setError("Veuillez indiquer votre adresse ou un repère précis.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = user ? await user.getIdToken().catch(() => null) : null;

      const payload: any = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: user?.email || null,
        deliveryDetails: {
          city: isOtherDestination ? customDestination.trim() : "Kinshasa",
          commune: selectedCommune,
          customDestination: isOtherDestination ? customDestination.trim() : null,
          deliveryFeeNegotiated: isOtherDestination,
          address: deliveryAddress.trim(),
          deliveryFee
        },
        paymentMethod,
        mobileMoneyOperator: paymentMethod === "MOBILE_MONEY" ? mobileMoneyOperator : null,
        currency: "USD"
      };

      if (isMultiple) {
        payload.items = items;
      } else {
        payload.product = product;
        payload.quantity = quantity;
      }

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible d'enregistrer la commande. Réessayez.");
      }

      setSuccessOrder(data.order);
      if (onOrderSuccess) onOrderSuccess(data.order);
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
          <div className="p-6 sm:p-8 text-center flex flex-col items-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-heading font-bold text-gray-900 mb-1">Commande Confirmée !</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm">
              Votre commande <strong className="text-gray-900">#{successOrder.id}</strong> a bien été enregistrée et transmise au vendeur. Un livreur est en cours d&apos;attribution.
            </p>

            <div className="bg-gray-50 rounded-2xl p-4 w-full text-left text-xs mb-5 space-y-2 border border-gray-100">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 shrink-0">Article(s) :</span>
                <span className="font-bold text-gray-800 text-right">
                  {successOrder.productTitle || productTitle} (x{successOrder.quantity || quantity})
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 shrink-0">Destination :</span>
                <span className="font-bold text-gray-800 text-right">
                  {successOrder.deliveryDetails?.deliveryFeeNegotiated
                    ? `${successOrder.deliveryDetails?.customDestination || customDestination || "Autre"} (Frais à convenir)`
                    : (successOrder.deliveryDetails?.commune || selectedCommune)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 shrink-0">
                  {successOrder.deliveryDetails?.deliveryFeeNegotiated ? "Sous-total articles :" : "Total TTC à régler :"}
                </span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  {formatPrice(Number(successOrder.totalAmount ?? totalAmount))}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 shrink-0">Mode :</span>
                <span className="font-medium text-gray-700">
                  {paymentMethod === "CASH_ON_DELIVERY"
                    ? "💵 Cash à la livraison"
                    : paymentMethod === "CARD"
                    ? "💳 Carte Visa / Mastercard"
                    : `📱 Mobile Money (${mobileMoneyOperator})`}
                </span>
              </div>
            </div>

            {paymentMethod === "MOBILE_MONEY" && (
              <div className="w-full p-3.5 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 space-y-1">
                <div className="font-bold">Paiement {mobileMoneyOperator} :</div>
                <p className="text-[11px] leading-relaxed">
                  Notre équipe ou le livreur va vous contacter sur <strong>{clientPhone}</strong> pour confirmer votre paiement Mobile Money (Réf. <strong>#{successOrder.id}</strong>).
                </p>
              </div>
            )}

            {paymentMethod === "CARD" && visaConfig?.enabled && visaConfig.checkoutUrl && (
              <a
                href={buildVisaPaymentUrl(visaConfig.checkoutUrl, {
                  referenceId: `ord_${successOrder.id}`,
                  email: user?.email || "",
                  amount: Number(successOrder.totalAmount ?? totalAmount),
                  currency: "USD",
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 mb-3 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <CreditCard size={16} />
                <span>Payer maintenant par Carte Visa ({formatPrice(Number(successOrder.totalAmount ?? totalAmount))})</span>
                <ExternalLink size={14} />
              </a>
            )}

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  const targetOrderId = successOrder.id;
                  onClose();
                  router.push(`/order/${targetOrderId}/tracking`);
                }}
                className="flex-1 py-3 bg-[#0F1D27] hover:bg-[#1a3040] text-[#C7D300] font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Truck size={16} /> Suivre la livraison
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm cursor-pointer"
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
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
              {isMultiple ? (
                <div>
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200/60">
                    <span className="font-bold text-gray-900 text-xs">{items.length} article(s) dans la commande</span>
                    <span className="font-bold text-gray-900 text-xs">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-gray-700">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-bold bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded">x{it.quantity}</span>
                          <span className="truncate">{it.title}</span>
                        </div>
                        <span className="font-semibold shrink-0 ml-2">{formatPrice(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
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
                      className="w-6 h-6 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-800 text-sm px-1">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
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
                2. Lieu de livraison
              </span>
              <div>
                <label className="text-[11px] text-gray-500 font-medium block mb-1">Zone / Commune de livraison *</label>
                <select
                  value={selectedCommune}
                  onChange={(e) => setSelectedCommune(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {KINSHASA_COMMUNES.map((comm) => (
                    <option key={comm.name} value={comm.name}>
                      {comm.negotiated
                        ? (comm.label || "Autre destination — À convenir avec le vendeur")
                        : `${comm.name} — Frais de livraison : $${comm.fee}`}
                    </option>
                  ))}
                </select>
              </div>

              {isOtherDestination && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <label className="text-[11px] text-amber-900 font-bold block">
                    Précisez votre ville / commune / destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    placeholder="Ex: Lubumbashi, Matadi, Goma, Kinkole..."
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-amber-300 focus:border-amber-500"
                  />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Pour cette destination hors liste, les frais de livraison seront <strong>convenus directement entre vous et le vendeur</strong> après confirmation.
                  </p>
                </div>
              )}

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
              <div className={`grid gap-2 ${visaConfig?.enabled && visaConfig.checkoutUrl ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
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
                  className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
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

                {visaConfig?.enabled && visaConfig.checkoutUrl && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === "CARD"
                        ? "border-[#0F1D27] bg-slate-100 text-[#0F1D27] font-bold"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <CreditCard size={18} className="text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold">Carte Visa</div>
                      <div className="text-[10px] text-gray-500">{visaConfig.providerName || "Visa / Mastercard"}</div>
                    </div>
                  </button>
                )}
              </div>

              {paymentMethod === "MOBILE_MONEY" && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(["MPESA", "AIRTEL", "ORANGE"] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setMobileMoneyOperator(op)}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        mobileMoneyOperator === op
                          ? "bg-[#0F1D27] text-[#C7D300] border-[#0F1D27]"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {op === "MPESA" ? "M-Pesa" : op === "AIRTEL" ? "Airtel Money" : "Orange Money"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Sous-total ({isMultiple ? items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0) : quantity} art.) :</span>
                <span className="font-semibold text-gray-800">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Livraison ({isOtherDestination ? (customDestination || "Autre") : selectedCommune}) :</span>
                <span className={`font-semibold ${isOtherDestination ? "text-amber-700" : "text-gray-800"}`}>
                  {isOtherDestination ? "À convenir avec le vendeur" : formatPrice(deliveryFee)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-gray-900">
                <span>{isOtherDestination ? "Total articles (hors transport) :" : "Total à régler :"}</span>
                <span className="text-[#0F1D27] font-extrabold text-base">{formatPrice(totalAmount)}</span>
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
