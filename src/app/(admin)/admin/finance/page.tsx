"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search,
  FileText, CheckCircle, Clock, Sliders, Lock,
  Calendar, TrendingUp, ShoppingBag
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, doc, limit
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { fetchSuppliersAction } from "./actions";
import { canAccessFinance } from "@/lib/permissions";
import {
  AccountingEntry,
  ADJUSTMENT_REASONS,
  recordCashAdjustment,
  recordSubscriptionDeposit,
  isOfficialAdminSupplier,
} from "@/lib/accountingLedger";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";

interface Transaction {
  id: string;
  type: "SUBSCRIPTION" | "EXPENSE" | "OTHER_INCOME";
  amount: number;
  currency: string;
  description: string;
  referenceId?: string;
  status: "COMPLETED" | "PENDING";
  createdAt: any;
}

interface UserSupplier {
  id: string;
  displayName: string;
  email: string;
  company?: string;
  phone?: string;
  rayon?: string;
  subscriptionEndDate?: any;
  subscriptionStatus?: string;
  isBlocked?: boolean;
  depositAmount?: number;
  isOfficialAdminStore?: boolean;
  isAdminSupplier?: boolean;
  createdAt?: any;
}

export default function AdminFinancePage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"ledger" | "deposits" | "overview">("ledger");

  // State data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<AccountingEntry[]>([]);
  const [suppliers, setSuppliers] = useState<UserSupplier[]>([]);
  const [adminStoreSales, setAdminStoreSales] = useState<any[]>([]);
  const [allPlatformOrders, setAllPlatformOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [journalFilter, setJournalFilter] = useState<string>("ALL");
  const [periodFilter, setPeriodFilter] = useState<"today" | "yesterday" | "last7days" | "this_month" | "all" | "custom">("today");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [calendarStartDate, setCalendarStartDate] = useState<string>("");
  const [calendarEndDate, setCalendarEndDate] = useState<string>("");
  const [showRangePicker, setShowRangePicker] = useState<boolean>(false);
  const [search, setSearch] = useState("");

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

  // Form states: Standard Transaction
  const [txType, setTxType] = useState<"SUBSCRIPTION" | "EXPENSE" | "OTHER_INCOME">("SUBSCRIPTION");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states: Cash Adjustment
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState<"ADD" | "SUBTRACT">("ADD");
  const [adjReason, setAdjReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [adjLabel, setAdjLabel] = useState("");
  const [adjRef, setAdjRef] = useState("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  // Action feedback
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    if (!loading && !canAccessFinance(user, userData)) {
      router.push("/admin/dashboard");
      return;
    }

    const fetchSuppliers = async () => {
      try {
        const sups = await fetchSuppliersAction();
        setSuppliers(sups as any);
      } catch (err) {
        console.error("Error fetching suppliers:", err);
      }
    };

    if (canAccessFinance(user, userData)) {
      fetchSuppliers();
    }

    // 1. Listen to Transactions
    const qTx = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(100));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const data: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      setTransactions(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setIsLoading(false);
    });

    // 2. Listen to Formal Accounting Ledger
    const qLedger = query(collection(db, "accounting_ledger"), orderBy("date", "desc"), limit(100));
    const unsubLedger = onSnapshot(qLedger, (snapshot) => {
      const entries: AccountingEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push({ id: docSnap.id, ...docSnap.data() } as AccountingEntry);
      });
      setLedgerEntries(entries);
    }, (error) => {
      console.warn("Accounting ledger listener warning:", error.message);
    });

    // 3. Listen to Completed Orders containing Official Admin Store / Admin items
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const sales: any[] = [];
      const platformOrders: any[] = [];
      snapshot.forEach((docSnap) => {
        const order = docSnap.data();
        const status = (order.status || "").toUpperCase();
        if (status === "COMPLETED" || status === "LIVRÉE" || status === "DELIVERED") {
          // Volume total plateforme au prix facturé au client
          const orderTotal = Number(order.total || order.totalPrice || order.subtotal || 0);
          platformOrders.push({
            id: docSnap.id,
            total: orderTotal,
            createdAt: order.deliveredAt || order.createdAt
          });

          const adminItems = (order.items || []).filter((item: any) =>
            item.isAdminProduct ||
            item.isOfficialRayons ||
            item.isOfficialAdminStore ||
            item.supplierId === "admin"
          );
          if (adminItems.length > 0) {
            const amount = adminItems.reduce((acc: number, it: any) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
            sales.push({
              id: docSnap.id,
              orderId: docSnap.id,
              amount,
              items: adminItems,
              createdAt: order.createdAt
            });
          }
        }
      });
      setAdminStoreSales(sales);
      setAllPlatformOrders(platformOrders);
    }, (error) => {
      console.warn("Orders finance listener warning:", error.message);
    });

    return () => {
      unsubTx();
      unsubLedger();
      unsubOrders();
    };
  }, [user, userData, loading, router]);

  // Helpers pour le filtrage par période (Calendrier, 24h, Historique)
  const getTxTimestamp = (t: any): number => {
    if (!t) return 0;
    const d = t.createdAt || t.date;
    if (!d) return 0;
    if (d.toMillis) return d.toMillis();
    if (d.toDate) return d.toDate().getTime();
    if (d.seconds) return d.seconds * 1000;
    if (typeof d === "number") return d;
    const parsed = new Date(d).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const isTxInPeriod = (t: any, period: "today" | "yesterday" | "last7days" | "this_month" | "all" | "custom"): boolean => {
    if (period === "all") return true;
    const time = getTxTimestamp(t);
    if (!time) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    if (period === "today") return time >= startOfToday;
    if (period === "yesterday") return time >= startOfYesterday && time < startOfToday;
    if (period === "last7days") return time >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (period === "this_month") return time >= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (period === "custom") {
      if (selectedCalendarDate && !calendarStartDate && !calendarEndDate) {
        const [y, m, d] = selectedCalendarDate.split("-").map(Number);
        const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        return time >= dayStart && time <= dayEnd;
      }
      let match = true;
      if (calendarStartDate) {
        const [y, m, d] = calendarStartDate.split("-").map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        if (time < start) match = false;
      }
      if (calendarEndDate) {
        const [y, m, d] = calendarEndDate.split("-").map(Number);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        if (time > end) match = false;
      }
      return match;
    }
    return true;
  };

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case "today": return "Aujourd'hui (24h)";
      case "yesterday": return "Hier";
      case "last7days": return "7 derniers jours";
      case "this_month": return "Ce mois";
      case "all": return "Tout l'historique";
      case "custom":
        if (selectedCalendarDate && !calendarStartDate && !calendarEndDate) {
          const [y, m, d] = selectedCalendarDate.split("-");
          return `Journée du ${d}/${m}/${y}`;
        }
        if (calendarStartDate && calendarEndDate) {
          const [y1, m1, d1] = calendarStartDate.split("-");
          const [y2, m2, d2] = calendarEndDate.split("-");
          return `Du ${d1}/${m1}/${y1} au ${d2}/${m2}/${y2}`;
        }
        if (calendarStartDate) {
          const [y, m, d] = calendarStartDate.split("-");
          return `Depuis le ${d}/${m}/${y}`;
        }
        if (calendarEndDate) {
          const [y, m, d] = calendarEndDate.split("-");
          return `Jusqu'au ${d}/${m}/${y}`;
        }
        return "Date du calendrier";
    }
  };

  // Calculations globales (Solde de Caisse)
  const totalSubscriptions = transactions
    .filter(t => t.type === "SUBSCRIPTION")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalOtherIncome = transactions
    .filter(t => t.type === "OTHER_INCOME")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAdminStoreSales = adminStoreSales.reduce((acc, s) => acc + s.amount, 0);

  const totalIncome = totalSubscriptions + totalOtherIncome + totalAdminStoreSales;
  const totalPayout = transactions
    .filter(t => t.type === "EXPENSE")
    .reduce((acc, t) => acc + t.amount, 0);

  const currentBalance = totalIncome - totalPayout;

  // Calculations filtrées par période (Défaut: 24h)
  const periodAdminSales = adminStoreSales.filter(s => isTxInPeriod(s, periodFilter));
  const periodTx = transactions.filter(t => isTxInPeriod(t, periodFilter));
  const periodSubscriptions = periodTx
    .filter(t => t.type === "SUBSCRIPTION")
    .reduce((acc, t) => acc + t.amount, 0);
  const periodOtherIncome = periodTx
    .filter(t => t.type === "OTHER_INCOME")
    .reduce((acc, t) => acc + t.amount, 0);
  const periodAdminSalesTotal = periodAdminSales.reduce((acc, s) => acc + s.amount, 0);
  const periodIncome = periodSubscriptions + periodOtherIncome + periodAdminSalesTotal;
  const periodPayout = periodTx
    .filter(t => t.type === "EXPENSE")
    .reduce((acc, t) => acc + t.amount, 0);

  // Volume global plateforme (au prix facturé aux clients)
  const periodPlatformVolume = allPlatformOrders
    .filter(o => isTxInPeriod(o, periodFilter))
    .reduce((acc, o) => acc + o.total, 0);

  // Settle supplier deposit (1-click action)
  const handleSettleSupplierDeposit = async (supplier: UserSupplier) => {
    const depositAmount = supplier.depositAmount || 50;
    if (!confirm(`Confirmez-vous l'encaissement du dépôt de $${depositAmount} pour le fournisseur ${supplier.displayName || supplier.email} ?\n\nCette action prolongera son abonnement de 30 jours, débloquera son compte et passera l'écriture comptable correspondante.`)) {
      return;
    }

    try {
      await recordSubscriptionDeposit({
        supplierId: supplier.id,
        supplierName: supplier.displayName || supplier.email || "Fournisseur",
        amount: depositAmount,
        paymentMethod: "Caisse centrale / Mobile Money",
        currentBalance
      });

      // Refresh local supplier list
      setSuppliers(prev => prev.map(s => {
        if (s.id === supplier.id) {
          const next = new Date();
          next.setDate(next.getDate() + 30);
          return {
            ...s,
            subscriptionStatus: "ACTIVE",
            subscriptionEndDate: next.toISOString(),
            isBlocked: false
          };
        }
        return s;
      }));

      setActionNotice(`Dépôt de $${depositAmount} encaissé avec succès pour ${supplier.displayName || supplier.email}. Compte actif et débloqué !`);
      setTimeout(() => setActionNotice(""), 6000);
    } catch (err: any) {
      console.error("Error settling deposit:", err);
      alert(err.message || "Erreur lors de l'encaissement du dépôt.");
    }
  };

  // Submit Cash Adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjAmount);
    if (isNaN(val) || val <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    const finalAmount = adjType === "ADD" ? val : -val;
    setIsSubmittingAdj(true);

    try {
      await recordCashAdjustment({
        amount: finalAmount,
        reason: adjReason,
        label: adjLabel,
        referencePiece: adjRef,
        actorType: "ADMIN",
        currentBalance
      });

      setIsAdjustmentModalOpen(false);
      setAdjAmount("");
      setAdjLabel("");
      setAdjRef("");
      setActionNotice(`Ajustement de caisse de ${finalAmount > 0 ? "+" : ""}$${finalAmount} enregistré avec succès dans le Grand Livre.`);
      setTimeout(() => setActionNotice(""), 6000);
    } catch (err: any) {
      console.error("Error saving cash adjustment:", err);
      alert(err.message || "Erreur lors de l'enregistrement de l'ajustement de caisse.");
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // Submit Standard Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }
    
    if (txType === "SUBSCRIPTION" && !selectedSupplierId) {
      alert("Veuillez sélectionner un fournisseur.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (txType === "SUBSCRIPTION") {
        const sup = suppliers.find(s => s.id === selectedSupplierId);
        await recordSubscriptionDeposit({
          supplierId: selectedSupplierId,
          supplierName: sup?.displayName || sup?.email || "Fournisseur",
          amount: parsedAmount,
          referencePiece: referenceId,
          currentBalance
        });
      } else {
        // Use recordCashAdjustment for EXPENSE or OTHER_INCOME to keep batch atomicity
        await recordCashAdjustment({
          amount: txType === "EXPENSE" ? -parsedAmount : parsedAmount,
          reason: txType === "EXPENSE" ? "Dépense de plateforme" : "Recette directe",
          label: description,
          referencePiece: referenceId || `MANUAL-${Math.floor(Math.random() * 1000000)}`,
          actorType: "ADMIN",
          currentBalance,
        });
      }

      setIsTxModalOpen(false);
      setAmount("");
      setDescription("");
      setReferenceId("");
      setSelectedSupplierId("");
      setActionNotice("Opération enregistrée avec succès.");
      setTimeout(() => setActionNotice(""), 5000);
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Erreur lors de l'ajout de la transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const downloadCSV = () => {
    const headers = ["Date", "N° Écriture", "Journal", "Réf Pièce", "Libellé", "Débit (+)", "Crédit (-)", "Solde"];
    const rows = ledgerEntries.map(e => [
      e.date?.toDate ? e.date.toDate().toLocaleDateString('fr-FR') : 'N/A',
      e.entryNumber || '-',
      e.journal || '-',
      e.referencePiece || '-',
      `"${(e.label || '').replace(/"/g, '""')}"`,
      e.debit ? `$${e.debit.toFixed(2)}` : '',
      e.credit ? `$${e.credit.toFixed(2)}` : '',
      e.balanceAfter ? `$${e.balanceAfter.toFixed(2)}` : ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(r => r.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `grand_livre_rayons_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Ledger (avec filtre de période temporelle)
  const filteredLedger = ledgerEntries.filter(entry => {
    if (!isTxInPeriod({ createdAt: entry.date }, periodFilter)) return false;
    if (journalFilter !== "ALL" && entry.journal !== journalFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchLabel = (entry.label || "").toLowerCase().includes(q);
      const matchRef = (entry.referencePiece || "").toLowerCase().includes(q);
      const matchNum = (entry.entryNumber || "").toLowerCase().includes(q);
      if (!matchLabel && !matchRef && !matchNum) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">Comptabilité Centrale</h1>
            <span className="px-2 py-0.5 bg-[#C7D300]/10 text-[#C7D300] border border-[#C7D300]/20 rounded-md text-[10px] font-bold uppercase tracking-widest">
              Officiel
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Grand Livre · Encaissements abonnements · Ventes directes Admin
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAdjustmentModalOpen(true)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/8 border border-white/10 text-gray-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
          >
            <Sliders size={14} />
            <span>Ajustement</span>
          </button>

          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/8 border border-white/10 text-gray-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
          >
            <Download size={14} />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={() => setIsTxModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] px-4 py-2 rounded-lg text-xs font-bold transition-all"
          >
            <Plus size={14} />
            <span>Nouvelle Écriture</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-[#C7D300]/8 border border-[#C7D300]/20 rounded-lg flex items-center gap-3 text-[#C7D300] text-xs font-semibold"
        >
          <CheckCircle size={16} className="shrink-0" />
          <span>{actionNotice}</span>
        </motion.div>
      )}

      {/* Période Comptable */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 text-gray-400 rounded-lg shrink-0">
            <Calendar size={16} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Période comptable</p>
            <h3 className="text-sm font-bold text-white mt-0.5">
              {getPeriodLabel()}
              {periodFilter === "today" && (
                <span className="ml-2 text-[10px] text-[#C7D300] font-bold">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C7D300] animate-pulse mr-1 align-middle"></span>
                  En direct
                </span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={selectedCalendarDate}
            onChange={(e) => {
              setSelectedCalendarDate(e.target.value);
              setCalendarStartDate("");
              setCalendarEndDate("");
              setPeriodFilter("custom");
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300] cursor-pointer"
          />

          {periodFilter === "custom" ? (
            <button
              type="button"
              onClick={() => { setPeriodFilter("today"); setSelectedCalendarDate(""); setCalendarStartDate(""); setCalendarEndDate(""); setShowRangePicker(false); }}
              className="text-xs bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              Aujourd&apos;hui
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPeriodFilter("today")}
              className="text-xs border border-white/10 text-gray-400 font-semibold px-3 py-1.5 rounded-lg hover:text-white transition-all"
            >
              Aujourd&apos;hui
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRangePicker(!showRangePicker)}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 transition-colors"
          >
            {showRangePicker ? "▾ Plage" : "▸ Plage"}
          </button>
        </div>

        {showRangePicker && (
          <div className="w-full pt-3 border-t border-white/8 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-gray-500 font-semibold">Plage :</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Du</span>
              <input type="date" value={calendarStartDate} onChange={(e) => { setCalendarStartDate(e.target.value); setSelectedCalendarDate(""); setPeriodFilter("custom"); }} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Au</span>
              <input type="date" value={calendarEndDate} onChange={(e) => { setCalendarEndDate(e.target.value); setSelectedCalendarDate(""); setPeriodFilter("custom"); }} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]" />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards — palette monochrome */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "Caisse Nette", value: `$${currentBalance.toFixed(2)}`, sub: "Solde consolidé", icon: <Wallet size={14} />, accent: currentBalance >= 0 },
          { label: "Revenus", value: `$${periodIncome.toFixed(2)}`, sub: getPeriodLabel(), icon: <ArrowDownRight size={14} />, accent: false },
          { label: "Dépenses", value: `$${periodPayout.toFixed(2)}`, sub: "Charges & sorties", icon: <ArrowUpRight size={14} />, accent: false, negative: true },
          { label: "Ventes Admin", value: `$${periodAdminSalesTotal.toFixed(2)}`, sub: "Boutique officielle", icon: <ShoppingBag size={14} />, accent: false },
          { label: "Vol. Plateforme", value: `$${periodPlatformVolume.toFixed(2)}`, sub: "Commandes livrées", icon: <TrendingUp size={14} />, accent: false },
          { label: "Abonnements", value: `$${periodSubscriptions.toFixed(2)}`, sub: "Dépôts fournisseurs", icon: <ArrowDownRight size={14} />, accent: true },
        ].map((kpi, i) => (
          <div key={i} className="bg-white/3 border border-white/8 rounded-xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider leading-tight">{kpi.label}</p>
              <span className={`p-1 sm:p-1.5 rounded-md ${kpi.accent ? "bg-[#C7D300]/10 text-[#C7D300]" : "bg-white/5 text-gray-500"}`}>
                {kpi.icon}
              </span>
            </div>
            <p className={`text-base sm:text-xl font-black tabular-nums ${kpi.negative ? "text-red-400" : kpi.accent ? "text-[#C7D300]" : "text-white"}`}>
              {kpi.value}
            </p>
            <p className="text-[10px] text-gray-600 truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto scrollbar-none whitespace-nowrap">
        {[
          { id: "ledger", label: `Grand Livre (${filteredLedger.length})`, icon: <FileText size={13} /> },
          { id: "deposits", label: `Échéancier Fournisseurs (${suppliers.length})`, icon: <Clock size={13} /> },
          { id: "overview", label: "Livre de Caisse", icon: <Wallet size={13} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? "border-[#C7D300] text-[#C7D300]"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: GRAND LIVRE */}
      {activeTab === "ledger" && (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                { code: "ALL", label: "Tous" },
                { code: "VT", label: "VT · Ventes" },
                { code: "AB", label: "AB · Abonnements" },
                { code: "AJ", label: "AJ · Ajustements" },
                { code: "CS", label: "CS · Caisse" },
                { code: "BQ", label: "BQ · Banque" },
              ].map(j => (
                <button
                  key={j.code}
                  onClick={() => setJournalFilter(j.code)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    journalFilter === j.code
                      ? "bg-[#C7D300] text-[#0F1D27]"
                      : "bg-white/5 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
              <input
                type="text"
                placeholder="Libellé ou référence..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-white/5 border border-white/8 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 text-white text-[11px] placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Desktop Table (Hidden on mobile < md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-white/8">
                  {["N° Écriture", "Date", "Journal", "Réf. Pièce", "Libellé", "Débit", "Crédit", "Solde"].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider text-left last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <p className="text-sm font-semibold text-gray-400">Aucune écriture pour {getPeriodLabel()}</p>
                      <p className="text-xs text-gray-600 mt-1">Modifiez la période ou le filtre journal pour afficher l&apos;historique.</p>
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => (
                    <tr key={entry.id || entry.entryNumber} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-300 font-semibold">{entry.entryNumber}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-500">
                        {entry.date?.toDate ? entry.date.toDate().toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] font-black text-gray-300 bg-white/6 px-2 py-0.5 rounded">
                          {entry.journal}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{entry.referencePiece || "—"}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-300 max-w-xs truncate" title={entry.label}>{entry.label}</td>
                      <td className="px-4 py-3 text-right text-[11px] font-bold text-[#C7D300]">
                        {entry.debit > 0 ? `+$${entry.debit.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] font-bold text-red-400">
                        {entry.credit > 0 ? `-$${entry.credit.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] font-semibold text-gray-300">
                        {entry.balanceAfter !== undefined ? `$${entry.balanceAfter.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Ledger Cards (< md) */}
          <div className="md:hidden divide-y divide-white/5">
            {filteredLedger.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Aucune écriture pour {getPeriodLabel()}
              </div>
            ) : (
              filteredLedger.map((entry) => (
                <div key={entry.id || entry.entryNumber} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-300 font-bold">{entry.entryNumber}</span>
                      <span className="font-mono text-[9px] font-black text-gray-300 bg-white/10 px-1.5 py-0.5 rounded">
                        {entry.journal}
                      </span>
                    </div>
                    <span className="text-gray-500 text-[10px]">
                      {entry.date?.toDate ? entry.date.toDate().toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-white font-medium line-clamp-2">{entry.label}</p>
                    {entry.referencePiece && (
                      <p className="font-mono text-[10px] text-gray-500 mt-0.5">Réf: {entry.referencePiece}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                    <div>
                      {entry.debit > 0 ? (
                        <span className="font-bold text-[#C7D300]">+$${entry.debit.toFixed(2)}</span>
                      ) : entry.credit > 0 ? (
                        <span className="font-bold text-red-400">-$${entry.credit.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 mr-1.5">Solde</span>
                      <span className="font-semibold text-gray-300">
                        {entry.balanceAfter !== undefined ? `$${entry.balanceAfter.toFixed(2)}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ÉCHÉANCIER FOURNISSEURS */}
      {activeTab === "deposits" && (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-white/8 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Échéancier & Dépôts Fournisseurs</h2>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">Essai 15j · Dépôt mensuel $50 · Blocage automatique en cas d&apos;impayé</p>
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-1 bg-white/5 text-gray-400 rounded-lg shrink-0">
              {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Desktop Table (Hidden on mobile < md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr className="border-b border-white/8">
                  {["Fournisseur", "Rayon", "Cycle", "Échéance", "Dépôt", "Statut", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-600">Aucun fournisseur inscrit.</td>
                  </tr>
                ) : (
                  suppliers.map((s) => {
                    const isOfficial = isOfficialAdminSupplier(s);
                    const subInfo = evaluateSupplierSubscription(s);
                    const depositAmount = s.depositAmount || 50;

                    return (
                      <tr key={s.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-[11px] font-semibold text-white">{s.displayName || s.company || "Partenaire"}</p>
                          <p className="text-[10px] text-gray-600">{s.email}</p>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          {s.rayon || "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-400">
                          {isOfficial ? "Admin (Exempté)" : subInfo.isTrial ? `Essai (${subInfo.daysLeft}j)` : "Mensuel"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-400">
                          {isOfficial ? "—" : subInfo.formattedDueDate}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-gray-300">
                          {isOfficial ? "$0" : `$${depositAmount}/mois`}
                        </td>
                        <td className="px-4 py-3">
                          {isOfficial ? (
                            <span className="text-[10px] font-bold text-[#C7D300] bg-[#C7D300]/8 px-2 py-0.5 rounded">Boutique Admin</span>
                          ) : subInfo.isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-400/8 px-2 py-0.5 rounded">
                              <Lock size={10} /> Bloqué
                            </span>
                          ) : subInfo.isTrial ? (
                            <span className="text-[10px] font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded">En essai</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#C7D300] bg-[#C7D300]/8 px-2 py-0.5 rounded">
                              <CheckCircle size={10} /> À jour
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isOfficial ? (
                            <span className="text-[10px] text-gray-600 italic">N/A</span>
                          ) : (
                            <button
                              onClick={() => handleSettleSupplierDeposit(s)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              <ArrowDownRight size={12} />
                              Encaisser ${depositAmount}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Supplier Deposit Cards (< md) */}
          <div className="md:hidden divide-y divide-white/5">
            {suppliers.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">Aucun fournisseur inscrit.</div>
            ) : (
              suppliers.map((s) => {
                const isOfficial = isOfficialAdminSupplier(s);
                const subInfo = evaluateSupplierSubscription(s);
                const depositAmount = s.depositAmount || 50;

                return (
                  <div key={s.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{s.displayName || s.company || "Partenaire"}</h4>
                        <p className="text-[10px] text-gray-500 truncate max-w-[180px]">{s.email}</p>
                      </div>
                      {isOfficial ? (
                        <span className="text-[9px] font-bold text-[#C7D300] bg-[#C7D300]/10 px-2 py-0.5 rounded">Boutique Admin</span>
                      ) : subInfo.isBlocked ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                          <Lock size={10} /> Bloqué
                        </span>
                      ) : subInfo.isTrial ? (
                        <span className="text-[9px] font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded">En essai ({subInfo.daysLeft}j)</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#C7D300] bg-[#C7D300]/10 px-2 py-0.5 rounded">
                          <CheckCircle size={10} /> À jour
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Rayon: <strong className="text-gray-300 uppercase">{s.rayon || "—"}</strong></span>
                      <span>Échéance: <strong className="text-gray-300">{isOfficial ? "—" : subInfo.formattedDueDate}</strong></span>
                    </div>

                    {!isOfficial && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-xs font-semibold text-gray-300">${depositAmount}/mois</span>
                        <button
                          onClick={() => handleSettleSupplierDeposit(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-lg font-bold text-xs transition-colors cursor-pointer active:scale-95"
                        >
                          <ArrowDownRight size={13} />
                          <span>Encaisser ${depositAmount}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LIVRE DE CAISSE */}
      {activeTab === "overview" && (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/8">
            <h2 className="text-sm font-bold text-white">Livre de Caisse</h2>
            <p className="text-[11px] text-gray-600 mt-0.5">Historique brut des encaissements et décaissements.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-white/8">
                  {["Date", "Type", "Description", "Référence", "Montant"].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-600">Aucune transaction.</td></tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-gray-500">
                        {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          t.type === "EXPENSE" ? "text-red-400 bg-red-400/8" : "text-[#C7D300] bg-[#C7D300]/8"
                        }`}>
                          {t.type === "SUBSCRIPTION" ? "Abonnement" : t.type === "OTHER_INCOME" ? "Recette" : "Dépense"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-300 max-w-xs truncate">{t.description}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{t.referenceId || "—"}</td>
                      <td className={`px-4 py-3 text-right text-[11px] font-bold ${
                        t.type === "EXPENSE" ? "text-red-400" : "text-[#C7D300]"
                      }`}>
                        {t.type === "EXPENSE" ? "-" : "+"}${t.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: AJUSTEMENT DE CAISSE */}
      <AnimatePresence>
        {isAdjustmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-lg bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="text-[#C7D300]" size={15} />
                    Ajustement de Caisse
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Solde actuel : <span className="text-white font-semibold">${currentBalance.toFixed(2)}</span></p>
                </div>
                <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-2 uppercase tracking-wider">Sens</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAdjType("ADD")}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all border ${
                        adjType === "ADD"
                          ? "bg-[#C7D300]/10 text-[#C7D300] border-[#C7D300]/30"
                          : "bg-white/4 text-gray-500 border-white/8 hover:border-white/15"
                      }`}>
                      + Entrée / Apport
                    </button>
                    <button type="button" onClick={() => setAdjType("SUBTRACT")}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all border ${
                        adjType === "SUBTRACT"
                          ? "bg-red-400/10 text-red-400 border-red-400/25"
                          : "bg-white/4 text-gray-500 border-white/8 hover:border-white/15"
                      }`}>
                      - Sortie / Prélèvement
                    </button>
                  </div>
                </div>

                {[{ label: "Montant (USD) *", value: adjAmount, setter: setAdjAmount, type: "number", placeholder: "50.00", min: "0.01", step: "0.01" }].map(f => (
                  <div key={f.label}>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">{f.label}</label>
                    <input type={f.type} step={f.step} min={f.min} required value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600" />
                  </div>
                ))}

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Motif *</label>
                  <select value={adjReason} onChange={e => setAdjReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50">
                    {ADJUSTMENT_REASONS.map(r => <option key={r} value={r} className="bg-[#0F1D27]">{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Libellé précis *</label>
                  <input type="text" required value={adjLabel} onChange={e => setAdjLabel(e.target.value)} placeholder="ex: Régularisation inventaire du coffre"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600" />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">N° Pièce justificative</label>
                  <input type="text" value={adjRef} onChange={e => setAdjRef(e.target.value)} placeholder="ex: REC-INV-2026-01"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600" />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsAdjustmentModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors">Annuler</button>
                  <button type="submit" disabled={isSubmittingAdj}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    {isSubmittingAdj ? "Enregistrement..." : "Valider l'Ajustement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: NOUVELLE ÉCRITURE */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                <h2 className="text-sm font-bold text-white">Nouvelle Écriture Comptable</h2>
                <button onClick={() => setIsTxModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Type d&apos;opération</label>
                  <select value={txType} onChange={(e: any) => setTxType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50">
                    <option value="SUBSCRIPTION" className="bg-[#0F1D27]">Encaissement Abonnement Fournisseur ($50)</option>
                    <option value="OTHER_INCOME" className="bg-[#0F1D27]">Vente Directe / Autre Recette Admin</option>
                    <option value="EXPENSE" className="bg-[#0F1D27]">Dépense de Plateforme</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="50.00"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600" />
                </div>

                {txType === "SUBSCRIPTION" ? (
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Fournisseur *</label>
                    <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} required
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50">
                      <option value="">Sélectionnez un fournisseur</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#0F1D27]">{s.displayName || s.company || s.email}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Libellé *</label>
                    <input type="text" required value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Achat serveurs, vente directe..."
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600" />
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Référence pièce</label>
                  <input type="text" value={referenceId} onChange={e => setReferenceId(e.target.value)} placeholder="ex: FAC-ADMIN-01"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600" />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsTxModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors">Annuler</button>
                  <button type="submit" disabled={isSubmitting}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    {isSubmitting ? "Enregistrement..." : "Valider l'Écriture"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
