"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, MapPin, Clock, ChevronRight, User, CheckCircle, Loader2 } from "lucide-react";
import { collection, query, orderBy, onSnapshot, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";

export default function DriverDashboard() {
  const router = useRouter();
  const { user, loading, userData } = useAuth();
  const { formatPrice } = useCurrency();
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);

  useEffect(() => {
    if (loading || !user) return;

    let unsubAvailable: any = null;
    let unsubMyOrders: any = null;

    const setupMissionsListener = async () => {
      try {
        let supplierId = "admin";
        let resolvedDriverData: any = null;

        // A. Vérification dans la collection drivers
        try {
          const driverDoc = await getDoc(doc(db, "drivers", user.uid));
          if (driverDoc.exists()) {
            resolvedDriverData = driverDoc.data();
            supplierId = resolvedDriverData.supplierId || "admin";
          }
        } catch (e) {
          console.warn("Could not read drivers doc:", e);
        }

        // B. Vérification de secours dans la collection users
        if (supplierId === "admin" || !resolvedDriverData) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              resolvedDriverData = { ...uData, ...resolvedDriverData };
              if (uData.supplierId && uData.supplierId !== "admin") {
                supplierId = uData.supplierId;
              } else if (uData.parentSupplierId) {
                supplierId = uData.parentSupplierId;
              } else if (uData.createdBy && uData.createdBy !== "admin" && uData.createdBy !== "superAdmin") {
                supplierId = uData.createdBy;
              }
            }
          } catch (e) {
            console.warn("Could not read users doc:", e);
          }
        }

        setDriverInfo({ ...userData, ...resolvedDriverData, supplierId });

        // Query 1: Available Orders (sans index composite pour une fiabilité 100%)
        const qAvailable = query(
          collection(db, "orders"), 
          where("status", "==", "CONFIRMED_AWAITING_DRIVER")
        );

        unsubAvailable = onSnapshot(qAvailable, (snapshot) => {
          let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // RÈGLE D'AFFAIRE STRICTE :
          // 1. Si le livreur a été créé par un fournisseur (supplierId !== 'admin') :
          //    Il ne reçoit et ne voit QUE les courses créées par son fournisseur.
          // 2. Si le livreur a été créé par l'administration (supplierId === 'admin') :
          //    Il peut recevoir TOUTES les commandes de la plateforme.
          if (supplierId && supplierId !== "admin" && supplierId !== "superAdmin") {
            orders = orders.filter((order: any) => {
              const orderSupplierId = order.supplierId;
              const orderSupplierIds = Array.isArray(order.supplierIds) ? order.supplierIds : [];
              return orderSupplierId === supplierId || orderSupplierIds.includes(supplierId);
            });
          }

          // Tri en mémoire par date de création décroissante
          orders.sort((a: any, b: any) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
            return timeB - timeA;
          });

          setAvailableOrders(orders);
          setIsLoading(false);
        }, (err) => {
          console.warn("Driver available orders listener warning:", err.message);
          setIsLoading(false);
        });

        // Query 2: My Orders (sans index composite)
        const qMyOrders = query(
          collection(db, "orders"),
          where("driverId", "==", user.uid)
        );

        unsubMyOrders = onSnapshot(qMyOrders, (snapshot) => {
          let orders = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((o: any) => o.status === "ACCEPTED" || o.status === "ARRIVED_AWAITING_PAYMENT");

          orders.sort((a: any, b: any) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
            return timeB - timeA;
          });

          setMyOrders(orders);
        }, (err) => {
          console.warn("Driver my orders listener warning:", err.message);
        });

      } catch (error) {
        console.error("Erreur initialisation listener:", error);
        setIsLoading(false);
      }
    };

    setupMissionsListener();

    return () => {
      if (unsubAvailable) unsubAvailable();
      if (unsubMyOrders) unsubMyOrders();
    };
  }, [user, loading]);

  const handleAcceptOrder = async (orderId: string) => {
    if (!user || acceptingOrderId) return;
    setAcceptingOrderId(orderId);

    try {
      const driverName = driverInfo?.displayName || userData?.name || "Livreur";
      const driverPhone = driverInfo?.phone || userData?.phone || "";
      const driverVehicle = driverInfo?.vehicle || "";

      const response = await fetch("/api/driver/accept-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          driverId: user.uid,
          driverName,
          driverPhone,
          driverVehicle,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "ALREADY_ACCEPTED") {
          alert("⚠️ Cette mission vient déjà d'être acceptée par un autre livreur.");
          setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
        } else {
          alert(data.message || data.error || "Impossible d'accepter cette course.");
        }
        return;
      }

      // Redirection immédiate vers la page de détails de mission
      router.push(`/driver/mission/${orderId}`);
    } catch (error) {
      console.error("Error accepting order", error);
      alert("Erreur de connexion lors de l'acceptation de la course.");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0b061c]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0b061c] min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Bonjour, {driverInfo?.displayName || userData?.name || "Livreur"}</h1>
          <p className="text-gray-400 text-sm">
            {driverInfo?.supplierId && driverInfo.supplierId !== "admin" 
              ? "Livreur Exclusif (Fournisseur)" 
              : "Livreur Indépendant (Admin)"}
          </p>
        </div>
        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center border border-primary/50">
          <User className="text-primary-light" />
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-gray-400 text-xs font-medium mb-1">Gains du jour</p>
          <p className="text-2xl font-bold text-green-400">$ 45.00</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-gray-400 text-xs font-medium mb-1">Courses en cours</p>
          <p className="text-2xl font-bold text-white">{myOrders.length}</p>
        </div>
      </div>

      {/* Missions Actuelles (Accepted) */}
      {myOrders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Mes Courses en Cours</h2>
          <div className="space-y-4">
            {myOrders.map((mission) => (
              <Link href={`/driver/mission/${mission.id}`} key={mission.id}>
                <div className="bg-[#140b2e] border border-primary/50 rounded-2xl p-4 active:scale-95 transition-transform shadow-[0_0_20px_rgba(139,92,246,0.15)] block">
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-lg bg-primary/20 text-primary-light">
                        <Package size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">#ORD-{mission.id.slice(0, 6).toUpperCase()}</h3>
                        <p className="text-xs text-gray-400">{mission.customerInfo?.name || "Client"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {mission.status === "ACCEPTED" ? "EN ROUTE" : "ARRIVÉ"}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4 relative">
                    <div className="absolute left-2.5 top-5 bottom-3 w-[2px] bg-white/10" />
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center z-10 mt-0.5">
                        <MapPin size={12} className="text-primary-light" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Livraison</p>
                        <p className="text-sm font-medium text-white line-clamp-1">{mission.clientAddress || mission.customerInfo?.address || "Adresse non spécifiée"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex items-center text-gray-400 text-xs">
                      <Clock size={14} className="mr-1" />
                      {mission.createdAt?.toDate ? mission.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Maintenant"}
                    </div>
                    <div className="flex items-center font-bold text-green-400 text-sm">
                      {formatPrice(mission.remainingBalance || mission.totalAmount)}
                      <ChevronRight size={16} className="ml-1" />
                    </div>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Courses Disponibles */}
      <h2 className="text-lg font-bold text-white mb-4">Nouvelles Courses Disponibles</h2>
      
      {availableOrders.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-gray-400">Aucune nouvelle course pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {availableOrders.map((mission) => (
            <div key={mission.id} className="bg-[#140b2e] border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">#ORD-{mission.id.slice(0, 6).toUpperCase()}</h3>
                    <p className="text-xs text-gray-400">
                      {mission.items?.length ? `${mission.items.length} article(s)` : "Nouvelle Commande"}
                    </p>
                  </div>
                </div>
                <div className="font-bold text-green-400 text-sm">
                  {formatPrice(mission.remainingBalance || mission.totalAmount)}
                </div>
              </div>

              <div className="flex items-start space-x-3 mb-6">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center z-10 mt-0.5">
                  <MapPin size={12} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">
                    Livraison {mission.deliveryDetails?.commune ? `(${mission.deliveryDetails.commune})` : ""}
                  </p>
                  <p className="text-sm font-medium text-white line-clamp-2">
                    {mission.clientAddress || mission.customerInfo?.address || mission.deliveryDetails?.address || "Adresse non spécifiée"}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => handleAcceptOrder(mission.id)}
                disabled={acceptingOrderId !== null}
                className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors flex items-center justify-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acceptingOrderId === mission.id ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    <span>Attribution en cours...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} className="mr-2" /> 
                    <span>Accepter la course</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
