"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search,
  FileText, CheckCircle, Clock, Sliders, Lock,
  TrendingUp, ShoppingBag, Award, ShieldAlert, Sparkles, Coins, Check,
  RefreshCw, Send, AlertTriangle
} from "lucide-react";
import { useDatePeriodFilter } from "@/hooks/useDatePeriodFilter";
import DateRangeFilterPills from "@/modules/shared/components/finance/DateRangeFilterPills";
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
  const [activeTab, setActiveTab] = useState<"ledger" | "deposits" | "commissions" | "settings" | "overview">("ledger");

  // State data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<AccountingEntry[]>([]);
  const [suppliers, setSuppliers] = useState<UserSupplier[]>([]);
  const [adminStoreSales, setAdminStoreSales] = useState<any[]>([]);
  const [allPlatformOrders, setAllPlatformOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [journalFilter, setJournalFilter] = useState<string>("ALL");
  const dateFilter = useDatePeriodFilter("today");
  const { periodFilter, isItemInPeriod: isTxInPeriod, getPeriodLabel } = dateFilter;
  const [search, setSearch] = useState("");

  // Supplier recovery filters
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<"ALL" | "OVERDUE" | "TRIAL" | "ACTIVE" | "OFFICIAL">("ALL");
  const [supplierRayonFilter, setSupplierRayonFilter] = useState<string>("ALL");
  const [supplierSearch, setSupplierSearch] = useState<string>("");

  // Partenaires & Commissions
  const [partners, setPartners] = useState<any[]>([]);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionReason, setCommissionReason] = useState("");
  const [isSubmittingCommission, setIsSubmittingCommission] = useState(false);

  // Paramètres financiers & Double Approbation (Four-Eyes Principle)
  const [financialSettings, setFinancialSettings] = useState<any>(null);
  const [pendingProposal, setPendingProposal] = useState<any>(null);
  const [financialHistory, setFinancialHistory] = useState<any[]>([]);
  const [loadingFinancialSettings, setLoadingFinancialSettings] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Proposal form fields
  const [formUsdRate, setFormUsdRate] = useState("2850");
  const [formCommission, setFormCommission] = useState("5");
  const [formSubscription, setFormSubscription] = useState("50");
  const [formPromo, setFormPromo] = useState("10");
  const [formReason, setFormReason] = useState("");

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

  const isSuperAdmin = Boolean(
    userData?.role === "SUPER_ADMIN" ||
    (userData as any)?.claims?.superAdmin ||
    (Array.isArray(userData?.staffProfile?.positions) &&
      userData.staffProfile.positions.includes("DIRECTEUR_GENERAL"))
  );

  const fetchFinancialSettings = async () => {
    try {
      setLoadingFinancialSettings(true);
      const res = await fetch("/api/admin/financial-settings");
      const json = await res.json();
      if (json.success) {
        setFinancialSettings(json.settings);
        setPendingProposal(json.pendingProposal);
        setFinancialHistory(json.history || []);
        if (json.settings) {
          setFormUsdRate(String(json.settings.usdToFcRate || 2850));
          setFormCommission(String(json.settings.referralCommissionUSD || 5));
          setFormSubscription(String(json.settings.monthlySubscriptionPrice || 50));
          setFormPromo(String(json.settings.promoDiscountUSD || 10));
        }
      }
    } catch (e) {
      console.error("Error loading financial settings:", e);
    } finally {
      setLoadingFinancialSettings(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const res = await fetch("/api/admin/commissions");
      const json = await res.json();
      if (json.success) {
        setPartners(json.partners || []);
      }
    } catch (e) {
      console.error("Error loading partners:", e);
    }
  };

  const handleCreditCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !commissionAmount || Number(commissionAmount) <= 0) {
      alert("Veuillez sélectionner un partenaire et un montant valide.");
      return;
    }

    setIsSubmittingCommission(true);
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREDIT_COMMISSION",
          partnerId: selectedPartnerId,
          amount: Number(commissionAmount),
          reason: commissionReason || "Commission directe accordée par la Direction",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de l'attribution de la commission.");
      }

      setIsCommissionModalOpen(false);
      setSelectedPartnerId("");
      setCommissionAmount("");
      setCommissionReason("");
      setActionNotice(json.message || "Commission créditée avec succès.");
      setTimeout(() => setActionNotice(""), 6000);
      fetchPartners();
    } catch (err: any) {
      alert(err.message || "Erreur réseau.");
    } finally {
      setIsSubmittingCommission(false);
    }
  };

  const handleProposeChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProposal(true);
    try {
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PROPOSE_CHANGE",
          proposalData: {
            usdToFcRate: Number(formUsdRate),
            referralCommissionUSD: Number(formCommission),
            promoDiscountUSD: Number(formPromo),
            monthlySubscriptionPrice: Number(formSubscription),
            reason: formReason || "Mise à jour opérationnelle",
            applyDirectly: isSuperAdmin,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de la soumission de la proposition.");
      }

      setIsProposalModalOpen(false);
      setFormReason("");
      setActionNotice(json.message);
      setTimeout(() => setActionNotice(""), 6000);
      fetchFinancialSettings();
    } catch (err: any) {
      alert(err.message || "Erreur.");
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!confirm("Confirmez-vous l'approbation et l'application immédiate de cette proposition financière ?")) return;
    try {
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE_CHANGE" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erreur.");
      setActionNotice(json.message);
      setTimeout(() => setActionNotice(""), 6000);
      fetchFinancialSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT_CHANGE", rejectionReason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erreur.");
      setIsRejectModalOpen(false);
      setRejectionReason("");
      setActionNotice("Proposition rejetée.");
      setTimeout(() => setActionNotice(""), 5000);
      fetchFinancialSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
      fetchPartners();
      fetchFinancialSettings();
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

  // Statistiques de Recouvrement Abonnements Fournisseurs (Admin Finances)
  const supplierStats = {
    total: suppliers.length,
    official: suppliers.filter(s => isOfficialAdminSupplier(s)).length,
    overdue: suppliers.filter(s => !isOfficialAdminSupplier(s) && evaluateSupplierSubscription(s).isBlocked).length,
    trial: suppliers.filter(s => !isOfficialAdminSupplier(s) && !evaluateSupplierSubscription(s).isBlocked && evaluateSupplierSubscription(s).isTrial).length,
    active: suppliers.filter(s => !isOfficialAdminSupplier(s) && !evaluateSupplierSubscription(s).isBlocked && !evaluateSupplierSubscription(s).isTrial).length,
    overdueAmountToCollect: suppliers.filter(s => !isOfficialAdminSupplier(s) && evaluateSupplierSubscription(s).isBlocked).reduce((sum, s) => sum + (s.depositAmount || 50), 0),
    projectedMonthlySubscriptions: suppliers.filter(s => !isOfficialAdminSupplier(s)).reduce((sum, s) => sum + (s.depositAmount || 50), 0),
  };

  const filteredSuppliersList = suppliers.filter(s => {
    const isOfficial = isOfficialAdminSupplier(s);
    const subInfo = evaluateSupplierSubscription(s);

    if (supplierStatusFilter === "OVERDUE" && (isOfficial || !subInfo.isBlocked)) return false;
    if (supplierStatusFilter === "TRIAL" && (isOfficial || subInfo.isBlocked || !subInfo.isTrial)) return false;
    if (supplierStatusFilter === "ACTIVE" && (isOfficial || subInfo.isBlocked || subInfo.isTrial)) return false;
    if (supplierStatusFilter === "OFFICIAL" && !isOfficial) return false;

    if (supplierRayonFilter !== "ALL" && (s.rayon || "").toLowerCase() !== supplierRayonFilter.toLowerCase()) return false;

    if (supplierSearch.trim()) {
      const q = supplierSearch.toLowerCase();
      const name = (s.displayName || s.company || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    }
    return true;
  });

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
      <DateRangeFilterPills filter={dateFilter} />

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
          { id: "commissions", label: `Commissions Partenaires (${partners.length})`, icon: <Award size={13} /> },
          {
            id: "settings",
            label: pendingProposal ? "Paramètres & Taux (1 En Attente)" : "Paramètres Financiers & Taux",
            icon: <Sliders size={13} />,
            hasBadge: Boolean(pendingProposal),
          },
          { id: "overview", label: "Livre de Caisse", icon: <Wallet size={13} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer relative ${
              activeTab === tab.id
                ? "border-[#C7D300] text-[#C7D300]"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.hasBadge && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
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

      {/* TAB 2: ÉCHÉANCIER ET RECOUVREMENT DES COTISATIONS FOURNISSEURS (ADMIN FINANCES) */}
      {activeTab === "deposits" && (
        <div className="space-y-4">
          {/* Cartes d'Analyse Recouvrement Transversal */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white/3 border border-white/8 rounded-xl p-3.5 sm:p-4">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fournisseurs Actifs</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-white">{supplierStats.active}</span>
                <span className="text-[10px] text-gray-500">/ {supplierStats.total} total</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Cotisations à jour</p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 sm:p-4">
              <p className="text-[10px] sm:text-[11px] font-semibold text-amber-400 uppercase tracking-wider">En Période d&apos;Essai</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-amber-300">{supplierStats.trial}</span>
                <span className="text-[10px] text-amber-500/80">fournisseurs</span>
              </div>
              <p className="text-[10px] text-amber-400/70 mt-1">15 jours d&apos;essai gratuits</p>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3.5 sm:p-4">
              <p className="text-[10px] sm:text-[11px] font-semibold text-red-400 uppercase tracking-wider">À Recouvrer (Impayés)</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-red-300">{supplierStats.overdue}</span>
                <span className="text-xs font-bold text-red-400">(${supplierStats.overdueAmountToCollect})</span>
              </div>
              <p className="text-[10px] text-red-400/80 mt-1">Comptes bloqués pour impayé</p>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-xl p-3.5 sm:p-4">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Boutiques Officielles</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-[#C7D300]">{supplierStats.official}</span>
                <span className="text-[10px] text-gray-400">Rayons.net</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Exemptées de cotisations</p>
            </div>
          </div>

          {/* Table Principale Échéancier */}
          <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-white/8 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Échéancier & Recouvrement des Cotisations</h2>
                <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">Suivi transversal tous rayons confondus · Encaissement des cotisations mensuelles</p>
              </div>

              {/* Filtres de Statut */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(
                    [
                      { id: "ALL", label: `Tous (${supplierStats.total})` },
                      { id: "OVERDUE", label: `Impayés (${supplierStats.overdue})` },
                      { id: "ACTIVE", label: `À jour (${supplierStats.active})` },
                      { id: "TRIAL", label: `Essai (${supplierStats.trial})` },
                      { id: "OFFICIAL", label: `Officielles (${supplierStats.official})` },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setSupplierStatusFilter(btn.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                        supplierStatusFilter === btn.id
                          ? "bg-[#C7D300] text-[#0F1D27] shadow-sm font-bold"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Filtre Rayon */}
                <select
                  value={supplierRayonFilter}
                  onChange={(e) => setSupplierRayonFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-[#C7D300]"
                >
                  <option value="ALL">Tous les Rayons</option>
                  <option value="immo">Immobilier & Hôtels</option>
                  <option value="mode">Mode & Vêtements</option>
                  <option value="connect">Connect (Tech & Services)</option>
                  <option value="saveurs">Saveurs (Alimentation)</option>
                </select>

                {/* Recherche */}
                <input
                  type="text"
                  placeholder="Rechercher fournisseur..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#C7D300] w-36 sm:w-44"
                />
              </div>
            </div>

            {/* Desktop Table (Hidden on mobile < md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Fournisseur", "Rayon Commercial", "Cycle", "Échéance", "Cotisation", "Statut", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSuppliersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-600">Aucun fournisseur ne correspond aux critères.</td>
                    </tr>
                  ) : (
                    filteredSuppliersList.map((s) => {
                      const isOfficial = isOfficialAdminSupplier(s);
                      const subInfo = evaluateSupplierSubscription(s);
                      const depositAmount = s.depositAmount || 50;

                      return (
                        <tr key={s.id} className="hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-[11px] font-semibold text-white">{s.displayName || s.company || "Partenaire"}</p>
                            <p className="text-[10px] text-gray-600">{s.email}</p>
                          </td>
                          <td className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            {s.rayon || "—"}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-400">
                            {isOfficial ? "Officielle Rayons (Exemptée)" : subInfo.isTrial ? `Essai gratuit (${subInfo.daysLeft}j)` : "Cotisation Mensuelle"}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-400">
                            {isOfficial ? "—" : subInfo.formattedDueDate}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-semibold text-gray-300">
                            {isOfficial ? "$0" : `$${depositAmount}/mois`}
                          </td>
                          <td className="px-4 py-3">
                            {isOfficial ? (
                              <span className="text-[10px] font-bold text-[#C7D300] bg-[#C7D300]/10 px-2 py-0.5 rounded border border-[#C7D300]/20">
                                🏷️ Boutique Officielle
                              </span>
                            ) : subInfo.isBlocked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-500/20">
                                <Lock size={10} /> Bloqué (Impayé)
                              </span>
                            ) : subInfo.isTrial ? (
                              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                En essai ({subInfo.daysLeft}j)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <CheckCircle size={10} /> À jour
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isOfficial ? (
                              <span className="text-[10px] text-gray-600 italic">Exempté</span>
                            ) : (
                              <button
                                onClick={() => handleSettleSupplierDeposit(s)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                                  subInfo.isBlocked
                                    ? "bg-red-500 hover:bg-red-600 text-white shadow-sm"
                                    : "bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27]"
                                }`}
                              >
                                <ArrowDownRight size={12} />
                                {subInfo.isBlocked ? `Recouvrer $${depositAmount}` : `Encaisser $${depositAmount}`}
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
              {filteredSuppliersList.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">Aucun fournisseur ne correspond.</div>
              ) : (
                filteredSuppliersList.map((s) => {
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
                          <span className="text-[9px] font-bold text-[#C7D300] bg-[#C7D300]/10 px-2 py-0.5 rounded border border-[#C7D300]/20">
                            🏷️ Boutique Officielle
                          </span>
                        ) : subInfo.isBlocked ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-500/20">
                            <Lock size={10} /> Bloqué
                          </span>
                        ) : subInfo.isTrial ? (
                          <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Essai ({subInfo.daysLeft}j)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle size={10} /> À jour
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>Rayon Commercial: <strong className="text-gray-300 uppercase">{s.rayon || "—"}</strong></span>
                        <span>Échéance: <strong className="text-gray-300">{isOfficial ? "—" : subInfo.formattedDueDate}</strong></span>
                      </div>

                      {!isOfficial && (
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-xs font-semibold text-gray-300">${depositAmount}/mois</span>
                          <button
                            onClick={() => handleSettleSupplierDeposit(s)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer active:scale-95 ${
                              subInfo.isBlocked
                                ? "bg-red-500 text-white"
                                : "bg-[#C7D300] text-[#0F1D27]"
                            }`}
                          >
                            <ArrowDownRight size={13} />
                            <span>{subInfo.isBlocked ? `Recouvrer $${depositAmount}` : `Encaisser $${depositAmount}`}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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

      {/* TAB 4: COMMISSIONS DES PARTENAIRES & CRÉDIT DIRECT */}
      {activeTab === "commissions" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/3 border border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Partenaires Enregistrés</p>
              <div className="text-2xl font-black text-white mt-1">{partners.length}</div>
              <p className="text-[10px] text-gray-500 mt-0.5">Apporteurs d&apos;affaires agréés</p>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Soldes Disponibles Cumulés</p>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                ${partners.reduce((sum, p) => sum + (p.balance || 0), 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-emerald-500/70 mt-0.5">En attente de versement Mobile Money</p>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Commissions Versées à Vie</p>
              <div className="text-2xl font-black text-[#C7D300] mt-1">
                ${partners.reduce((sum, p) => sum + (p.totalEarned || 0), 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">Rémunération totale générée</p>
            </div>
          </div>

          <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award size={15} className="text-[#C7D300]" />
                  <span>Gestion des Commissions Partenaires & Crédit Direct</span>
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Visualisez les soldes de vos partenaires et créditez directement des commissions exceptionnelles
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedPartnerId(partners[0]?.id || "");
                  setIsCommissionModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-lg font-bold text-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>Créditer une Commission Directe</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Partenaire", "Code", "Boutiques Rattachées", "Solde Disponible", "Total Cumulé", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {partners.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-600">Aucun partenaire enregistré.</td></tr>
                  ) : (
                    partners.map((p) => (
                      <tr key={p.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-white">{p.displayName}</p>
                          <p className="text-[10px] text-gray-500">{p.email || p.phone || "—"}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-[#C7D300]">
                          {p.referralCode}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300">
                          {p.referralCount} boutique{p.referralCount > 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 text-xs font-extrabold text-emerald-400">
                          ${Number(p.balance || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-300">
                          ${Number(p.totalEarned || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedPartnerId(p.id);
                              setIsCommissionModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Coins size={12} className="text-[#C7D300]" />
                            <span>Créditer</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PARAMÈTRES FINANCIERS & WORKFLOW DE DOUBLE VALIDATION */}
      {activeTab === "settings" && (
        <div className="space-y-5">
          {/* BANDEAU DE PROPOSITION EN ATTENTE (DOUBLE VALIDATION) */}
          {pendingProposal && pendingProposal.status === "PENDING_APPROVAL" && (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Proposition Financière Soumise par le Responsable Financier
                    </h3>
                    <p className="text-xs text-amber-300/80 mt-0.5">
                      Demandée par <strong>{pendingProposal.requestedByName}</strong> ({pendingProposal.requestedByRole}) · En attente d&apos;approbation par l&apos;Administrateur Principal
                    </p>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleApproveProposal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                    >
                      <Check size={14} />
                      <span>Approuver & Notifier</span>
                    </button>
                    <button
                      onClick={() => setIsRejectModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-xl text-xs transition-all border border-red-500/30 cursor-pointer"
                    >
                      <X size={14} />
                      <span>Rejeter</span>
                    </button>
                  </div>
                )}
              </div>

              {pendingProposal.reason && (
                <p className="text-xs text-gray-300 italic bg-black/30 p-2.5 rounded-lg border border-white/5">
                  &ldquo;{pendingProposal.reason}&rdquo;
                </p>
              )}

              {/* Tableau comparatif Avant / Après */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Taux USD / CDF</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through">{pendingProposal.current?.usdToFcRate} FC</span>
                    <span className="font-extrabold text-[#C7D300] text-sm">➔ {pendingProposal.proposed?.usdToFcRate} FC</span>
                  </div>
                </div>

                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Commission Partenaire</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through">${pendingProposal.current?.referralCommissionUSD}</span>
                    <span className="font-extrabold text-[#C7D300] text-sm">➔ ${pendingProposal.proposed?.referralCommissionUSD}</span>
                  </div>
                </div>

                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Abonnement Fournisseur</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through">${pendingProposal.current?.monthlySubscriptionPrice}</span>
                    <span className="font-extrabold text-[#C7D300] text-sm">➔ ${pendingProposal.proposed?.monthlySubscriptionPrice}</span>
                  </div>
                </div>

                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Réduction Code Promo</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through">-${pendingProposal.current?.promoDiscountUSD}$</span>
                    <span className="font-extrabold text-[#C7D300] text-sm">➔ -${pendingProposal.proposed?.promoDiscountUSD}$</span>
                  </div>
                </div>
              </div>

              {!isSuperAdmin && (
                <div className="text-[11px] text-amber-300 flex items-center gap-1.5 pt-1">
                  <Clock size={12} />
                  <span>En attente de signature par le Directeur Général. Les taux actuels restent en vigueur jusqu&apos;à validation.</span>
                </div>
              )}
            </div>
          )}

          {/* PARAMÈTRES ACTIFS */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders size={16} className="text-[#C7D300]" />
                  <span>Paramètres Financiers Actifs de la Plateforme</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Taux de conversion, rémunération des partenaires et politique tarifaire
                </p>
              </div>

              <button
                onClick={() => setIsProposalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                <Sliders size={14} />
                <span>{isSuperAdmin ? "Modifier les Paramètres Financiers" : "Proposer une Modification (Financier)"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-black/40 p-4 rounded-xl border border-white/6 space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Taux de Change USD / CDF</span>
                <div className="text-2xl font-black text-white">
                  1 $ = {financialSettings?.usdToFcRate || 2850} FC
                </div>
                <p className="text-[10px] text-gray-500">Taux officiel de conversion pour les paiements en francs</p>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/6 space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Commission Partenaire</span>
                <div className="text-2xl font-black text-[#C7D300]">
                  ${financialSettings?.referralCommissionUSD || 5} USD
                </div>
                <p className="text-[10px] text-gray-500">Crédité au partenaire à chaque mois réglé par un filleul</p>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/6 space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Abonnement Mensuel Boutique</span>
                <div className="text-2xl font-black text-white">
                  ${financialSettings?.monthlySubscriptionPrice || 50} USD
                </div>
                <p className="text-[10px] text-gray-500">Tarif standard de tenue de boutique et vitrine</p>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/6 space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Réduction Immédiate Code Promo</span>
                <div className="text-2xl font-black text-emerald-400">
                  -${financialSettings?.promoDiscountUSD || 10} USD
                </div>
                <p className="text-[10px] text-gray-500">Déduit directement à l&apos;enregistrement du commerçant</p>
              </div>
            </div>
          </div>

          {/* HISTORIQUE DES CHANGEMENTS APPLIQUÉS */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Historique des Dernières Validations Financières
            </h3>
            {financialHistory.length === 0 ? (
              <p className="text-xs text-gray-500 py-3">Aucun changement récent enregistré.</p>
            ) : (
              <div className="divide-y divide-white/5 text-xs">
                {financialHistory.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between text-gray-400">
                    <div>
                      <span className="font-semibold text-white">{h.reason || "Mise à jour financière"}</span>
                      <p className="text-[10px] text-gray-500">
                        Validé par {h.approvedByName || h.appliedByName || "Direction"} · Taux: {h.values?.usdToFcRate} FC · Commission: ${h.values?.referralCommissionUSD}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">
                      {h.appliedAt ? new Date(h.appliedAt).toLocaleDateString("fr-FR") : "Récent"}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

      {/* MODAL 3: CRÉDITER COMMISSION PARTENAIRE DIRECTEMENT */}
      <AnimatePresence>
        {isCommissionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="text-[#C7D300]" size={16} />
                  <span>Créditer une Commission Partenaire</span>
                </h2>
                <button onClick={() => setIsCommissionModalOpen(false)} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreditCommissionSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Partenaire Bénéficiaire *</label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                  >
                    <option value="">Sélectionnez un partenaire</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0F1D27]">
                        {p.displayName} (Code: {p.referralCode} · Solde: ${p.balance}$)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Montant à Créditer ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    required
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    placeholder="25.00"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Ce montant s&apos;ajoutera directement au solde disponible du partenaire.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Motif / Justification *</label>
                  <input
                    type="text"
                    required
                    value={commissionReason}
                    onChange={(e) => setCommissionReason(e.target.value)}
                    placeholder="ex: Bonus recrutement de 5 boutiques ou prime d'apport"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsCommissionModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">Annuler</button>
                  <button type="submit" disabled={isSubmittingCommission}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer">
                    {isSubmittingCommission ? "Enregistrement..." : "Créditer Immédiatement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: PROPOSER / MODIFIER LES PARAMÈTRES FINANCIERS */}
      <AnimatePresence>
        {isProposalModalOpen && (
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
                    <Sliders className="text-[#C7D300]" size={16} />
                    <span>{isSuperAdmin ? "Mise à Jour Directe des Paramètres" : "Proposition d'Ajustement Financier"}</span>
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {isSuperAdmin
                      ? "En tant que Super Admin / DG, ces paramètres s'appliqueront immédiatement."
                      : "Soumis à la signature et approbation de l'Administrateur Principal."}
                  </p>
                </div>
                <button onClick={() => setIsProposalModalOpen(false)} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleProposeChangeSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Taux USD / CDF *</label>
                    <input
                      type="number"
                      required
                      value={formUsdRate}
                      onChange={(e) => setFormUsdRate(e.target.value)}
                      placeholder="2850"
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Commission Partenaire ($ USD) *</label>
                    <input
                      type="number"
                      required
                      value={formCommission}
                      onChange={(e) => setFormCommission(e.target.value)}
                      placeholder="5"
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Abonnement Mensuel ($ USD) *</label>
                    <input
                      type="number"
                      required
                      value={formSubscription}
                      onChange={(e) => setFormSubscription(e.target.value)}
                      placeholder="50"
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Réduction Promo ($ USD) *</label>
                    <input
                      type="number"
                      required
                      value={formPromo}
                      onChange={(e) => setFormPromo(e.target.value)}
                      placeholder="10"
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Motif / Justification du Changement *</label>
                  <textarea
                    required
                    rows={2}
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="ex: Réajustement suite au cours officiel de la Banque Centrale ou campagne promotionnelle de Noël..."
                    className="w-full px-3.5 py-2 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsProposalModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">Annuler</button>
                  <button type="submit" disabled={isSubmittingProposal}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer">
                    {isSubmittingProposal
                      ? "Traitement..."
                      : isSuperAdmin
                      ? "Appliquer et Notifier Immédiatement"
                      : "Soumettre pour Approbation DG"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: REJETER LA PROPOSITION */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span>Rejeter la Proposition Financière</span>
              </h3>
              <p className="text-xs text-gray-400">
                Veuillez indiquer le motif du rejet qui sera transmis au responsable financier.
              </p>

              <form onSubmit={handleRejectProposalSubmit} className="space-y-4">
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Motif du refus..."
                  className="w-full px-3.5 py-2 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-400/50"
                />

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setIsRejectModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">Annuler</button>
                  <button type="submit"
                    className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer">
                    Confirmer le Rejet
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
