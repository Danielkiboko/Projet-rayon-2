"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Download, PieChart, Home, AlertCircle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight, RefreshCw,
  ShoppingBag, UtensilsCrossed, Package, Truck, DollarSign, Layers
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getSupplierType } from "@/lib/permissions";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: any;
  status: string;
  branch?: string;
  tenantName?: string;
  propertyName?: string;
  capital?: number;
  profit?: number;
}

interface Tenant {
  id: string;
  name: string;
  propertyName?: string;
  rentAmount: number;
  nextPaymentDate?: any;
  paymentStatus?: string;
}

interface Property {
  id: string;
  title: string;
  status?: string;
  isOccupied?: boolean;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  items: any[];
  createdAt: any;
  deliveredAt?: any;
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function SupplierReportsPage() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const rayon = getSupplierType(userData);
  const isImmo = rayon === "immo";
  const isSaveurs = rayon === "saveurs";

  const accentColor = isSaveurs 
    ? "#FF6B35" 
    : rayon === "mode" 
    ? "#D4B08C" 
    : rayon === "connect" 
    ? "#00B5A5" 
    : isImmo 
    ? "#4C6EF5" 
    : "#C7D300";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!activeSupplierId) return;
    setLoading(true);
    let unsubs: (() => void)[] = [];

    // 1. Transactions de caisse fournisseur (partagé immo et non-immo)
    const qTx = query(
      collection(db, "supplier_transactions"),
      where("supplierId", "==", activeSupplierId),
      limit(200)
    );

    unsubs.push(
      onSnapshot(qTx, (snap) => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
        setLoading(false);
      }, (err) => {
        console.warn("Reports supplier_transactions warning:", err.message);
        setLoading(false);
      })
    );

    if (isImmo) {
      // 2. Immo : Locataires & Propriétés
      const qTenants = query(
        collection(db, "tenants"),
        where("supplierId", "==", activeSupplierId),
        limit(200)
      );
      const qProps = query(
        collection(db, "properties"),
        where("supplierId", "==", activeSupplierId),
        limit(200)
      );

      unsubs.push(
        onSnapshot(qTenants, (snap) => {
          setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
        })
      );

      unsubs.push(
        onSnapshot(qProps, (snap) => {
          setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
        })
      );
    } else {
      // 3. Non-Immo (Saveurs, Mode, Connect) : Commandes
      const qOrders = query(
        collection(db, "orders"),
        where("supplierIds", "array-contains", activeSupplierId),
        limit(200)
      );

      unsubs.push(
        onSnapshot(qOrders, (snap) => {
          setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
          setLoading(false);
        }, (err) => {
          console.warn("Reports orders warning:", err.message);
          setLoading(false);
        })
      );
    }

    return () => unsubs.forEach(u => u());
  }, [activeSupplierId, refreshKey, isImmo]);

  // ── KPIs Calculés ──
  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    if (isImmo) {
      // ── LOGIQUE IMMO ──
      const incomeThisMonth = transactions
        .filter(t => {
          const d = t.createdAt?.toDate?.() || new Date(t.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear &&
            (t.type === "INCOME" || t.type === "RENT_INCOME" || t.type === "HOTEL_INCOME");
        })
        .reduce((s, t) => s + (t.amount || 0), 0);

      const incomeLastMonth = transactions
        .filter(t => {
          const d = t.createdAt?.toDate?.() || new Date(t.createdAt);
          return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear &&
            (t.type === "INCOME" || t.type === "RENT_INCOME" || t.type === "HOTEL_INCOME");
        })
        .reduce((s, t) => s + (t.amount || 0), 0);

      const growthPct = incomeLastMonth === 0
        ? (incomeThisMonth > 0 ? 100 : 0)
        : Math.round(((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100);

      const occupiedCount = tenants.filter(t => t.paymentStatus !== "archived").length;
      const totalProps = properties.length || 1;
      const occupancyRate = Math.round((occupiedCount / totalProps) * 100);

      const overdueAmount = tenants
        .filter(t => {
          if (!t.nextPaymentDate) return false;
          const d = t.nextPaymentDate?.toDate?.() || new Date(t.nextPaymentDate);
          return d < now && t.paymentStatus !== "paid";
        })
        .reduce((s, t) => s + (t.rentAmount || 0), 0);

      const overdueCount = tenants.filter(t => {
        if (!t.nextPaymentDate) return false;
        const d = t.nextPaymentDate?.toDate?.() || new Date(t.nextPaymentDate);
        return d < now && t.paymentStatus !== "paid";
      }).length;

      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const mIdx = (thisMonth - 5 + i + 12) % 12;
        const yIdx = thisMonth - 5 + i < 0 ? thisYear - 1 : thisYear;
        const total = transactions
          .filter(t => {
            const d = t.createdAt?.toDate?.() || new Date(t.createdAt);
            return d.getMonth() === mIdx && d.getFullYear() === yIdx &&
              (t.type === "INCOME" || t.type === "RENT_INCOME" || t.type === "HOTEL_INCOME");
          })
          .reduce((s, t) => s + (t.amount || 0), 0);
        return { label: MONTHS_FR[mIdx], total };
      });

      return {
        incomeThisMonth,
        growthPct,
        occupancyRate,
        occupiedCount,
        totalProps,
        overdueAmount,
        overdueCount,
        monthlyData,
      };
    } else {
      // ── LOGIQUE NON-IMMO (Saveurs, Mode, Connect) ──
      const deliveredOrders = orders.filter(o =>
        ["completed", "delivered", "livrée", "livre"].includes((o.status || "").toLowerCase())
      );
      const pendingOrders = orders.filter(o =>
        ["pending", "pending_driver", "confirmed_awaiting_driver", "preparing", "driver_assigned", "accepted", "in_transit", "ready"].includes((o.status || "").toLowerCase())
      );

      // Calculer le chiffre d'affaires propre à ce fournisseur
      const calcOrderSupplierTotal = (o: Order) => {
        const myItems = o.items?.filter((it: any) => !it.supplierId || it.supplierId === activeSupplierId) || [];
        if (myItems.length > 0) {
          return myItems.reduce((acc, it) => acc + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
        }
        return Number(o.totalAmount) || 0;
      };

      const incomeThisMonth = deliveredOrders
        .filter(o => {
          const d = o.deliveredAt?.toDate?.() || o.createdAt?.toDate?.() || new Date(o.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((sum, o) => sum + calcOrderSupplierTotal(o), 0);

      const incomeLastMonth = deliveredOrders
        .filter(o => {
          const d = o.deliveredAt?.toDate?.() || o.createdAt?.toDate?.() || new Date(o.createdAt);
          return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        })
        .reduce((sum, o) => sum + calcOrderSupplierTotal(o), 0);

      const growthPct = incomeLastMonth === 0
        ? (incomeThisMonth > 0 ? 100 : 0)
        : Math.round(((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100);

      const totalDeliveredRevenue = deliveredOrders.reduce((sum, o) => sum + calcOrderSupplierTotal(o), 0);
      const averageBasket = deliveredOrders.length > 0 ? Math.round(totalDeliveredRevenue / deliveredOrders.length) : 0;
      const completionRate = orders.length > 0 ? Math.round((deliveredOrders.length / orders.length) * 100) : 100;

      // Agrégation des Top 5 articles vendus
      const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
      deliveredOrders.forEach(o => {
        const myItems = o.items?.filter((it: any) => !it.supplierId || it.supplierId === activeSupplierId) || o.items || [];
        myItems.forEach((it: any) => {
          const pName = it.productName || it.title || "Article";
          const qty = Number(it.quantity) || 1;
          const rev = (Number(it.price) || 0) * qty;
          const curr = productMap.get(pName) || { name: pName, qty: 0, revenue: 0 };
          curr.qty += qty;
          curr.revenue += rev;
          productMap.set(pName, curr);
        });
      });
      const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const mIdx = (thisMonth - 5 + i + 12) % 12;
        const yIdx = thisMonth - 5 + i < 0 ? thisYear - 1 : thisYear;
        const total = deliveredOrders
          .filter(o => {
            const d = o.deliveredAt?.toDate?.() || o.createdAt?.toDate?.() || new Date(o.createdAt);
            return d.getMonth() === mIdx && d.getFullYear() === yIdx;
          })
          .reduce((sum, o) => sum + calcOrderSupplierTotal(o), 0);
        return { label: MONTHS_FR[mIdx], total };
      });

      return {
        incomeThisMonth,
        growthPct,
        deliveredCount: deliveredOrders.length,
        pendingCount: pendingOrders.length,
        completionRate,
        averageBasket,
        topProducts,
        monthlyData,
      };
    }
  }, [transactions, tenants, properties, orders, isImmo, activeSupplierId]);

  // Dernières transactions
  const recentPayments = useMemo(() =>
    transactions
      .filter(t => t.type === "INCOME" || t.type === "RENT_INCOME")
      .slice(0, 8),
    [transactions]
  );

  const maxMonthly = Math.max(...(kpis.monthlyData?.map(m => m.total) || [1]), 1);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isImmo ? "Rapports Financiers & Locatifs" : isSaveurs ? "Rapports d'Activité Restauration" : "Rapports d'Activité Commerciale"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isImmo 
              ? "Revenus locatifs, taux d'occupation et encaissements en temps réel."
              : isSaveurs
              ? "Chiffre d'affaires, panier moyen, commandes en cuisine et plats les plus demandés."
              : "Chiffre d'affaires, volume des commandes expédiées et articles les plus vendus."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 text-xs font-medium transition-all"
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
          <button
            onClick={handleExportPDF}
            style={{ backgroundColor: accentColor }}
            className="flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg text-xs transition-all shadow-lg hover:brightness-110"
          >
            <Download size={16} />
            Exporter (PDF)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor, borderTopColor: "transparent" }} />
          <p className="text-sm">Chargement des données du rapport...</p>
        </div>
      ) : (
        <>
          {/* KPIs Principaux */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* KPI 1 : Revenus du mois */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Revenus (Ce mois)</p>
                  <p className="text-3xl font-bold text-white mt-2">
                    {kpis.incomeThisMonth.toLocaleString("fr-FR")} $
                  </p>
                </div>
                <div className="p-3 bg-green-500/15 text-green-400 rounded-xl border border-green-500/20">
                  <TrendingUp size={22} />
                </div>
              </div>
              <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${kpis.growthPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                {kpis.growthPct >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span>{kpis.growthPct >= 0 ? "+" : ""}{kpis.growthPct}% vs mois précédent</span>
              </div>
            </motion.div>

            {/* KPI 2 : Immo Taux d'occupation VS Non-Immo Commandes Livrées */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors"
            >
              {isImmo ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Taux d'occupation</p>
                      <p className="text-3xl font-bold text-white mt-2">{(kpis as any).occupancyRate}%</p>
                    </div>
                    <div className="p-3 bg-[#4C6EF5]/15 text-[#4C6EF5] rounded-xl border border-[#4C6EF5]/20">
                      <PieChart size={22} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{(kpis as any).occupiedCount} locataire{(kpis as any).occupiedCount > 1 ? "s" : ""} actif{(kpis as any).occupiedCount > 1 ? "s" : ""}</span>
                      <span>{(kpis as any).totalProps} bien{(kpis as any).totalProps > 1 ? "s" : ""} total</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4C6EF5] rounded-full transition-all duration-700"
                        style={{ width: `${(kpis as any).occupancyRate}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Commandes Honorées</p>
                      <p className="text-3xl font-bold text-white mt-2">{(kpis as any).deliveredCount}</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ backgroundColor: `${accentColor}25`, borderColor: `${accentColor}40`, color: accentColor }}>
                      {isSaveurs ? <UtensilsCrossed size={22} /> : <ShoppingBag size={22} />}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{(kpis as any).pendingCount} en préparation / livraison</span>
                      <span className="font-semibold text-emerald-400">{(kpis as any).completionRate}% livrées</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(kpis as any).completionRate}%`, backgroundColor: accentColor }}
                      />
                    </div>
                  </div>
                </>
              )}
            </motion.div>

            {/* KPI 3 : Immo Loyers en retard VS Non-Immo Panier Moyen */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors"
            >
              {isImmo ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Loyers en retard</p>
                      <p className={`text-3xl font-bold mt-2 ${(kpis as any).overdueCount > 0 ? "text-red-400" : "text-white"}`}>
                        {(kpis as any).overdueAmount.toLocaleString("fr-FR")} $
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl border ${(kpis as any).overdueCount > 0 ? "bg-red-500/15 text-red-400 border-red-500/20" : "bg-white/5 text-gray-400 border-white/10"}`}>
                      <AlertCircle size={22} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">
                    {(kpis as any).overdueCount > 0
                      ? `⚠️ ${(kpis as any).overdueCount} locataire(s) en retard de paiement`
                      : "Tous les locataires sont à jour"}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Panier Moyen</p>
                      <p className="text-3xl font-bold text-white mt-2">
                        {((kpis as any).averageBasket || 0).toLocaleString("fr-FR")} $
                      </p>
                    </div>
                    <div className="p-3 bg-purple-500/15 text-purple-400 rounded-xl border border-purple-500/20">
                      <DollarSign size={22} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">
                    Valeur moyenne dépensée par client par commande
                  </p>
                </>
              )}
            </motion.div>
          </div>

          {/* Graphique d'évolution mensuelle */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-white">Évolution des Revenus (6 derniers mois)</h3>
                <p className="text-xs text-gray-400 mt-0.5">Total des ventes et encaissements enregistrés</p>
              </div>
              <BarChart3 size={20} style={{ color: accentColor }} />
            </div>
            <div className="flex items-end gap-3 h-36">
              {kpis.monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {m.total.toLocaleString("fr-FR")} $
                  </span>
                  <div className="w-full rounded-t-md bg-white/5 relative overflow-hidden" style={{ height: "100px" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.round((m.total / maxMonthly) * 100)}%` }}
                      transition={{ delay: 0.1 * i, duration: 0.6, ease: "easeOut" }}
                      className="absolute bottom-0 left-0 right-0 rounded-t-md"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">{m.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Section Non-Immo : Top 5 des Articles les plus vendus */}
          {!isImmo && (kpis as any).topProducts && (kpis as any).topProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {isSaveurs ? "Top 5 des Plats & Menus les plus commandés" : "Top 5 des Articles les plus vendus"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Classement par volume de ventes honorées</p>
                </div>
                <Package size={20} style={{ color: accentColor }} />
              </div>
              <div className="space-y-3">
                {(kpis as any).topProducts.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-white text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-xs text-gray-400">{p.qty} unité{p.qty > 1 ? "s" : ""}</span>
                      <span className="text-sm font-bold text-emerald-400">{p.revenue.toLocaleString("fr-FR")} $</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tableau des derniers encaissements réels */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Derniers encaissements de caisse</h3>
              <span className="text-xs text-gray-500">{recentPayments.length} entrée{recentPayments.length > 1 ? "s" : ""}</span>
            </div>
            {recentPayments.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-gray-500 gap-3">
                {isImmo ? <Home size={36} className="opacity-30" /> : <ShoppingBag size={36} className="opacity-30" />}
                <p className="text-sm">Aucun encaissement enregistré.</p>
                <p className="text-xs text-gray-600">Les encaissements apparaîtront automatiquement lors des livraisons et des paiements reçus.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="text-xs uppercase bg-black/20 text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Montant</th>
                      <th className="px-6 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((tx) => {
                      const date = tx.createdAt?.toDate?.() || new Date(tx.createdAt);
                      return (
                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 text-gray-400 text-xs">
                            {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              {isImmo ? (
                                <Home size={13} className="text-[#4C6EF5] shrink-0" />
                              ) : isSaveurs ? (
                                <UtensilsCrossed size={13} className="text-[#FF6B35] shrink-0" />
                              ) : (
                                <Package size={13} className="text-emerald-400 shrink-0" />
                              )}
                              <span className="truncate max-w-[280px]">{tx.description || "Vente"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 font-bold text-green-400">
                            + {(tx.amount || 0).toLocaleString("fr-FR")} $
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                              tx.status === "COMPLETED"
                                ? "bg-green-500/15 text-green-400"
                                : "bg-orange-500/15 text-orange-400"
                            }`}>
                              {tx.status === "COMPLETED" ? <CheckCircle size={10} /> : <Clock size={10} />}
                              {tx.status === "COMPLETED" ? "Encaissé" : "En cours"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
