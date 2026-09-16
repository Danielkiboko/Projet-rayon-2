"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search, Home, Hotel, Sparkles, Sliders, ShieldAlert, CheckCircle, Lock, Clock } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, doc, updateDoc, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getSupplierType } from "@/lib/permissions";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";
import { ADJUSTMENT_REASONS, recordCashAdjustment, recordSubscriptionDeposit } from "@/lib/accountingLedger";

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE" | "PAYOUT";
  category?: string;
  branch?: "habitation" | "hotel" | "generic";
  amount: number;
  currency: string;
  description: string;
  referenceId?: string;
  status: "COMPLETED" | "PENDING";
  createdAt: any;
  supplierId: string;
}

export default function SupplierFinancePage() {
  const { user, userData, loading } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const router = useRouter();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE" | "PAYOUT" | "RENT_INCOME" | "HOTEL_INCOME">("INCOME");
  const [expenseCategory, setExpenseCategory] = useState("Autre");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");

  // Hotel Helper State in Finance
  const [hotelGuestName, setHotelGuestName] = useState("");
  const [hotelRoom, setHotelRoom] = useState("");
  const [hotelNights, setHotelNights] = useState(1);
  const [hotelNightlyRate, setHotelNightlyRate] = useState("");
  
  const isImmo = getSupplierType(userData) === "immo";
  const subscriptionInfo = evaluateSupplierSubscription(userData);

  // Cash Adjustment state
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState<"ADD" | "SUBTRACT">("ADD");
  const [adjReason, setAdjReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [adjLabel, setAdjLabel] = useState("");
  const [adjRef, setAdjRef] = useState("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);
  const [financeNotice, setFinanceNotice] = useState("");

  useEffect(() => {
    if (!loading && (!user || !userData || (userData.role !== "SUPPLIER" && userData.role !== "supplier" && userData.role !== "SUPPLIER_IMMO" && userData.role !== "supplier_immo" && userData.role !== "SUB_SUPPLIER"))) {
      router.push("/");
      return;
    }

    if (user) {

      // 1. Fetch manual transactions
      const qTx = query(
        collection(db, "supplier_transactions"), 
        where("supplierId", "==", activeSupplierId),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      
      let manualTx: Transaction[] = [];
      let automaticTx: Transaction[] = [];

      const updateCombined = () => {
        const combined = [...manualTx, ...automaticTx].sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setTransactions(combined);
      };
      
      const unsubTx = onSnapshot(qTx, (snapshot) => {
        const data: Transaction[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        manualTx = data;
        updateCombined();
        setIsLoading(false);
      }, (error) => {
        console.warn("Error fetching transactions (handled):", error.message);
        setIsLoading(false);
      });

      let unsubAutomatic: any = () => {};
      let unsubTenants: any = () => {};

      if (isImmo) {
        // Fetch tenants for rent payment dropdown
        const qTenants = query(
          collection(db, "tenants"),
          where("supplierId", "==", activeSupplierId),
          limit(50)
        );
        unsubTenants = onSnapshot(qTenants, (snapshot) => {
          const t: any[] = [];
          snapshot.forEach(doc => t.push({ id: doc.id, ...doc.data() }));
          setTenants(t);
        }, (err) => {
          console.warn("Tenants warning:", err.message);
        });

        // Fetch rent payments for Immo
        const qPayments = query(
          collection(db, "payments"),
          where("supplierId", "==", activeSupplierId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        unsubAutomatic = onSnapshot(qPayments, (snapshot) => {
          const data: Transaction[] = [];
          snapshot.forEach((doc) => {
            const payment = doc.data();
            if (payment.status === "COMPLETED") {
              data.push({
                id: `payment_${doc.id}`,
                type: "INCOME",
                category: "Loyer Habitation",
                branch: "habitation",
                amount: payment.amount || 0,
                currency: "USD",
                description: `Paiement Loyer - ${payment.clientName}`,
                referenceId: payment.reference,
                status: "COMPLETED",
                createdAt: payment.createdAt,
                supplierId: activeSupplierId
              });
            }
          });
          automaticTx = data;
          updateCombined();
        }, (err) => {
          console.warn("Payments warning:", err.message);
        });
      } else {
        // Fetch orders for regular E-commerce
        const qOrders = query(
          collection(db, "orders"),
          where("supplierIds", "array-contains", activeSupplierId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        unsubAutomatic = onSnapshot(qOrders, (snapshot) => {
          const data: Transaction[] = [];
          snapshot.forEach((doc) => {
            const order = doc.data();
            const status = (order.status || "").toUpperCase();
            if (status === "COMPLETED" || status === "LIVRÉE" || status === "DELIVERED") {
              const myItems = order.items?.filter((item: any) => item.supplierId === activeSupplierId) || [];
              const myTotal = myItems.reduce((acc: number, item: any) => acc + (item.price * (item.quantity || 1)), 0);
              const productNames = myItems.map((item: any) => item.productName || "Produit").join(", ");
              
              if (myTotal > 0) {
                data.push({
                  id: `order_${doc.id}`,
                  type: "INCOME",
                  category: "Vente",
                  amount: myTotal,
                  currency: "USD",
                  description: `Commande #${doc.id.slice(0, 6).toUpperCase()} (${productNames})`,
                  referenceId: doc.id,
                  status: "COMPLETED",
                  createdAt: order.createdAt,
                  supplierId: activeSupplierId
                });
              }
            }
          });
          automaticTx = data;
          updateCombined();
        }, (err) => {
          console.warn("Orders warning:", err.message);
        });
      }

      return () => {
        unsubTx();
        unsubAutomatic();
        unsubTenants();
      };
    }
  }, [user, userData, loading, router, activeSupplierId]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !user) return;
    
    setIsSubmitting(true);
    try {
      if (txType === "HOTEL_INCOME") {
        const nights = hotelNights > 0 ? hotelNights : 1;
        const totalAmt = Number(amount) || (nights * (parseFloat(hotelNightlyRate) || 0));

        await addDoc(collection(db, "supplier_transactions"), {
          supplierId: activeSupplierId,
          type: "INCOME",
          category: "Hôtellerie",
          branch: "hotel",
          amount: totalAmt,
          currency: "USD",
          description: description || `Séjour Hôtel - ${hotelGuestName || 'Client'} (${hotelRoom || 'Chambre'}, ${nights} nuit(s))`,
          referenceId: referenceId || `Séjour ${hotelRoom || ''}`,
          guestName: hotelGuestName || null,
          room: hotelRoom || null,
          nights: nights,
          status: "COMPLETED",
          createdAt: serverTimestamp(),
          createdBy: activeSupplierId
        });
      } else if (txType === "RENT_INCOME") {
        if (!selectedTenantId) {
          alert("Veuillez sélectionner un locataire");
          setIsSubmitting(false);
          return;
        }
        const tenant = tenants.find(t => t.id === selectedTenantId);
        
        // 1. Ajouter le paiement
        await addDoc(collection(db, "payments"), {
          supplierId: activeSupplierId,
          tenantId: tenant.id,
          clientName: `${tenant.firstName} ${tenant.lastName}`,
          propertyId: tenant.propertyId,
          propertyTitle: tenant.propertyTitle,
          unitId: tenant.unitId || null,
          unitTitle: tenant.unitTitle || null,
          amount: Number(amount),
          currency: "USD",
          status: "COMPLETED",
          createdAt: serverTimestamp(),
          createdBy: activeSupplierId,
          reference: referenceId || `Loyer ${new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`
        });

        // 2. Mettre à jour nextPayment du locataire (+1 mois par défaut ou selon périodicité)
        if (tenant.nextPayment) {
          const currentDate = new Date(tenant.nextPayment);
          if (tenant.periodicity === "Trimestriel") currentDate.setMonth(currentDate.getMonth() + 3);
          else if (tenant.periodicity === "Annuel") currentDate.setFullYear(currentDate.getFullYear() + 1);
          else if (tenant.periodicity === "Hebdomadaire") currentDate.setDate(currentDate.getDate() + 7);
          else currentDate.setMonth(currentDate.getMonth() + 1); // Mensuel par défaut

          await updateDoc(doc(db, "tenants", tenant.id), {
            nextPayment: currentDate.toISOString().split("T")[0],
            status: "À jour"
          });
        }
      } else {
        await addDoc(collection(db, "supplier_transactions"), {
          supplierId: activeSupplierId,
          type: txType,
          category: txType === "EXPENSE" ? expenseCategory : null,
          branch: isImmo ? "habitation" : "generic",
          amount: Number(amount),
          currency: "USD",
          description,
          referenceId: referenceId || null,
          status: "COMPLETED",
          createdAt: serverTimestamp(),
          createdBy: activeSupplierId
        });
      }

      setIsModalOpen(false);
      setAmount("");
      setDescription("");
      setReferenceId("");
      setSelectedTenantId("");
      setHotelGuestName("");
      setHotelRoom("");
      setHotelNights(1);
      setHotelNightlyRate("");
      setTxType("INCOME");
      setExpenseCategory("Autre");
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Erreur lors de l'ajout de la transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        actorType: "SUPPLIER",
        supplierId: activeSupplierId,
        supplierName: userData?.displayName || userData?.company || "Partenaire",
        currentBalance: balance
      });
      setIsAdjustmentModalOpen(false);
      setAdjAmount("");
      setAdjLabel("");
      setAdjRef("");
      setFinanceNotice(`Ajustement de caisse de ${finalAmount > 0 ? "+" : ""}$${finalAmount} enregistré avec succès.`);
      setTimeout(() => setFinanceNotice(""), 6000);
    } catch (err: any) {
      console.error("Error saving cash adjustment:", err);
      alert(err.message || "Erreur lors de l'enregistrement de l'ajustement.");
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const handlePayDeposit = async () => {
    const depositAmount = userData?.depositAmount || 50;
    if (!confirm(`Confirmez-vous le paiement de votre dépôt mensuel de $${depositAmount} ?\n\nCette action débloquera instantanément votre compte pour 30 jours supplémentaires.`)) {
      return;
    }
    try {
      await recordSubscriptionDeposit({
        supplierId: activeSupplierId,
        supplierName: userData?.displayName || userData?.company || "Partenaire",
        amount: depositAmount,
        paymentMethod: "Paiement direct en ligne",
        currentBalance: balance
      });
      setFinanceNotice("Félicitations ! Votre dépôt mensuel a été régularisé. Vos publications et messageries sont débloquées.");
      setTimeout(() => setFinanceNotice(""), 7000);
      window.location.reload();
    } catch (err: any) {
      console.error("Error paying deposit:", err);
      alert(err.message || "Erreur lors du paiement du dépôt.");
    }
  };

  const downloadCSV = () => {
    const headers = ["Date", "Type", "Montant (USD)", "Description", "Reference", "Statut"];
    const rows = filteredTransactions.map(t => [
      t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('fr-FR') : 'N/A',
      t.type,
      t.amount.toString(),
      `"${t.description}"`,
      t.referenceId || "N/A",
      t.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mon_livre_de_caisse_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTransactions = transactions.filter(t => {
    if (filter === "RENT_INCOME") {
      const isRent = t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_");
      if (!isRent) return false;
    } else if (filter === "HOTEL_INCOME") {
      const isHotel = t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel");
      if (!isHotel) return false;
    } else if (filter !== "ALL" && t.type !== filter) {
      return false;
    }
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !(t.referenceId || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalIncome = transactions.filter(t => t.type === "INCOME").reduce((acc, t) => acc + t.amount, 0);
  const totalHabitationIncome = transactions
    .filter(t => t.type === "INCOME" && (t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_")))
    .reduce((acc, t) => acc + t.amount, 0);
  const totalHotelIncome = transactions
    .filter(t => t.type === "INCOME" && (t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel")))
    .reduce((acc, t) => acc + t.amount, 0);
  const totalPayout = transactions.filter(t => t.type === "PAYOUT" || t.type === "EXPENSE").reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalPayout;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mon Livre de Caisse & Comptabilité</h1>
          <p className="text-sm text-gray-400">
            {isImmo ? "Comptabilité connectée : séparez les loyers d'habitation et les recettes d'hôtels." : "Gérez vos revenus de ventes et vos paiements."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsAdjustmentModalOpen(true)}
            className="flex items-center space-x-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Sliders size={16} />
            <span>Ajustement Caisse Magasin</span>
          </button>
          <button 
            onClick={downloadCSV}
            className="flex items-center space-x-1.5 bg-black/20 hover:bg-black/40 border border-white/10 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download size={16} />
            <span>Exporter CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Ajouter Opération</span>
          </button>
        </div>
      </div>

      {/* Finance Notice */}
      {financeNotice && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-semibold">
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          <span>{financeNotice}</span>
        </div>
      )}

      {/* Supplier Deposit & Subscription Status Card */}
      {(userData?.isOfficialAdminStore || userData?.isAdminSupplier) ? (
        <div className="p-4 rounded-2xl border bg-amber-500/15 border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl shrink-0 bg-amber-500/20 text-amber-400">
              <span className="text-2xl">👑</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Boutique Officielle de l'Administration</span>
                <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold uppercase">
                  Liée à l'Admin
                </span>
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Ce compte est dispensé de frais de tenue de compte et d'abonnement. Toutes vos recettes de ventes sont automatiquement consolidées dans la trésorerie et la comptabilité générale de l'Administration.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl w-max shrink-0">
            Exempté de tenue de compte
          </div>
        </div>
      ) : (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          subscriptionInfo.isBlocked 
            ? "bg-red-500/15 border-red-500/30 text-red-200"
            : subscriptionInfo.isTrial 
            ? "bg-blue-500/10 border-blue-500/25 text-blue-200"
            : "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 ${
              subscriptionInfo.isBlocked ? "bg-red-500/20 text-red-400" :
              subscriptionInfo.isTrial ? "bg-blue-500/20 text-blue-400" :
              "bg-emerald-500/20 text-emerald-400"
            }`}>
              {subscriptionInfo.isBlocked ? <Lock size={22} /> :
               subscriptionInfo.isTrial ? <Clock size={22} /> :
               <CheckCircle size={22} />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {subscriptionInfo.isBlocked ? "Compte Suspendu : Dépôt Mensuel Attendu ($50)" :
                 subscriptionInfo.isTrial ? `Période d'essai active : 15 Jours (${subscriptionInfo.daysLeft}j restants)` :
                 "Abonnement Partenaire Rayons.net Actif"}
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                {subscriptionInfo.isBlocked ? "Le délai est dépassé. Régularisez votre dépôt pour débloquer la publication de vos articles et la messagerie client." :
                 subscriptionInfo.isTrial ? `Prochaine échéance du premier dépôt le ${subscriptionInfo.formattedDueDate}. Profitez de vos 15 jours offerts.` :
                 `Votre compte est en règle jusqu'au ${subscriptionInfo.formattedDueDate}.`}
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={handlePayDeposit}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                subscriptionInfo.isBlocked 
                  ? "bg-red-600 hover:bg-red-500 text-white animate-pulse" 
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              }`}
            >
              {subscriptionInfo.isBlocked ? "Régulariser Maintenant ($50)" : "Régler d'avance ($50)"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {isImmo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-xs font-semibold uppercase">Solde Trésorerie</h3>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Wallet className="text-blue-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">${balance.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Revenus nets cumulés</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-emerald-300 text-xs font-semibold uppercase">🏠 Loyers Habitation</h3>
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Home className="text-emerald-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-3">${totalHabitationIncome.toFixed(2)}</p>
            <p className="text-xs text-emerald-300/70 mt-1">Baux résidentiels & commerciaux</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-amber-300 text-xs font-semibold uppercase">🏨 Recettes Hôtellerie</h3>
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Hotel className="text-amber-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-3">${totalHotelIncome.toFixed(2)}</p>
            <p className="text-xs text-amber-300/70 mt-1">Nuitées & séjours réservés</p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-red-300 text-xs font-semibold uppercase">Dépenses & Charges</h3>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <ArrowUpRight className="text-red-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-400 mt-3">${totalPayout.toFixed(2)}</p>
            <p className="text-xs text-red-300/70 mt-1">Entretien, carburant, salaires</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-sm font-medium">Solde Actuel</h3>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Wallet className="text-blue-400" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mt-4">${balance.toFixed(2)}</p>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-sm font-medium">Revenus (Entrées)</h3>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <ArrowDownRight className="text-green-400" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mt-4">${totalIncome.toFixed(2)}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-sm font-medium">Dépenses (Sorties)</h3>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <ArrowUpRight className="text-red-400" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mt-4">${totalPayout.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${filter === "ALL" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Tous
            </button>
            {isImmo ? (
              <>
                <button
                  onClick={() => setFilter("RENT_INCOME")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5 ${filter === "RENT_INCOME" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-gray-400 hover:text-white"}`}
                >
                  <Home size={14} />
                  <span>Loyers Habitation</span>
                </button>
                <button
                  onClick={() => setFilter("HOTEL_INCOME")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5 ${filter === "HOTEL_INCOME" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-400 hover:text-white"}`}
                >
                  <Hotel size={14} />
                  <span>Recettes Hôtellerie</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setFilter("INCOME")}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${filter === "INCOME" ? "bg-green-500/20 text-green-400" : "text-gray-400 hover:text-white"}`}
              >
                Entrées (Ventes)
              </button>
            )}
            {!isImmo && (
              <button
                onClick={() => setFilter("PAYOUT")}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${filter === "PAYOUT" ? "bg-blue-500/20 text-blue-400" : "text-gray-400 hover:text-white"}`}
              >
                Paiements Livreurs
              </button>
            )}
            <button
              onClick={() => setFilter("EXPENSE")}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${filter === "EXPENSE" ? "bg-red-500/20 text-red-400" : "text-gray-400 hover:text-white"}`}
            >
              Dépenses
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-black/20 text-gray-400">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Branche / Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Référence</th>
                <th className="px-6 py-4 text-right">Montant (USD)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Chargement...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Aucune transaction trouvée.</td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const isHotel = t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel");
                  const isRent = t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_");

                  return (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {t.type === "INCOME" && (
                          isHotel ? (
                            <span className="inline-flex items-center text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded text-xs font-semibold">
                              <Hotel size={12} className="mr-1"/> Hôtellerie
                            </span>
                          ) : isRent ? (
                            <span className="inline-flex items-center text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded text-xs font-semibold">
                              <Home size={12} className="mr-1"/> Habitation
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-green-400 bg-green-400/10 px-2.5 py-1 rounded text-xs">
                              <ArrowDownRight size={12} className="mr-1"/> Entrée
                            </span>
                          )
                        )}
                        {t.type === "PAYOUT" && <span className="inline-flex items-center text-blue-400 bg-blue-400/10 px-2 py-1 rounded text-xs"><ArrowUpRight size={12} className="mr-1"/> Retrait</span>}
                        {t.type === "EXPENSE" && <span className="inline-flex items-center text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs"><ArrowUpRight size={12} className="mr-1"/> Sortie {t.category ? `(${t.category})` : ''}</span>}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">{t.description}</td>
                      <td className="px-6 py-4 text-gray-400">{t.referenceId || "-"}</td>
                      <td className={`px-6 py-4 text-right font-bold ${t.type === 'INCOME' ? 'text-green-400' : 'text-white'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}${t.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Transaction */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">Nouvelle Opération</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Type d'opération</label>
                  <select 
                    value={txType}
                    onChange={(e: any) => setTxType(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  >
                    {!isImmo && <option value="INCOME">Entrée (Vente produit/service)</option>}
                    {isImmo && <option value="RENT_INCOME">🏠 Paiement Loyer (Habitation)</option>}
                    {isImmo && <option value="HOTEL_INCOME">🏨 Recette Hôtelière (Séjour / Nuitée)</option>}
                    {isImmo && <option value="INCOME">Entrée Générique</option>}
                    {!isImmo && <option value="PAYOUT">Paiement d'un Livreur</option>}
                    <option value="EXPENSE">Dépense (Entretien, Stock, Factures...)</option>
                  </select>
                </div>

                {txType === "RENT_INCOME" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Locataire</label>
                    <select 
                      required
                      value={selectedTenantId}
                      onChange={(e) => {
                        setSelectedTenantId(e.target.value);
                        const t = tenants.find(x => x.id === e.target.value);
                        if (t) setAmount(t.rentAmount || "");
                      }}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    >
                      <option value="">Sélectionnez un locataire...</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.firstName} {t.lastName} - {t.propertyTitle}</option>
                      ))}
                    </select>
                  </div>
                )}

                {txType === "HOTEL_INCOME" && (
                  <div className="space-y-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Hotel size={13} /> Détails de la réservation hôtelière
                    </div>
                    <div>
                      <label className="text-xs text-gray-300 block mb-1">Nom du client / Voyageur</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Jean Marc"
                        value={hotelGuestName}
                        onChange={(e) => setHotelGuestName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-300 block mb-1">Chambre ou Suite</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Suite Exécutive #102"
                        value={hotelRoom}
                        onChange={(e) => setHotelRoom(e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-300 block mb-1">Nuitées</label>
                        <input
                          type="number"
                          min="1"
                          value={hotelNights}
                          onChange={(e) => {
                            const n = parseInt(e.target.value) || 1;
                            setHotelNights(n);
                            if (hotelNightlyRate) {
                              setAmount((n * parseFloat(hotelNightlyRate)).toFixed(2));
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-300 block mb-1">Tarif / nuit ($)</label>
                        <input
                          type="number"
                          placeholder="Ex: 100"
                          value={hotelNightlyRate}
                          onChange={(e) => {
                            setHotelNightlyRate(e.target.value);
                            const r = parseFloat(e.target.value) || 0;
                            setAmount((hotelNights * r).toFixed(2));
                          }}
                          className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {txType === "EXPENSE" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Catégorie de la dépense</label>
                    <select 
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    >
                      {isImmo ? (
                        <>
                          <option value="Entretien">Entretien & Nettoyage</option>
                          <option value="Maintenance">Maintenance & Réparations</option>
                          <option value="Groupe Electrogene">Groupe Électrogène & Carburant</option>
                          <option value="Blanchisserie">Blanchisserie & Lingerie</option>
                          <option value="Eau & Electricite">Eau & Électricité</option>
                          <option value="Taxes">Taxes / Tourisme / Impôts</option>
                          <option value="Commissions">Commissions / Salaires</option>
                          <option value="Autre (Immo/Hotel)">Autre</option>
                        </>
                      ) : (
                        <>
                          <option value="Loyer">Loyer / Factures</option>
                          <option value="Salaires">Salaires</option>
                          <option value="Logistique">Logistique / Transport</option>
                          <option value="Achats">Achats Marchandises</option>
                          <option value="Marketing">Publicité / Marketing</option>
                          <option value="Autre">Autre</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Montant (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    placeholder="ex: 150.00"
                  />
                </div>

                {txType !== "RENT_INCOME" && txType !== "HOTEL_INCOME" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Description</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      placeholder={isImmo ? "ex: Réparation climatisation" : "ex: Vente de 3 articles"}
                    />
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Référence (Optionnel)</label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    placeholder={txType === "RENT_INCOME" ? "Mois payé (ex: Loyer Mars 2026)" : (txType === "HOTEL_INCOME" ? "Dates séjour (ex: 12-15 Sept)" : "N° Facture / Reçu")}
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center disabled:opacity-50"
                  >
                    {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Ajustement de Caisse Magasin */}
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
                    Ajustement de Caisse Magasin
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Solde trésorerie actuel : <strong>${balance.toFixed(2)}</strong>
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
                    placeholder="ex: 25.00"
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Motif obligatoire *</label>
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
                  <label className="text-gray-300 font-semibold block mb-1">Libellé explicatif *</label>
                  <input
                    type="text"
                    required
                    value={adjLabel}
                    onChange={(e) => setAdjLabel(e.target.value)}
                    placeholder="ex: Régularisation suite à écart d'inventaire"
                    className="w-full px-3.5 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Pièce justificative (Optionnel)</label>
                  <input
                    type="text"
                    value={adjRef}
                    onChange={(e) => setAdjRef(e.target.value)}
                    placeholder="ex: REC-CAISSE-001"
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
                    {isSubmittingAdj ? "Enregistrement..." : "Valider l'Ajustement"}
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
