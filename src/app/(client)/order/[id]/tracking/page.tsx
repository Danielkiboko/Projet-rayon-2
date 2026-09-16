"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, MapPin, Package, CheckCircle, Truck, Phone, Download, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { generateOrderInvoicePDF } from "@/lib/invoiceGenerator";

// Dynamically import the map component so it doesn't break SSR
const TrackingMap = dynamic(() => import("@/modules/client/components/TrackingMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 flex items-center justify-center">Chargement de la carte...</div>
});

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/");
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [user, loading, orderId, router]);

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending_driver":
      case "CONFIRMED_AWAITING_DRIVER":
        return "En attente d'un livreur";
      case "driver_assigned":
      case "ACCEPTED":
        return "Livreur assigné — En route vers le fournisseur";
      case "in_transit":
      case "ARRIVED_AWAITING_PAYMENT":
        return "Livreur en route vers votre adresse";
      case "delivered":
      case "COMPLETED":
        return "Colis livré avec succès";
      default:
        return status || "En cours de traitement";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending_driver":
      case "CONFIRMED_AWAITING_DRIVER":
        return <Package className="w-6 h-6 text-orange-500" />;
      case "driver_assigned":
      case "ACCEPTED":
        return <Truck className="w-6 h-6 text-blue-500" />;
      case "in_transit":
      case "ARRIVED_AWAITING_PAYMENT":
        return <Truck className="w-6 h-6 text-primary" />;
      case "delivered":
      case "COMPLETED":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      default:
        return <Package className="w-6 h-6 text-gray-500" />;
    }
  };

  const handlePayRemaining = () => {
    alert("Ouverture de Makuta pour payer le solde du produit de " + order.totalAmount + " $");
    // To be implemented fully with Makuta integration
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">Suivi de commande</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto flex flex-col relative h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Map Area */}
        <div className="flex-1 relative bg-gray-200">
          <TrackingMap 
            clientLocation={order.clientLocation} 
            driverLocation={order.driverLocation} 
          />
          
          {/* Status Overlay on top of Map */}
          <div className="absolute top-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 z-[400]">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-50 p-2 rounded-full">
                {getStatusIcon(order.status)}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{getStatusText(order.status)}</h3>
                <p className="text-xs text-gray-500">Commande {order.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Info */}
        <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-6 z-[500] relative max-h-[50vh] overflow-y-auto">
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
          
          {order.driverId && (
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">
                  {order.driverName ? order.driverName.charAt(0).toUpperCase() : "L"}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{order.driverName || "Livreur Rayon"}</h4>
                  <p className="text-sm text-gray-500">
                    {order.status === "COMPLETED" 
                      ? "Course terminée" 
                      : order.status === "ARRIVED_AWAITING_PAYMENT" 
                        ? "Arrivé à votre adresse" 
                        : "En route vers vous"}
                    {order.driverVehicle ? ` • ${order.driverVehicle}` : ""}
                  </p>
                </div>
              </div>
              {order.driverPhone ? (
                <a 
                  href={`tel:${order.driverPhone}`} 
                  title={`Appeler ${order.driverName || 'le livreur'}`}
                  className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors shadow-xs"
                >
                  <Phone className="w-5 h-5" />
                </a>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <h4 className="font-bold text-gray-900">Détails de la commande</h4>
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{item.quantity}x {item.productName}</span>
                <span className="font-medium">{item.price} $</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-600">Frais de livraison (Déjà payé)</span>
              <span className="font-medium">{order.deliveryFee} $</span>
            </div>
            <div className="flex justify-between items-center font-bold text-lg border-t border-gray-200 pt-2 mt-2">
              <span>Solde à payer</span>
              <span>{order.totalAmount} $</span>
            </div>
          </div>

          <button 
            onClick={() => generateOrderInvoicePDF(order, null, "$")}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-bold text-sm mt-3 transition-colors border border-gray-200 shadow-xs"
          >
            <Download size={16} />
            <span>Télécharger la Facture / Reçu officiel</span>
          </button>

          <button 
            onClick={handlePayRemaining}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg mt-3 hover:bg-primary-light transition-colors shadow-lg"
          >
            Payer à la livraison ({order.totalAmount} $)
          </button>
        </div>
      </main>
    </div>
  );
}
