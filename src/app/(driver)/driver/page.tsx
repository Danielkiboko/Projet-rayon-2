"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package, MapPin, Clock, ChevronRight, User, CheckCircle,
  Loader2, Bell, TrendingUp, Bike
} from "lucide-react";
import {
  collection, query, where, onSnapshot, doc, getDoc, getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { motion, AnimatePresence } from "framer-motion";

export default function DriverDashboard() {
  const router = useRouter();
  const { user, loading, userData } = useAuth();
  const { formatPrice } = useCurrency();

  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const prevAvailableIds = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);

  // ── Son d'alerte nouvelle course ──
  const playAlert = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      [0, 0.2, 0.4].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.25);
      });
    } catch {}
  }, []);

  // ── Gains du jour depuis Firestore ──
  const loadTodayEarnings = useCallback(async (uid: string) => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const q = query(
        collection(db, "orders"),
        where("driverId", "==", uid),
        where("status", "in", ["COMPLETED", "completed", "delivered", "DELIVERED", "LIVRE"])
      );
      const snap = await getDocs(q);
      let total = 0;
      snap.forEach(d => {
        const data = d.data();
        const delivDate = data.deliveredAt?.toDate?.() || data.completedAt?.toDate?.() || null;
        if (delivDate && delivDate >= today) {
          total += Number(data.deliveryFee || data.driverFee || (data.totalAmount || 0) * 0.1 || 0);
        }
      });
      setTodayEarnings(total);
    } catch {}
  }, []);

  useEffect(() => {
    if (loading || !user) return;

    let unsubAvailable: any = null;
    let unsubMyOrders: any = null;

    const setup = async () => {
      try {
        let supplierId = "admin";
        let resolvedDriverData: any = null;

        // A. Collection drivers
        try {
          const driverDoc = await getDoc(doc(db, "drivers", user.uid));
          if (driverDoc.exists()) {
            resolvedDriverData = driverDoc.data();
            supplierId = resolvedDriverData.supplierId || "admin";
          }
        } catch {}

        // B. Fallback users
        if (supplierId === "admin" || !resolvedDriverData) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              resolvedDriverData = { ...uData, ...resolvedDriverData };
              if (uData.supplierId && uData.supplierId !== "admin") supplierId = uData.supplierId;
              else if (uData.parentSupplierId) supplierId = uData.parentSupplierId;
              else if (uData.createdBy && !["admin","superAdmin"].includes(uData.createdBy)) supplierId = uData.createdBy;
            }
          } catch {}
        }

        setDriverInfo({ ...userData, ...resolvedDriverData, supplierId });

        // Gains du jour
        await loadTodayEarnings(user.uid);

        // ── Courses disponibles ──
        const qAvailable = query(
          collection(db, "orders"),
          where("status", "==", "CONFIRMED_AWAITING_DRIVER")
        );

        unsubAvailable = onSnapshot(qAvailable, (snapshot) => {
          let orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          if (supplierId && !["admin", "superAdmin"].includes(supplierId)) {
            orders = orders.filter((o: any) => {
              const ids = Array.isArray(o.supplierIds) ? o.supplierIds : [];
              return o.supplierId === supplierId || ids.includes(supplierId);
            });
          }

          orders.sort((a: any, b: any) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
          });

          // Alerte nouvelles courses
          const newIds = new Set(orders.map((o: any) => o.id));
          let hasNew = false;
          newIds.forEach(id => { if (!prevAvailableIds.current.has(id) && prevAvailableIds.current.size > 0) hasNew = true; });
          if (hasNew) {
            playAlert();
            setNewOrderAlert(true);
            setTimeout(() => setNewOrderAlert(false), 5000);
          }
          prevAvailableIds.current = newIds as Set<string>;

          setAvailableOrders(orders);
          setIsLoading(false);
        }, () => setIsLoading(false));

        // ── Mes courses en cours ──
        const qMy = query(collection(db, "orders"), where("driverId", "==", user.uid));
        unsubMyOrders = onSnapshot(qMy, (snapshot) => {
          let orders = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((o: any) => ["ACCEPTED", "ARRIVED_AWAITING_PAYMENT"].includes(o.status));
          orders.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          setMyOrders(orders);
        }, () => {});

      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    };

    setup();
    return () => { unsubAvailable?.(); unsubMyOrders?.(); };
  }, [user, loading, loadTodayEarnings, playAlert]);

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
        body: JSON.stringify({ orderId, driverId: user.uid, driverName, driverPhone, driverVehicle }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        if (data.code === "ALREADY_ACCEPTED") {
          setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
        } else {
          alert(data.message || "Impossible d'accepter cette course.");
        }
        return;
      }
      router.push(`/driver/mission/${orderId}`);
    } catch {
      alert("Erreur de connexion lors de l'acceptation.");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0b061c]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const driverName = driverInfo?.displayName || userData?.name || "Livreur";

  return (
    <div className="p-4 bg-[#0b061c] min-h-screen pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-2">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tableau de bord</p>
          <h1 className="text-xl font-bold text-white mt-0.5">Bonjour, {driverName.split(" ")[0]} 👋</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {driverInfo?.supplierId && !["admin","superAdmin"].includes(driverInfo.supplierId)
              ? "🔒 Livreur Exclusif"
              : "🌐 Livreur Indépendant"}
          </p>
        </div>
        <Link href="/driver/profile">
          <div className="w-12 h-12 bg-primary/15 rounded-full flex items-center justify-center border border-primary/30 hover:bg-primary/25 transition-all">
            <span className="text-primary-light font-black text-lg">
              {driverName.charAt(0).toUpperCase()}
            </span>
          </div>
        </Link>
      </div>

      {/* Alerte nouvelle course */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="flex items-center gap-3 mb-4 px-4 py-3 bg-primary/15 border border-primary/40 rounded-2xl shadow-lg shadow-primary/10"
          >
            <Bell size={18} className="text-primary-light animate-bounce shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">🚚 Nouvelle course disponible !</p>
              <p className="text-xs text-gray-400">Une commande vient d'être mise en ligne.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 gap-3 mb-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/20 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-400" />
            <p className="text-gray-400 text-xs font-medium">Gains du jour</p>
          </div>
          <p className="text-2xl font-black text-green-400">${todayEarnings.toFixed(2)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Bike size={16} className="text-primary-light" />
            <p className="text-gray-400 text-xs font-medium">Courses en cours</p>
          </div>
          <p className="text-2xl font-black text-white">{myOrders.length}</p>
        </motion.div>
      </div>

      {/* Mes courses en cours */}
      {myOrders.length > 0 && (
        <div className="mb-7">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">🔵 Mes courses en cours</h2>
          <div className="space-y-3">
            {myOrders.map((mission: any) => (
              <Link href={`/driver/mission/${mission.id}`} key={mission.id}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#140b2e] border border-primary/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:border-primary/60 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-primary/20 text-primary-light">
                        <Package size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">#ORD-{mission.id.slice(0, 6).toUpperCase()}</h3>
                        <p className="text-xs text-gray-400">{mission.items?.length || 0} article(s)</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase border ${
                      mission.status === "ACCEPTED"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    }`}>
                      {mission.status === "ACCEPTED" ? "En route" : "Arrivé"}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 mb-3">
                    <MapPin size={13} className="text-gray-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-white line-clamp-1">
                      {mission.clientAddress || mission.customerInfo?.address || "Adresse non spécifiée"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="flex items-center text-gray-500 text-xs gap-1">
                      <Clock size={12} />
                      {mission.createdAt?.toDate ? mission.createdAt.toDate().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                    <div className="flex items-center font-bold text-green-400 text-sm gap-1">
                      {formatPrice(mission.remainingBalance || mission.totalAmount)}
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Courses disponibles */}
      <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
        🟢 Courses disponibles
        {availableOrders.length > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary-light text-xs rounded-full font-bold">
            {availableOrders.length}
          </span>
        )}
      </h2>

      {availableOrders.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
          <Bike size={36} className="mx-auto mb-3 text-gray-600 opacity-50" />
          <p className="text-gray-400 text-sm">Aucune nouvelle course pour le moment.</p>
          <p className="text-gray-600 text-xs mt-1">Vous serez alerté dès qu'une course est disponible.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {availableOrders.map((mission: any, i: number) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-[#140b2e] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                    <Package size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">#ORD-{mission.id.slice(0, 6).toUpperCase()}</h3>
                    <p className="text-xs text-gray-400">
                      {mission.items?.length ? `${mission.items.length} article(s)` : "Nouvelle commande"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-green-400 text-sm">{formatPrice(mission.remainingBalance || mission.totalAmount)}</p>
                  <p className="text-[10px] text-gray-500">à encaisser</p>
                </div>
              </div>

              <div className="flex items-start gap-2 mb-4">
                <MapPin size={13} className="text-gray-500 mt-0.5 shrink-0" />
                <p className="text-sm text-white line-clamp-2">
                  {mission.clientAddress || mission.customerInfo?.address || mission.deliveryDetails?.address || "Adresse non spécifiée"}
                  {mission.deliveryDetails?.commune ? ` (${mission.deliveryDetails.commune})` : ""}
                </p>
              </div>

              <button
                onClick={() => handleAcceptOrder(mission.id)}
                disabled={acceptingOrderId !== null}
                className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acceptingOrderId === mission.id ? (
                  <><Loader2 size={17} className="animate-spin" /><span>Attribution...</span></>
                ) : (
                  <><CheckCircle size={17} /><span>Accepter la course</span></>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
