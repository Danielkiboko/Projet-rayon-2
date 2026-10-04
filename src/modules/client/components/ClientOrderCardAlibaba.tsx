"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  MapPin, 
  Store, 
  MessageSquare, 
  RotateCcw, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  PhoneCall
} from "lucide-react";
import { generateOrderInvoicePDF } from "@/lib/invoiceGenerator";
import { useCurrency } from "@/context/CurrencyContext";
import { useCart } from "@/context/CartContext";

interface OrderItem {
  id?: string;
  productId?: string;
  productName?: string;
  title?: string;
  name?: string;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  image?: string;
  imageUrl?: string;
}

interface OrderData {
  id: string;
  clientId?: string;
  supplierId?: string;
  storeName?: string;
  supplierName?: string;
  status: string;
  totalAmount: number;
  deliveryFee?: number;
  items?: OrderItem[];
  createdAt?: any;
  clientAddress?: string;
  clientPhone?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  deliveryBoy?: {
    name?: string;
    phone?: string;
  };
}

interface ClientOrderCardAlibabaProps {
  order: OrderData;
}

// 4-step pipeline mapping
const getStepperState = (status: string) => {
  const s = (status || "").toLowerCase();
  
  if (s === "cancelled") {
    return { step: 0, isCancelled: true, label: "Commande Annulée" };
  }
  
  if (["delivered", "completed", "livre"].includes(s)) {
    return { step: 4, isCancelled: false, label: "Commande Livrée" };
  }
  
  if (["in_transit", "arrived_awaiting_payment", "ready", "picked_up"].includes(s)) {
    return { step: 3, isCancelled: false, label: "Livreur en route" };
  }
  
  if (["driver_assigned", "accepted", "preparing", "in_preparation"].includes(s)) {
    return { step: 2, isCancelled: false, label: "En préparation" };
  }
  
  // pending or confirmed awaiting driver
  return { step: 1, isCancelled: false, label: "Commande Validée" };
};

export default function ClientOrderCardAlibaba({ order }: ClientOrderCardAlibabaProps) {
  const { formatPrice, currency } = useCurrency();
  const { addToCart, openCart } = useCart();
  const [isReordering, setIsReordering] = useState(false);

  const { step, isCancelled, label: statusLabel } = getStepperState(order.status);

  // Format order date
  const orderDate = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date récente";

  const storeTitle = order.storeName || order.supplierName || "Boutique Certifiée Rayons";
  const driverName = order.driverName || order.deliveryBoy?.name;
  const driverPhone = order.driverPhone || order.deliveryBoy?.phone;

  // 1-Click Re-order
  const handleReorder = () => {
    setIsReordering(true);
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        addToCart(
          {
            id: item.productId || item.id || `reorder-${Date.now()}`,
            title: item.productName || item.title || item.name || "Article",
            price: Number(item.unitPrice || item.price) || 0,
            imageUrl: item.imageUrl || item.image || "/images/placeholder.png",
            supplierId: order.supplierId,
          },
          item.quantity || 1
        );
      });
      openCart();
    }
    setTimeout(() => setIsReordering(false), 800);
  };

  const stepsList = [
    { num: 1, title: "Validée" },
    { num: 2, title: "Préparation" },
    { num: 3, title: "En route" },
    { num: 4, title: "Livrée" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden mb-5"
    >
      {/* 1. Alibaba-style Store Header */}
      <div className="bg-gray-50/80 px-4 sm:px-6 py-3.5 border-b border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            <Store size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">{storeTitle}</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck size={11} /> Vérifié
              </span>
            </div>
            <div className="text-[11px] text-gray-400">
              Commande <span className="font-mono text-gray-700 font-semibold">#{order.id.slice(-8).toUpperCase()}</span> • {orderDate}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {order.supplierId && (
            <Link
              href={`/dashboard/client/chats?supplierId=${order.supplierId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors shadow-2xs"
            >
              <MessageSquare size={13} className="text-primary" />
              <span>Contacter le vendeur</span>
            </Link>
          )}

          <div
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isCancelled
                ? "bg-red-50 text-red-700 border-red-200"
                : step === 4
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : step === 3
                ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {statusLabel}
          </div>
        </div>
      </div>

      {/* 2. Visual 4-Step Stepper (Alibaba Progression Bar) */}
      {!isCancelled && (
        <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center justify-between">
              {/* Progress Background Line */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-gray-200 z-0 rounded-full" />
              {/* Active Progress Fill Line */}
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-primary z-0 rounded-full transition-all duration-500"
                style={{
                  width: `${((Math.max(1, step) - 1) / (stepsList.length - 1)) * 100}%`,
                }}
              />

              {stepsList.map((st) => {
                const isPassed = step >= st.num;
                const isCurrent = step === st.num;

                return (
                  <div key={st.num} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isPassed
                          ? "bg-primary text-white ring-4 ring-primary/20 shadow-xs"
                          : "bg-gray-100 text-gray-400 border border-gray-300"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 size={16} /> : st.num}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs mt-1.5 font-semibold text-center ${
                        isCurrent
                          ? "text-primary font-bold"
                          : isPassed
                          ? "text-gray-800"
                          : "text-gray-400"
                      }`}
                    >
                      {st.title}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* In-Transit Live Delivery Info Banner */}
            {step === 3 && (
              <div className="mt-4 p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-900">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                  <Truck size={15} className="text-blue-600" />
                  <span>
                    Coursier assigné : <strong>{driverName || "Livreur Rayons Express"}</strong>
                  </span>
                </div>
                {driverPhone && (
                  <a
                    href={`tel:${driverPhone}`}
                    className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-800 underline"
                  >
                    <PhoneCall size={12} /> {driverPhone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Items & Products Section */}
      <div className="p-4 sm:p-6 divide-y divide-gray-100">
        <div className="space-y-3">
          {(order.items || []).map((item, idx) => {
            const pTitle = item.productName || item.title || item.name || "Article commandé";
            const pImage = item.imageUrl || item.image || "/images/placeholder.png";
            const pQty = item.quantity || 1;
            const pPrice = Number(item.unitPrice || item.price) || 0;

            return (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden relative shrink-0">
                    <img
                      src={pImage}
                      alt={pTitle}
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.src = "/images/placeholder.png";
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                      {pTitle}
                    </h4>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Qté : <span className="font-semibold text-gray-800">{pQty}</span> × {formatPrice(pPrice)}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-bold text-gray-900">
                    {formatPrice(pPrice * pQty)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Recipient info and Total breakdown */}
        <div className="pt-4 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin size={13} className="text-primary shrink-0" />
            <span className="truncate">
              Adresse : <strong>{order.clientAddress || "Kinshasa, RDC"}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 text-sm">
            <span className="text-gray-500 text-xs">Total TTC (livraison incluse) :</span>
            <span className="text-base sm:text-lg font-black text-gray-900">
              {formatPrice(order.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Footer Actions (Alibaba-style action bar) */}
      <div className="bg-gray-50/70 px-4 sm:px-6 py-3 border-t border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/client?tab=tickets"
            className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors"
          >
            Besoin d'aide ?
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Facture PDF */}
          <button
            type="button"
            onClick={() => generateOrderInvoicePDF(order, null, currency)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors shadow-2xs cursor-pointer"
            title="Télécharger la facture PDF officielle"
          >
            <FileText size={13} className="text-primary" />
            <span>Facture PDF</span>
          </button>

          {/* Re-commander */}
          {order.items && order.items.length > 0 && (
            <button
              type="button"
              onClick={handleReorder}
              disabled={isReordering}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors shadow-2xs cursor-pointer"
              title="Ajouter tous les articles au panier"
            >
              <RotateCcw size={13} className="text-emerald-600" />
              <span>{isReordering ? "Ajout..." : "Re-commander"}</span>
            </button>
          )}

          {/* Suivre en direct (GPS) */}
          <Link
            href={`/order/${order.id}/tracking`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <Truck size={14} />
            <span>Suivre la livraison</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
