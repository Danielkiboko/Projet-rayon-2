"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search, 
  FileText, ShieldAlert, CheckCircle, Clock, AlertTriangle, Sliders, RefreshCw, Lock,
  Calendar, TrendingUp, Landmark, ShoppingBag
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  serverTimestamp, doc, updateDoc, getDocs, limit 
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { fetchSuppliersAction } from "./actions";
import { hasAdminAccess, canAccessFinance } from "@/lib/permissions";
import { 
  AccountingEntry, 
  ADJUSTMENT_REASONS, 
  recordCashAdjustment, 
  recordSubscriptionDeposit 
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
            item.supplierId === "admin" ||
            item.supplierEmail === "danielkiboko218@gmail.com"
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
        const txRefId = referenceId || `MANUAL-${Math.floor(Math.random() * 1000000)}`;
        await addDoc(collection(db, "transactions"), {
          type: txType,
          amount: parsedAmount,
          currency: "USD",
          description,
          referenceId: txRefId,
          status: "COMPLETED",
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });

        await addDoc(collection(db, "accounting_ledger"), {
          entryNumber: `ECR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          date: serverTimestamp(),
          journal: txType === "EXPENSE" ? "CS" : "VT",
          journalName: txType === "EXPENSE" ? "Journal de Caisse (Dépense)" : "Journal des Ventes & Recettes",
          referencePiece: txRefId,
          label: description,
          debit: txType === "OTHER_INCOME" ? parsedAmount : 0,
          credit: txType === "EXPENSE" ? parsedAmount : 0,
          balanceAfter: txType === "EXPENSE" ? currentBalance - parsedAmount : currentBalance + parsedAmount,
          currency: "USD",
          actorType: "ADMIN",
          category: txType,
          status: "VALIDATED"
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
      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Comptabilité Centrale & Livre de Caisse</h1>
            <span className="px-2.5 py-0.5 bg-[#C7D300]/10 text-[#C7D300] border border-[#C7D300]/30 rounded-full text-xs font-bold">
              Officiel Rayons.net
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Grand Livre des écritures, encaissement des abonnements fournisseurs et ventes directes Admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsAdjustmentModalOpen(true)}
            className="flex items-center space-x-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Sliders size={16} />
            <span>Ajustement de Caisse</span>
          </button>

          <button 
            onClick={downloadCSV}
            className="flex items-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <Download size={16} />
            <span>Exporter Grand Livre</span>
          </button>

          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="flex items-center space-x-1.5 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20"
          >
            <Plus size={16} />
            <span>Nouvelle Écriture</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-sm font-semibold shadow-lg shadow-emerald-950/20"
        >
          <CheckCircle size={20} className="text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </motion.div>
      )}

      {/* Sélecteur de Période Comptable Centrale : Calendrier interactif & Raccourcis */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C7D300]/20 text-[#C7D300] rounded-xl shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">
                  Période Comptable : <span className="text-[#C7D300]">{getPeriodLabel()}</span>
                </h3>
                {periodFilter === "today" && (
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Journalier (24h)
                  </span>
                )}
                {periodFilter === "custom" && (
                  <span className="text-[11px] bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    📅 Date Calendrier active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {periodFilter === "today" 
                  ? "Affichage des écritures des dernières 24h. Vous pouvez sélectionner n'importe quelle date au calendrier ci-dessous."
                  : periodFilter === "custom"
                  ? `Comptabilité filtrée sur votre sélection du calendrier : ${getPeriodLabel()}.`
                  : `Comptabilité filtrée pour la période : ${getPeriodLabel()}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-black/30 border border-white/10 rounded-xl">
            <button
              onClick={() => {
                setPeriodFilter("today");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                periodFilter === "today"
                  ? "bg-[#C7D300] text-gray-950 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>⚡ Aujourd'hui (24h)</span>
            </button>
            <button
              onClick={() => {
                setPeriodFilter("yesterday");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                periodFilter === "yesterday"
                  ? "bg-white text-gray-950 shadow-sm font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Hier
            </button>
            <button
              onClick={() => {
                setPeriodFilter("last7days");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                periodFilter === "last7days"
                  ? "bg-white text-gray-950 shadow-sm font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              7 derniers jours
            </button>
            <button
              onClick={() => {
                setPeriodFilter("this_month");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                periodFilter === "this_month"
                  ? "bg-white text-gray-950 shadow-sm font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Ce mois
            </button>
            <button
              onClick={() => {
                setPeriodFilter("all");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                periodFilter === "all"
                  ? "bg-white text-gray-950 shadow-sm font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>📚 Tout l'historique</span>
            </button>
          </div>
        </div>

        {/* Bloc Calendrier Interactif */}
        <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5">
              <span className="text-gray-300 font-medium flex items-center gap-1.5">
                <Calendar size={14} className="text-[#C7D300]" />
                <span>Sélectionner une date précise au calendrier :</span>
              </span>
              <input
                type="date"
                value={selectedCalendarDate}
                onChange={(e) => {
                  setSelectedCalendarDate(e.target.value);
                  setCalendarStartDate("");
                  setCalendarEndDate("");
                  setPeriodFilter("custom");
                }}
                className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300] cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowRangePicker(!showRangePicker)}
              className="text-[#C7D300] hover:underline text-xs font-medium cursor-pointer flex items-center gap-1"
            >
              <span>{showRangePicker ? "▾ Masquer la plage" : "▸ Ou filtrer par plage personnalisée (Du ... Au ...)"}</span>
            </button>
          </div>

          {periodFilter === "custom" && (
            <button
              type="button"
              onClick={() => {
                setPeriodFilter("today");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
                setShowRangePicker(false);
              }}
              className="text-xs bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              ✕ Revenir à Aujourd'hui (24h)
            </button>
          )}
        </div>

        {/* Plage personnalisée dépliable */}
        {showRangePicker && (
          <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-fade-in">
            <span className="text-gray-400 font-semibold">Période personnalisée :</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Du :</span>
              <input
                type="date"
                value={calendarStartDate}
                onChange={(e) => {
                  setCalendarStartDate(e.target.value);
                  setSelectedCalendarDate("");
                  setPeriodFilter("custom");
                }}
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300] cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Au :</span>
              <input
                type="date"
                value={calendarEndDate}
                onChange={(e) => {
                  setCalendarEndDate(e.target.value);
                  setSelectedCalendarDate("");
                  setPeriodFilter("custom");
                }}
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Financial Overview Cards (6 Cards confidentielles : pas de marges fournisseurs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Solde de Caisse Consolidé */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Caisse Centrale</h3>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white mt-3">${currentBalance.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Solde net disponible</span>
        </div>

        {/* 2. Revenus Réalisés Période */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Revenus ({getPeriodLabel()})</h3>
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-green-400 mt-3">${periodIncome.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Entrées de la période</span>
        </div>

        {/* 3. Dépenses Période */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Dépenses ({getPeriodLabel()})</h3>
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-red-400 mt-3">${periodPayout.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Charges & sorties</span>
        </div>

        {/* 4. Ventes Directes Rayons */}
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">Ventes Directes Rayons</h3>
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <ShoppingBag size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-indigo-400 mt-3">${periodAdminSalesTotal.toFixed(2)}</p>
          <span className="text-[11px] text-indigo-300/80 mt-1 block">Boutique officielle Rayons</span>
        </div>

        {/* 5. Volume Global des Ventes Plateforme */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Volume Global Ventes</h3>
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-3">${periodPlatformVolume.toFixed(2)}</p>
          <span className="text-[11px] text-emerald-300/80 mt-1 block">Commandes livrées ({getPeriodLabel()})</span>
        </div>

        {/* 6. Abonnements Fournisseurs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Abonnements ($50)</h3>
            <div className="p-2 bg-[#C7D300]/20 rounded-lg text-[#C7D300]">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#C7D300] mt-3">${periodSubscriptions.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Dépôts mensuels reçus</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-white/10 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "ledger" 
              ? "border-[#C7D300] text-[#C7D300]" 
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <FileText size={16} />
          Grand Livre des Écritures ({filteredLedger.length})
        </button>

        <button
          onClick={() => setActiveTab("deposits")}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "deposits" 
              ? "border-[#C7D300] text-[#C7D300]" 
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <Clock size={16} />
          Échéancier Fournisseurs & Dépôts Attendus ({suppliers.length})
        </button>

        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "overview" 
              ? "border-[#C7D300] text-[#C7D300]" 
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <Wallet size={16} />
          Livre de Caisse Simplifié
        </button>
      </div>

      {/* TAB 1: GRAND LIVRE DES ÉCRITURES COMPTABLES */}
      {activeTab === "ledger" && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { code: "ALL", label: "Tous les Journaux" },
                { code: "VT", label: "VT • Ventes" },
                { code: "AB", label: "AB • Abonnements" },
                { code: "AJ", label: "AJ • Ajustements Caisse" },
                { code: "CS", label: "CS • Caisse" },
                { code: "BQ", label: "BQ • Banque / Mobile Money" }
              ].map(j => (
                <button
                  key={j.code}
                  onClick={() => setJournalFilter(j.code)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    journalFilter === j.code 
                      ? "bg-[#C7D300] text-[#0F1D27] shadow-sm" 
                      : "bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher par libellé ou réf..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C7D300] text-white text-xs"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="text-[11px] uppercase bg-black/30 text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">N° Écriture</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Code Journal</th>
                  <th className="px-5 py-3.5">Pièce Justificative</th>
                  <th className="px-5 py-3.5">Libellé Comptable</th>
                  <th className="px-5 py-3.5 text-right">Débit (+)</th>
                  <th className="px-5 py-3.5 text-right">Crédit (-)</th>
                  <th className="px-5 py-3.5 text-right">Solde Caisse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                      <p className="font-semibold text-white">Aucune écriture comptable pour : {getPeriodLabel()}</p>
                      {periodFilter === "today" ? (
                        <p className="text-xs text-gray-400 mt-1">
                          Les écritures de plus de 24h sont automatiquement archivées dans l'historique.<br />
                          Pour les consulter, sélectionnez <strong className="text-white">"Hier"</strong>, <strong className="text-white">"7 derniers jours"</strong> ou <strong className="text-white">"Tout l'historique"</strong> ci-dessus.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">
                          Aucune écriture ne correspond à cette période ou au journal sélectionné.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => (
                    <tr key={entry.id || entry.entryNumber} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-white font-bold">
                        {entry.entryNumber}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {entry.date?.toDate ? entry.date.toDate().toLocaleDateString('fr-FR') : "Date récente"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                          entry.journal === "AB" ? "bg-emerald-500/20 text-emerald-300" :
                          entry.journal === "VT" ? "bg-cyan-500/20 text-cyan-300" :
                          entry.journal === "AJ" ? "bg-amber-500/20 text-amber-300" :
                          "bg-purple-500/20 text-purple-300"
                        }`}>
                          {entry.journal}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 font-mono">
                        {entry.referencePiece || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-white font-medium max-w-xs truncate" title={entry.label}>
                        {entry.label}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-400">
                        {entry.debit > 0 ? `+$${entry.debit.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-red-400">
                        {entry.credit > 0 ? `-$${entry.credit.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-white">
                        {entry.balanceAfter !== undefined ? `$${entry.balanceAfter.toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ÉCHÉANCIER FOURNISSEURS & DÉPÔTS ATTENDUS */}
      {activeTab === "deposits" && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Échéancier & Dépôts Attendus des Fournisseurs</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Règle : 15 jours d'essai offerts. Si l'échéance mensuelle ($50) est dépassée, le fournisseur est bloqué de publication et messagerie.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-white/5 text-gray-300 rounded-lg">
              {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} enregistré{suppliers.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="text-[11px] uppercase bg-black/30 text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Fournisseur</th>
                  <th className="px-5 py-3.5">Rayon</th>
                  <th className="px-5 py-3.5">Cycle Actuel</th>
                  <th className="px-5 py-3.5">Échéance Dépôt</th>
                  <th className="px-5 py-3.5">Dépôt Attendu</th>
                  <th className="px-5 py-3.5">Statut Plateforme</th>
                  <th className="px-5 py-3.5 text-right">Actions Comptables</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                      Aucun fournisseur inscrit pour le moment.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => {
                    const isOfficialStore = Boolean(s.isOfficialAdminStore || s.isAdminSupplier || s.email === "danielkiboko218@gmail.com");
                    const subInfo = evaluateSupplierSubscription(s);
                    const depositAmount = s.depositAmount || 50;

                    return (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{s.displayName || s.company || "Partenaire"}</span>
                            {isOfficialStore && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                👑 Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400">{s.email}</div>
                        </td>
                        <td className="px-5 py-3.5 uppercase font-bold text-gray-300">
                          {s.rayon || "Mode / Connect"}
                        </td>
                        <td className="px-5 py-3.5">
                          {isOfficialStore ? (
                            <span className="inline-flex items-center text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                              👑 Boutique Officielle Admin
                            </span>
                          ) : subInfo.isTrial ? (
                            <span className="inline-flex items-center text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                              Essai 15 jours ({subInfo.daysLeft}j restants)
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-gray-300 bg-white/5 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                              Abonnement Mensuel
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-300">
                          {isOfficialStore ? "Illimitée (Exempté)" : subInfo.formattedDueDate}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white">
                          {isOfficialStore ? "$0 (Exempté)" : `$${depositAmount} / mois`}
                        </td>
                        <td className="px-5 py-3.5">
                          {isOfficialStore ? (
                            <span className="inline-flex items-center text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                              <CheckCircle size={12} className="mr-1" /> Boutique Active
                            </span>
                          ) : subInfo.isBlocked ? (
                            <span className="inline-flex items-center text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                              <Lock size={12} className="mr-1" /> Bloqué (Impayé)
                            </span>
                          ) : subInfo.isTrial ? (
                            <span className="inline-flex items-center text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                              Actif (En essai)
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                              <CheckCircle size={12} className="mr-1" /> À jour
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isOfficialStore ? (
                            <span className="text-xs text-amber-400 font-medium italic">
                              Recettes liées à l'Admin
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSettleSupplierDeposit(s)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-lg font-bold text-xs transition-colors shadow-sm"
                              title="Encaisser le dépôt de 50$, débloquer le compte et passer l'écriture comptable AB"
                            >
                              <ArrowDownRight size={14} />
                              Encaisser Dépôt ($50)
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
        </div>
      )}

      {/* TAB 3: LIVRE DE CAISSE SIMPLIFIÉ (HISTORIQUE DES TRANSACTIONS) */}
      {activeTab === "overview" && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-base font-bold text-white">Transactions Comptables de Caisse</h2>
            <p className="text-xs text-gray-400 mt-0.5">Historique brut des encaissements et décaissements.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="text-[11px] uppercase bg-black/30 text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Nature</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Réf Pièce</th>
                  <th className="px-5 py-3.5 text-right">Montant (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Aucune transaction trouvée.</td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 text-gray-400">
                        {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                      <td className="px-5 py-3.5">
                        {t.type === "SUBSCRIPTION" && <span className="inline-flex items-center text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[10px] font-bold"><ArrowDownRight size={11} className="mr-1"/> Abonnement Fournisseur</span>}
                        {t.type === "OTHER_INCOME" && <span className="inline-flex items-center text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded text-[10px] font-bold"><ArrowDownRight size={11} className="mr-1"/> Vente Produit Admin</span>}
                        {t.type === "EXPENSE" && <span className="inline-flex items-center text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-[10px] font-bold"><ArrowUpRight size={11} className="mr-1"/> Dépense</span>}
                      </td>
                      <td className="px-5 py-3.5 text-white font-medium">{t.description}</td>
                      <td className="px-5 py-3.5 text-gray-400 font-mono">{t.referenceId || "-"}</td>
                      <td className={`px-5 py-3.5 text-right font-bold ${t.type === 'SUBSCRIPTION' || t.type === 'OTHER_INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.type === 'SUBSCRIPTION' || t.type === 'OTHER_INCOME' ? '+' : '-'}${t.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: AJUSTEMENT DE CAISSE FORMEL */}
      <AnimatePresence>
        {isAdjustmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders className="text-[#C7D300]" size={18} />
                    Ajustement de Caisse
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Solde actuel avant ajustement : <strong>${currentBalance.toFixed(2)}</strong>
                  </p>
                </div>
                <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1.5">Sens de l'ajustement</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjType("ADD")}
                      className={`py-2.5 rounded-xl font-bold transition-all border ${
                        adjType === "ADD" 
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm" 
                          : "bg-white/5 text-gray-400 border-white/10"
                      }`}
                    >
                      + Entrée / Apport Caisse
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjType("SUBTRACT")}
                      className={`py-2.5 rounded-xl font-bold transition-all border ${
                        adjType === "SUBTRACT" 
                          ? "bg-red-500/20 text-red-300 border-red-500/40 shadow-sm" 
                          : "bg-white/5 text-gray-400 border-white/10"
                      }`}
                    >
                      - Sortie / Prélèvement Caisse
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Montant ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="ex: 50.00"
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Motif comptable obligatoire *</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  >
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#0F1D27] text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Libellé précis de l'opération *</label>
                  <input
                    type="text"
                    required
                    value={adjLabel}
                    onChange={(e) => setAdjLabel(e.target.value)}
                    placeholder="ex: Régularisation suite à inventaire physique du coffre"
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Numéro de pièce / Justificatif (Optionnel)</label>
                  <input
                    type="text"
                    value={adjRef}
                    onChange={(e) => setAdjRef(e.target.value)}
                    placeholder="ex: REC-INV-2026-01"
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdj}
                    className="px-5 py-2.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {isSubmittingAdj ? "Enregistrement..." : "Valider l'Écriture d'Ajustement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: AJOUTER TRANSACTION / ÉCRITURE */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-lg font-bold text-white">Nouvelle Écriture Comptable</h2>
                <button onClick={() => setIsTxModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Type d'opération</label>
                  <select 
                    value={txType}
                    onChange={(e: any) => setTxType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  >
                    <option value="SUBSCRIPTION" className="bg-[#0F1D27]">Encaissement Abonnement Fournisseur ($50)</option>
                    <option value="OTHER_INCOME" className="bg-[#0F1D27]">Vente Directe Produit Admin / Autre Recette</option>
                    <option value="EXPENSE" className="bg-[#0F1D27]">Dépense de Plateforme</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Montant ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                    placeholder="ex: 50.00"
                  />
                </div>

                {txType === "SUBSCRIPTION" ? (
                  <div>
                    <label className="text-gray-300 font-semibold block mb-1">Fournisseur concerné *</label>
                    <select 
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                    >
                      <option value="">Sélectionnez un fournisseur</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#0F1D27]">
                          {s.displayName || s.company || s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-300 font-semibold block mb-1">Description / Libellé *</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                      placeholder="ex: Vente directe stock Admin ou Achat serveurs"
                    />
                  </div>
                )}
                
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Référence Pièce Justificative (Optionnel)</label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                    placeholder="ex: FAC-ADMIN-01"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTxModalOpen(false)}
                    className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  >
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
