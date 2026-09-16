"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, MapPin, Phone, MessageSquare, Navigation, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";

export default function MissionDetails({ params }: { params?: { id: string } }) {
  const router = useRouter();
  const routeParams = useParams();
  const missionId = (routeParams?.id as string) || params?.id || "";
  const { user, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<"CONFIRMED_AWAITING_DRIVER" | "ACCEPTED" | "ARRIVED_AWAITING_PAYMENT" | "LIVRE" | "COMPLETED">("ACCEPTED");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!missionId) return;

    const docRef = doc(db, "orders", missionId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder({ id: docSnap.id, ...data });
        setStatus((data.status as any) || "ACCEPTED");
        setError("");
      } else {
        setError("Mission introuvable");
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Erreur écoute mission:", err);
      setError("Erreur de chargement");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [missionId]);

  // Acceptation atomique et anti-doublon si la mission est encore en attente
  const handleAcceptMission = async () => {
    if (!order || !user || isUpdating) return;
    setIsUpdating(true);

    try {
      const response = await fetch("/api/driver/accept-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          driverId: user.uid,
          driverName: userData?.name || user.displayName || "Livreur",
          driverPhone: userData?.phone || "",
          driverVehicle: userData?.vehicle || "",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "ALREADY_ACCEPTED") {
          alert("⚠️ Cette mission vient déjà d'être acceptée par un autre livreur.");
          router.push("/driver");
        } else {
          alert(data.message || data.error || "Impossible d'accepter cette mission.");
        }
        return;
      }

      setStatus("ACCEPTED");
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de l'acceptation.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async () => {
    if (!order) return;
    setIsUpdating(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Non connecté");

      const orderRef = doc(db, "orders", order.id);
      let newStatus = status;

      if (status === "ACCEPTED") {
        newStatus = "ARRIVED_AWAITING_PAYMENT";
        
        await updateDoc(orderRef, {
          status: newStatus,
          arrivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (status === "ARRIVED_AWAITING_PAYMENT") {
        newStatus = "COMPLETED";
        const remainingAmount = Number(order.remainingBalance ?? order.totalAmount ?? 0);
        
        const response = await fetch("/api/orders/confirm-delivery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            driverId: currentUser.uid,
            driverName: userData?.name || currentUser.displayName || "Livreur",
            driverPhone: userData?.phone || "",
            amountCollected: remainingAmount,
            paymentMethod: "CASH",
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Erreur lors de la confirmation d'encaissement.");
        }
      }
      
      // Envoi de la notification au client si transition vers ARRIVED_AWAITING_PAYMENT (pour COMPLETED confirm-delivery s'en charge)
      if (newStatus === "ARRIVED_AWAITING_PAYMENT") {
        const phone = order.clientPhone || (order.customerInfo && order.customerInfo.phone) || order.deliveryDetails?.recipientPhone || "";
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ORDER_STATUS_CHANGED",
            orderId: order.id,
            status: newStatus,
            clientId: order.clientId,
            clientPhone: phone
          }),
        }).catch(err => console.error("Notification API error:", err));
      }
      
      setStatus(newStatus as any);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erreur lors de la mise à jour du statut.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#0b061c] min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-[#0b061c] min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-white text-xl font-bold mb-4">{error || "Erreur"}</h2>
        <Link href="/driver" className="px-6 py-2 bg-primary text-white rounded-lg">Retour</Link>
      </div>
    );
  }

  const clientPhone = order.clientPhone || order.customerInfo?.phone;
  const clientName = order.clientId ? order.clientId.substring(0,8) : order.customerInfo?.name || "Client Inconnu";
  const clientAddress = order.clientAddress || order.customerInfo?.address || "Adresse non spécifiée";
  const remaining = order.remainingBalance || order.totalAmount;

  return (
    <div className="bg-[#0b061c] min-h-screen flex flex-col relative pb-20">
      {/* Header Over Map */}
      <div className="absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white">
          <ChevronLeft size={24} />
        </button>
        <span className="text-white font-bold text-sm bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          Mission {missionId ? missionId.substring(0, 6).toUpperCase() : ""}...
        </span>
        <div className="w-10" />
      </div>

      {/* Map Placeholder */}
      <div className="h-[45vh] bg-[#1a1f35] relative overflow-hidden flex items-center justify-center">
        {/* Fake Map Grid */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
        
        {/* Route Line */}
        <svg className="absolute inset-0 w-full h-full" style={{ strokeDasharray: "5,5" }}>
          <path d="M 100 150 Q 200 50 300 200" fill="none" stroke="#a78bfa" strokeWidth="4" className={status === "ACCEPTED" ? "animate-pulse" : ""} />
        </svg>

        {/* Driver Marker */}
        <div className="absolute left-[80px] top-[130px] flex flex-col items-center">
          <div className="bg-primary text-white p-2 rounded-full shadow-lg shadow-primary/50 border-2 border-white mb-1">
            <Navigation size={16} className="transform rotate-45" />
          </div>
          <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md">Vous</span>
        </div>

        {/* Client Marker */}
        <div className="absolute left-[290px] top-[190px] flex flex-col items-center">
          <div className="bg-green-500 text-white p-2 rounded-full shadow-lg shadow-green-500/50 border-2 border-white mb-1">
            <MapPin size={16} />
          </div>
          <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md">Client</span>
        </div>
      </div>

      {/* Mission Info Sheet */}
      <div className="bg-[#140b2e] flex-1 -mt-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 p-6 flex flex-col">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{clientName}</h2>
            <p className="text-gray-400 text-sm">{clientPhone}</p>
          </div>
          <div className="flex space-x-3">
            {clientPhone && (
              <a href={`tel:${clientPhone}`} className="w-10 h-10 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center hover:bg-green-500/30 transition-colors border border-green-500/30">
                <Phone size={18} />
              </a>
            )}
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start space-x-3 bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="mt-1">
              <MapPin size={18} className="text-primary-light" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">Adresse de livraison</p>
              <p className="text-sm font-bold text-white">{clientAddress}</p>
            </div>
          </div>

          <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
            <div>
              <p className="text-xs text-gray-400 mb-1">Colis</p>
              <div className="space-y-1">
                {order.items?.map((item: any, idx: number) => (
                  <p key={idx} className="text-sm font-bold text-white">{item.quantity}x {item.name}</p>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">À encaisser</p>
              <p className="text-sm font-bold text-green-400">{formatPrice(remaining)}</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto">
          {status === "LIVRE" || status === "COMPLETED" ? (
            <div className="w-full py-4 bg-green-500/20 text-green-400 font-bold rounded-2xl flex items-center justify-center border border-green-500/30">
              <CheckCircle2 size={20} className="mr-2" />
              Mission Terminée avec Succès
            </div>
          ) : status === "CONFIRMED_AWAITING_DRIVER" ? (
            <button 
              onClick={handleAcceptMission}
              disabled={isUpdating}
              className="w-full py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span>Accepter cette Mission</span>
                </>
              )}
            </button>
          ) : (
            <button 
              onClick={handleStatusChange}
              disabled={isUpdating}
              className={`w-full py-4 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 ${
                status === "ACCEPTED" 
                  ? "bg-primary hover:bg-primary-light shadow-primary/20" 
                  : "bg-orange-500 hover:bg-orange-400 shadow-orange-500/20"
              }`}
            >
              {isUpdating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : status === "ACCEPTED" ? (
                <>
                  <Navigation size={20} />
                  <span>Je suis arrivé chez le client (Envoyer SMS)</span>
                </>
              ) : (
                <>
                  <DollarSign size={20} />
                  <span>Confirmer la Livraison & Encaisser</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
