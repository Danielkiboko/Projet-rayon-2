"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Download, PieChart, Home, AlertCircle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

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

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function SupplierReportsPage() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!activeSupplierId) return;
    let unsubs: (() => void)[] = [];

    const qTx = query(
      collection(db, "transactions"),
      where("supplierId", "==", activeSupplierId),
      orderBy("createdAt", "desc")
    );

    const qTenants = query(
      collection(db, "tenants"),
      where("supplierId", "==", activeSupplierId)
    );

    const qProps = query(
      collection(db, "properties"),
      where("supplierId", "==", activeSupplierId)
    );

    unsubs.push(
      onSnapshot(qTx, (snap) => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
        setLoading(false);
      }, () => setLoading(false))
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

    return () => unsubs.forEach(u => u());
  }, [activeSupplierId, refreshKey]);

  // ── KPIs calculés ──
  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

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

    // Graphique — 6 derniers mois
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

    return { incomeThisMonth, growthPct, occupancyRate, occupiedCount, totalProps, overdueAmount, overdueCount, monthlyData };
  }, [transactions, tenants, properties]);

  // Derniers paiements reçus
  const recentPayments = useMemo(() =>
    transactions
      .filter(t => t.type === "INCOME" || t.type === "RENT_INCOME")
      .slice(0, 8),
    [transactions]
  );

  const maxMonthly = Math.max(...kpis.monthlyData.map(m => m.total), 1);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rapports Financiers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Revenus locatifs, taux d'occupation et encaissements en temps réel.</p>
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
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4C6EF5] hover:bg-[#3b5bdb] text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-[#4C6EF5]/20"
          >
            <Download size={16} />
            Exporter (PDF)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <div className="w-8 h-8 border-2 border-[#4C6EF5] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Chargement des données...</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Revenus du mois */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-[#4C6EF5]/40 transition-colors"
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

            {/* Taux d'occupation */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-[#4C6EF5]/40 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Taux d'occupation</p>
                  <p className="text-3xl font-bold text-white mt-2">{kpis.occupancyRate}%</p>
                </div>
                <div className="p-3 bg-[#4C6EF5]/15 text-[#4C6EF5] rounded-xl border border-[#4C6EF5]/20">
                  <PieChart size={22} />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{kpis.occupiedCount} locataire{kpis.occupiedCount > 1 ? "s" : ""} actif{kpis.occupiedCount > 1 ? "s" : ""}</span>
                  <span>{kpis.totalProps} bien{kpis.totalProps > 1 ? "s" : ""} total</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4C6EF5] rounded-full transition-all duration-700"
                    style={{ width: `${kpis.occupancyRate}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Loyers en retard */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-red-500/30 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Loyers en retard</p>
                  <p className={`text-3xl font-bold mt-2 ${kpis.overdueAmount > 0 ? "text-red-400" : "text-green-400"}`}>
                    {kpis.overdueAmount.toLocaleString("fr-FR")} $
                  </p>
                </div>
                <div className={`p-3 rounded-xl border ${kpis.overdueAmount > 0 ? "bg-red-500/15 text-red-400 border-red-500/20" : "bg-green-500/15 text-green-400 border-green-500/20"}`}>
                  {kpis.overdueAmount > 0 ? <AlertCircle size={22} /> : <CheckCircle size={22} />}
                </div>
              </div>
              <div className={`mt-4 flex items-center gap-1 text-sm ${kpis.overdueCount > 0 ? "text-red-400" : "text-green-400"}`}>
                {kpis.overdueCount > 0
                  ? <><Clock size={14} /><span>{kpis.overdueCount} locataire{kpis.overdueCount > 1 ? "s" : ""} en retard</span></>
                  : <><CheckCircle size={14} /><span>Aucun retard de paiement</span></>
                }
              </div>
            </motion.div>
          </div>

          {/* Graphique Revenus 6 mois */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-white">Revenus — 6 derniers mois</h3>
                <p className="text-xs text-gray-500 mt-0.5">Loyers et encaissements reçus</p>
              </div>
              <BarChart3 size={20} className="text-[#4C6EF5]" />
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
                      className="absolute bottom-0 left-0 right-0 bg-[#4C6EF5] rounded-t-md"
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">{m.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Tableau des encaissements réels */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Derniers encaissements</h3>
              <span className="text-xs text-gray-500">{recentPayments.length} entrée{recentPayments.length > 1 ? "s" : ""}</span>
            </div>
            {recentPayments.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-gray-500 gap-3">
                <Home size={36} className="opacity-30" />
                <p className="text-sm">Aucun encaissement enregistré.</p>
                <p className="text-xs text-gray-600">Enregistrez des paiements dans le Livre de Caisse.</p>
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
                    {recentPayments.map((tx, i) => {
                      const date = tx.createdAt?.toDate?.() || new Date(tx.createdAt);
                      return (
                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 text-gray-400 text-xs">
                            {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <Home size={13} className="text-[#4C6EF5] shrink-0" />
                              <span className="truncate max-w-[250px]">{tx.description || "Loyer"}</span>
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
                              {tx.status === "COMPLETED" ? "Encaissé" : "En attente"}
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
