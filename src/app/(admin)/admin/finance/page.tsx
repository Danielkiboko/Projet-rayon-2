"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search, 
  FileText, ShieldAlert, CheckCircle, Clock, AlertTriangle, Sliders, RefreshCw, Lock
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
  const [isLoading, setIsLoading] = useState(true);
  const [journalFilter, setJournalFilter] = useState<string>("ALL");
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
      snapshot.forEach((docSnap) => {
        const order = docSnap.data();
        const status = (order.status || "").toUpperCase();
        if (status === "COMPLETED" || status === "LIVRÉE" || status === "DELIVERED") {
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
    }, (error) => {
      console.warn("Orders finance listener warning:", error.message);
    });

    return () => {
      unsubTx();
      unsubLedger();
      unsubOrders();
    };
  }, [user, userData, loading, router]);

  // Calculations
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

  // Filtered Ledger
  const filteredLedger = ledgerEntries.filter(entry => {
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

      {/* Financial Overview Cards - Based on User's Business Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Solde de Caisse</h3>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3">${currentBalance.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Solde net consolidé</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Abonnements Fournisseurs</h3>
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-400 mt-3">${totalSubscriptions.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Dépôts mensuels perçus</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Ventes Boutiques Admin</h3>
            <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-cyan-400 mt-3">${(totalOtherIncome + totalAdminStoreSales).toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Produits certifiés officiels ({adminStoreSales.length} vente{adminStoreSales.length > 1 ? 's' : ''})</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Dépenses Plateforme</h3>
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-red-400 mt-3">${totalPayout.toFixed(2)}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Frais serveurs & logistique</span>
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
                      Aucune écriture comptable enregistrée pour ce filtre.
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
