"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Package, MapPin,
  ChevronRight, TrendingUp, Calendar, Filter
} from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  COMPLETED:  { label: "Livré",    color: "text-green-400 bg-green-400/10 border-green-400/20",  icon: CheckCircle2 },
  completed:  { label: "Livré",    color: "text-green-400 bg-green-400/10 border-green-400/20",  icon: CheckCircle2 },
  delivered:  { label: "Livré",    color: "text-green-400 bg-green-400/10 border-green-400/20",  icon: CheckCircle2 },
  DELIVERED:  { label: "Livré",    color: "text-green-400 bg-green-400/10 border-green-400/20",  icon: CheckCircle2 },
  LIVRE:      { label: "Livré",    color: "text-green-400 bg-green-400/10 border-green-400/20",  icon: CheckCircle2 },
  CANCELLED:  { label: "Annulée",  color: "text-red-400 bg-red-400/10 border-red-400/20",        icon: XCircle },
  cancelled:  { label: "Annulée",  color: "text-red-400 bg-red-400/10 border-red-400/20",        icon: XCircle },
  ACCEPTED:   { label: "En cours", color: "text-blue-400 bg-blue-400/10 border-blue-400/20",     icon: Clock },
};

type Period = "all" | "today" | "week" | "month";

export default function DriverHistoryPage() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("driverId", "==", user.uid),
          limit(100)
        );
        const snap = await getDocs(q);
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Trier par date décroissante en mémoire
        fetched.sort((a: any, b: any) => {
          const ta = a.completedAt?.toMillis?.() || a.deliveredAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
          const tb = b.completedAt?.toMillis?.() || b.deliveredAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        setOrders(fetched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = orders.filter(o => {
    if (period === "all") return true;
    const d = o.completedAt?.toDate?.() || o.deliveredAt?.toDate?.() || o.createdAt?.toDate?.() || null;
    if (!d) return false;

    const now = new Date();
    if (period === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (period === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalEarnings = filtered.reduce((sum, o) => {
    const s = (o.status || "").toUpperCase();
    if (["COMPLETED", "DELIVERED", "LIVRE"].includes(s)) {
      return sum + Number(o.deliveryFee || o.driverFee || (o.totalAmount || 0) * 0.1 || 0);
    }
    return sum;
  }, 0);

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Aujourd'hui" },
    { key: "week",  label: "7 jours" },
    { key: "month", label: "Ce mois" },
    { key: "all",   label: "Tout" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b061c]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0b061c] min-h-screen pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 mt-2">
        <h1 className="text-xl font-bold text-white">Historique</h1>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Calendar size={14} /> {filtered.length} course{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filtre période */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              period === p.key
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Récapitulatif gains */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-5 mb-5 flex items-center justify-between"
      >
        <div>
          <p className="text-xs text-gray-400 mb-1 font-medium">Gains sur la période</p>
          <p className="text-3xl font-black text-white">${totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-primary-light mt-1">{filtered.filter(o => ["COMPLETED","DELIVERED","LIVRE","completed","delivered"].includes(o.status)).length} livraisons réussies</p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
          <TrendingUp size={28} className="text-primary-light" />
        </div>
      </motion.div>

      {/* Liste des courses */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Package size={48} className="mb-3 opacity-30" />
          <p className="text-sm">Aucune course sur cette période.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, i) => {
            const statusInfo = STATUS_MAP[order.status] || { label: order.status || "Inconnu", color: "text-gray-400 bg-white/5 border-white/10", icon: Clock };
            const StatusIcon = statusInfo.icon;
            const date = order.completedAt?.toDate?.() || order.deliveredAt?.toDate?.() || order.createdAt?.toDate?.() || null;
            const addr = order.clientAddress || order.customerInfo?.address || order.deliveryDetails?.address || "—";
            const fee = Number(order.deliveryFee || order.driverFee || (order.totalAmount || 0) * 0.1 || 0);
            const isCompleted = ["COMPLETED","DELIVERED","LIVRE","completed","delivered"].includes(order.status);

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-[#140b2e] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">#{order.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${statusInfo.color}`}>
                    <StatusIcon size={11} />
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300 line-clamp-2">{addr}</p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  <p className="text-[11px] text-gray-500">
                    {date ? date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Date inconnue"}
                  </p>
                  {isCompleted && fee > 0 && (
                    <p className="text-sm font-black text-green-400">+${fee.toFixed(2)}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
