"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search, Home, Hotel, Sparkles, Sliders, ShieldAlert, CheckCircle, Lock, Clock, Phone, Loader2, Calendar, TrendingUp, Landmark } from "lucide-react";
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
  capital?: number;
  profit?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  currency: string;
  description: string;
  referenceId?: string;
  orderId?: string;
  status: "COMPLETED" | "PENDING" | "PENDING_HANDOVER";
  isPendingHandover?: boolean;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
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
  const [periodFilter, setPeriodFilter] = useState<"today" | "yesterday" | "last7days" | "this_month" | "all" | "custom">("today");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [calendarStartDate, setCalendarStartDate] = useState<string>("");
  const [calendarEndDate, setCalendarEndDate] = useState<string>("");
  const [showRangePicker, setShowRangePicker] = useState<boolean>(false);
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

  // État des encaissements en attente chez les livreurs
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);
  const [clearingOrderId, setClearingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !userData || (userData.role !== "SUPPLIER" && userData.role !== "supplier" && userData.role !== "SUPPLIER_IMMO" && userData.role !== "supplier_immo" && userData.role !== "SUB_SUPPLIER"))) {
      router.push("/");
      return;
    }

    if (user) {
      // Synchronisation de sécurité : Période d'essai officielle stricte de 15 jours (gérée par l'admin)
      if (
        userData?.subscriptionStatus === "TRIAL" && 
        !userData?.adminCustomTrial && 
        userData?.createdAt &&
        activeSupplierId
      ) {
        try {
          const created = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
          const maxTrialEnd = new Date(created);
          maxTrialEnd.setDate(maxTrialEnd.getDate() + 15);
          const currentEnd = userData.subscriptionEndDate?.toDate 
            ? userData.subscriptionEndDate.toDate() 
            : (userData.subscriptionEndDate ? new Date(userData.subscriptionEndDate) : null);
          
          if (!currentEnd || currentEnd.getTime() > maxTrialEnd.getTime() + 86400000) {
            updateDoc(doc(db, "users", activeSupplierId), {
              subscriptionEndDate: maxTrialEnd,
              trialPeriodDays: 15
            }).catch(e => console.warn("Sync trial end date:", e));
          }
        } catch (e) {
          console.warn("Error auto-syncing trial:", e);
        }
      }

      // 1. Fetch transactions (Livre de Caisse & Opérations)
      const qTx = query(
        collection(db, "supplier_transactions"), 
        where("supplierId", "==", activeSupplierId),
        limit(100)
      );
      
      let manualTx: Transaction[] = [];
      let automaticTx: Transaction[] = [];

      const updateCombined = () => {
        // Collecter les identifiants de commandes déjà enregistrés manuellement ou via l'API confirm-delivery
        const recordedOrderIds = new Set<string>();
        manualTx.forEach(m => {
          if (m.orderId) recordedOrderIds.add(m.orderId);
          if (m.referenceId) recordedOrderIds.add(m.referenceId);
        });

        // Filtrer les transactions automatiques pour éviter TOUT doublon
        const deduplicatedAuto = automaticTx.filter(a => {
          const id = a.referenceId || a.orderId || "";
          return !recordedOrderIds.has(id);
        });

        const combined = [...manualTx, ...deduplicatedAuto].sort((a, b) => {
          const tA = a.createdAt?.seconds || (a.createdAt?.toDate ? a.createdAt.toDate().getTime() / 1000 : 0);
          const tB = b.createdAt?.seconds || (b.createdAt?.toDate ? b.createdAt.toDate().getTime() / 1000 : 0);
          return tB - tA;
        });

        setTransactions(combined);

        // Agréger la liste des fonds détenus par les livreurs en attente de versement
        const handoversMap = new Map<string, any>();

        manualTx.forEach(m => {
          if (m.isPendingHandover || m.status === "PENDING_HANDOVER") {
            const oId = m.orderId || m.referenceId || m.id;
            handoversMap.set(oId, {
              orderId: oId,
              orderNumber: oId.slice(0, 8).toUpperCase(),
              driverName: m.driverName || "Livreur",
              driverPhone: m.driverPhone || "",
              amount: m.amount,
              description: m.description,
              collectedAt: m.createdAt,
            });
          }
        });

        deduplicatedAuto.forEach(a => {
          if (a.isPendingHandover || a.status === "PENDING_HANDOVER") {
            const oId = a.referenceId || a.orderId || a.id;
            if (!handoversMap.has(oId)) {
              handoversMap.set(oId, {
                orderId: oId,
                orderNumber: oId.slice(0, 8).toUpperCase(),
                driverName: a.driverName || "Livreur",
                driverPhone: a.driverPhone || "",
                amount: a.amount,
                description: a.description,
                collectedAt: a.createdAt,
              });
            }
          }
        });

        setPendingHandovers(Array.from(handoversMap.values()));
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
        // Fetch orders for regular E-commerce sans orderBy composite pour éviter les erreurs d'index
        const qOrders = query(
          collection(db, "orders"),
          where("supplierIds", "array-contains", activeSupplierId),
          limit(100)
        );
        unsubAutomatic = onSnapshot(qOrders, (snapshot) => {
          const data: Transaction[] = [];
          snapshot.forEach((doc) => {
            const order = doc.data();
            const status = (order.status || "").toUpperCase();
            const paymentStatus = (order.paymentStatus || "").toUpperCase();
            const isDelivered = status === "COMPLETED" || status === "LIVRÉE" || status === "DELIVERED";
            
            // Vérifier si les espèces sont chez le livreur et pas encore remises en magasin
            const isCashWithDriver = (paymentStatus === "COLLECTED_BY_DRIVER" || order.cashCollectedByDriver === true) && !order.cashHandedOverToSupplier;

            if (isDelivered || isCashWithDriver) {
              const myItems = order.items?.filter((item: any) => item.supplierId === activeSupplierId) || [];
              const myTotal = myItems.reduce((acc: number, item: any) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
              const myCapital = myItems.reduce((acc: number, item: any) => {
                const c = item.costOfGoodsSold !== undefined 
                  ? Number(item.costOfGoodsSold) 
                  : ((Number(item.purchasePrice) || 0) * (Number(item.quantity) || 1));
                return acc + c;
              }, 0);
              const myProfit = myItems.reduce((acc: number, item: any) => {
                const p = item.grossProfit !== undefined 
                  ? Number(item.grossProfit) 
                  : (((Number(item.price) || 0) - (Number(item.purchasePrice) || 0)) * (Number(item.quantity) || 1));
                return acc + p;
              }, 0);
              const productNames = myItems.map((item: any) => item.productName || item.name || "Produit").join(", ");
              
              if (myTotal > 0) {
                data.push({
                  id: `order_${doc.id}`,
                  type: "INCOME",
                  category: isCashWithDriver ? "Vente Livrée (Espèces Livreur)" : "Vente",
                  amount: myTotal,
                  capital: myCapital,
                  profit: myProfit > 0 ? myProfit : Math.max(0, myTotal - myCapital),
                  currency: "USD",
                  description: isCashWithDriver 
                    ? `Commande #${doc.id.slice(0, 6).toUpperCase()} (${productNames}) - Espèces chez le livreur`
                    : `Commande #${doc.id.slice(0, 6).toUpperCase()} (${productNames})`,
                  referenceId: doc.id,
                  orderId: doc.id,
                  status: isCashWithDriver ? "PENDING_HANDOVER" : "COMPLETED",
                  isPendingHandover: isCashWithDriver,
                  driverName: order.collectedByDriverName || order.driverName || "Livreur",
                  driverPhone: order.collectedByDriverPhone || order.driverPhone || "",
                  createdAt: order.deliveredAt || order.createdAt,
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

  const handleClearCash = async (orderId: string) => {
    if (!orderId || !activeSupplierId) return;
    if (!confirm("Confirmez-vous avoir reçu la remise des espèces de cette livraison de la part du livreur ?\n\nCette somme sera immédiatement intégrée à votre livre de caisse magasin.")) {
      return;
    }

    setClearingOrderId(orderId);
    try {
      const res = await fetch("/api/orders/clear-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          supplierId: activeSupplierId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la validation en caisse.");
      }

      setFinanceNotice("✅ Espèces remises par le livreur validées et intégrées à votre caisse magasin avec succès !");
      setTimeout(() => setFinanceNotice(""), 6000);
    } catch (err: any) {
      console.error("Error clearing cash:", err);
      alert(err.message || "Impossible de valider la réception en caisse.");
    } finally {
      setClearingOrderId(null);
    }
  };

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

  // Trésorerie globale Caisse Magasin (Disponible physiquement en boutique)
  const totalIncomeAllTime = transactions.filter(t => t.type === "INCOME").reduce((acc, t) => acc + t.amount, 0);
  const totalPayoutAllTime = transactions.filter(t => t.type === "PAYOUT" || t.type === "EXPENSE").reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncomeAllTime - totalPayoutAllTime;
  const globalBalance = balance;

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

  const getTxTimestamp = (t: any): number => {
    if (!t.createdAt) return 0;
    if (t.createdAt.toMillis) return t.createdAt.toMillis();
    if (t.createdAt.toDate) return t.createdAt.toDate().getTime();
    if (t.createdAt.seconds) return t.createdAt.seconds * 1000;
    if (typeof t.createdAt === "number") return t.createdAt;
    const parsed = new Date(t.createdAt).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const isTxInPeriod = (t: any, period: "today" | "yesterday" | "last7days" | "this_month" | "all" | "custom"): boolean => {
    if (period === "all") return true;
    const time = getTxTimestamp(t);
    if (!time) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    if (period === "today") {
      return time >= startOfToday;
    }
    if (period === "yesterday") {
      return time >= startOfYesterday && time < startOfToday;
    }
    if (period === "last7days") {
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return time >= sevenDaysAgo;
    }
    if (period === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return time >= startOfMonth;
    }
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

  const filteredTransactions = transactions.filter(t => {
    // 1. Filtrer par période temporelle
    if (!isTxInPeriod(t, periodFilter)) return false;

    // 2. Filtrer par type / branche
    if (filter === "RENT_INCOME") {
      const isRent = t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_");
      if (!isRent) return false;
    } else if (filter === "HOTEL_INCOME") {
      const isHotel = t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel");
      if (!isHotel) return false;
    } else if (filter === "PENDING_HANDOVER") {
      if (!t.isPendingHandover && t.status !== "PENDING_HANDOVER") return false;
    } else if (filter !== "ALL" && t.type !== filter) {
      return false;
    }
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !(t.referenceId || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCashTotal = pendingHandovers.reduce((acc, h) => acc + (Number(h.amount) || 0), 0);
  const storeAvailableBalance = Math.max(0, globalBalance - pendingCashTotal);

  // Indicateurs spécifiques à la période sélectionnée (par défaut: Journalier 24h)
  const periodTransactions = transactions.filter(t => isTxInPeriod(t, periodFilter));
  const periodIncome = periodTransactions.filter(t => t.type === "INCOME").reduce((acc, t) => acc + t.amount, 0);
  const periodPayout = periodTransactions.filter(t => t.type === "PAYOUT" || t.type === "EXPENSE").reduce((acc, t) => acc + t.amount, 0);

  // Capital Récupéré (Prix d'achat des produits vendus sur la période)
  const periodCapital = periodTransactions.filter(t => t.type === "INCOME").reduce((acc, t) => {
    const c = t.capital !== undefined ? Number(t.capital) : (t.costOfGoodsSold !== undefined ? Number(t.costOfGoodsSold) : 0);
    return acc + c;
  }, 0);

  // Intérêts Réalisés / Bénéfice net (Revenus de la période - Capital investi)
  const periodNetProfit = periodTransactions.filter(t => t.type === "INCOME").reduce((acc, t) => {
    if (t.profit !== undefined && Number(t.profit) >= 0) return acc + Number(t.profit);
    const c = t.capital !== undefined ? Number(t.capital) : (t.costOfGoodsSold !== undefined ? Number(t.costOfGoodsSold) : 0);
    return acc + Math.max(0, t.amount - c);
  }, 0);

  const totalHabitationIncome = periodTransactions
    .filter(t => t.type === "INCOME" && (t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_")))
    .reduce((acc, t) => acc + t.amount, 0);
  const totalHotelIncome = periodTransactions
    .filter(t => t.type === "INCOME" && (t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel")))
    .reduce((acc, t) => acc + t.amount, 0);

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
                {subscriptionInfo.isBlocked 
                  ? "Compte Suspendu : Dépôt Mensuel Attendu ($50)" 
                  : subscriptionInfo.isTrial 
                  ? `Période d'essai active : ${subscriptionInfo.daysLeft} jour${subscriptionInfo.daysLeft > 1 ? "s" : ""} restant${subscriptionInfo.daysLeft > 1 ? "s" : ""}` 
                  : "Abonnement Partenaire Rayons.net Actif"}
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                {subscriptionInfo.isBlocked 
                  ? "Le délai est dépassé. Régularisez votre dépôt pour débloquer la publication de vos articles et la messagerie client." 
                  : subscriptionInfo.isTrial 
                  ? `Échéance du premier dépôt le ${subscriptionInfo.formattedDueDate}. Période d'essai de 15 jours gérée par l'administration.` 
                  : `Votre compte est en règle jusqu'au ${subscriptionInfo.formattedDueDate}.`}
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={handlePayDeposit}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
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

      {/* Sélecteur de Date Comptable Épuré : Calendrier & Aujourd'hui (24h) */}
      <div className="bg-[#0B0F17]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/15 text-primary-light rounded-xl shrink-0 border border-primary/20">
            <Calendar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                Période Comptable : <span className="text-primary-light">{getPeriodLabel()}</span>
              </h3>
              {periodFilter === "today" ? (
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Journalier (24h en direct)
                </span>
              ) : (
                <span className="text-[11px] bg-primary/20 text-primary-light border border-primary/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  📅 Date sélectionnée
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {periodFilter === "today" 
                ? "Écritures des dernières 24h. Choisissez une date précise au calendrier pour consulter une autre journée."
                : `Comptabilité filtrée pour : ${getPeriodLabel()}.`}
            </p>
          </div>
        </div>

        {/* Contrôles Calendrier & Reset Aujourd'hui */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-start md:justify-end">
          <div className="flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5">
            <span className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
              <Calendar size={14} className="text-primary-light" />
              <span className="hidden sm:inline">Choisir une date :</span>
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
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            />
          </div>

          {periodFilter === "custom" ? (
            <button
              type="button"
              onClick={() => {
                setPeriodFilter("today");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
                setShowRangePicker(false);
              }}
              className="text-xs bg-primary hover:bg-primary-light text-gray-950 font-bold px-3 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡ Revenir à Aujourd'hui (24h)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPeriodFilter("today");
                setSelectedCalendarDate("");
              }}
              className="text-xs bg-primary/20 text-primary-light font-bold px-3 py-2 rounded-xl border border-primary/30 flex items-center gap-1.5"
            >
              <span>⚡ Aujourd'hui (24h)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRangePicker(!showRangePicker)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
            title="Plage de dates (Du / Au)"
          >
            {showRangePicker ? "▾ Masquer plage" : "▸ Plage"}
          </button>
        </div>

        {/* Plage personnalisée si dépliée */}
        {showRangePicker && (
          <div className="w-full pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs animate-fade-in">
            <span className="text-gray-400 font-semibold">Plage personnalisée :</span>
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
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {isImmo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-xs font-semibold uppercase">Caisse Magasin (Dispo)</h3>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Wallet className="text-blue-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">${storeAvailableBalance.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Fonds physiques en caisse</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-emerald-300 text-xs font-semibold uppercase">🏠 Loyers Habitation</h3>
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Home className="text-emerald-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-3">${totalHabitationIncome.toFixed(2)}</p>
            <p className="text-[11px] text-emerald-300/70 mt-1">{getPeriodLabel()}</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-amber-300 text-xs font-semibold uppercase">🏨 Hôtellerie</h3>
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Hotel className="text-amber-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-3">${totalHotelIncome.toFixed(2)}</p>
            <p className="text-[11px] text-amber-300/70 mt-1">{getPeriodLabel()}</p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-red-300 text-xs font-semibold uppercase">Dépenses & Charges</h3>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <ArrowUpRight className="text-red-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-400 mt-3">${periodPayout.toFixed(2)}</p>
            <p className="text-[11px] text-red-300/70 mt-1">{getPeriodLabel()}</p>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-indigo-300 text-xs font-semibold uppercase">Capital Récupéré</h3>
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Landmark className="text-indigo-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-indigo-400 mt-3">${periodCapital.toFixed(2)}</p>
            <p className="text-[11px] text-indigo-300/70 mt-1">Investissement amorti</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-emerald-300 text-xs font-semibold uppercase">Intérêts (Bénéfice)</h3>
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="text-emerald-400" size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-3">+${periodNetProfit.toFixed(2)}</p>
            <p className="text-[11px] text-emerald-300/70 mt-1">Marge nette {getPeriodLabel()}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* 1. Caisse Magasin Disponible */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-xs font-semibold uppercase">Caisse Magasin</h3>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Wallet className="text-blue-400" size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-3">${storeAvailableBalance.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Cash physique disponible</p>
          </div>

          {/* 2. Chez les Livreurs */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-amber-300 text-xs font-semibold uppercase">Chez les Livreurs</h3>
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="text-amber-400 animate-pulse" size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-amber-400 mt-3">${pendingCashTotal.toFixed(2)}</p>
            <p className="text-[11px] text-amber-300/80 mt-1">{pendingHandovers.length} course(s) en attente</p>
          </div>
          
          {/* 3. Revenus Réalisés Période */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-xs font-semibold uppercase">Revenus ({getPeriodLabel()})</h3>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <ArrowDownRight className="text-green-400" size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-3">${periodIncome.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Entrées de la période</p>
          </div>

          {/* 4. Dépenses Période */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-400 text-xs font-semibold uppercase">Dépenses ({getPeriodLabel()})</h3>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <ArrowUpRight className="text-red-400" size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-3">${periodPayout.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Sorties & charges</p>
          </div>

          {/* 5. Capital Récupéré (Prix d'achat des produits vendus) */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-indigo-300 text-xs font-semibold uppercase">Capital Récupéré</h3>
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Landmark className="text-indigo-400" size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-indigo-400 mt-3">${periodCapital.toFixed(2)}</p>
            <p className="text-[11px] text-indigo-300/80 mt-1">Capital investi amorti</p>
          </div>

          {/* 6. Intérêts Réalisés (Marge nette) */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-emerald-300 text-xs font-semibold uppercase">Intérêts (Bénéfice)</h3>
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="text-emerald-400" size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-3">+${periodNetProfit.toFixed(2)}</p>
            <p className="text-[11px] text-emerald-300/80 mt-1">Marge nette {getPeriodLabel()}</p>
          </div>
        </div>
      )}

      {/* Bannière interactive des fonds chez les livreurs */}
      {pendingHandovers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                <Clock size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Fonds Encaissés par les Livreurs en Attente de Caisse</span>
                  <span className="bg-amber-500/30 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-500/40">
                    {pendingHandovers.length} commande(s)
                  </span>
                </h3>
                <p className="text-xs text-amber-200/80">
                  Ces sommes ont été payées en espèces par les clients à la livraison. Cliquez sur "Valider la réception" dès que le livreur vous remet l'argent en boutique pour l'intégrer au livre de caisse.
                </p>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-[11px] text-amber-300/80 uppercase font-bold tracking-wider">Total à reverser</span>
              <p className="text-2xl font-black text-amber-400">${pendingCashTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingHandovers.map((item) => (
              <div key={item.orderId} className="bg-black/40 border border-amber-500/25 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Commande #{item.orderNumber}</span>
                    <p className="text-sm font-semibold text-white mt-0.5 line-clamp-1">{item.description || "Articles livrés"}</p>
                  </div>
                  <span className="text-lg font-black text-emerald-400">${Number(item.amount || 0).toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-300 bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Livreur détenteur</p>
                    <p className="font-bold text-white">{item.driverName || "Livreur"}</p>
                  </div>
                  {item.driverPhone && (
                    <a
                      href={`tel:${item.driverPhone}`}
                      className="flex items-center space-x-1 text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Phone size={12} />
                      <span>{item.driverPhone}</span>
                    </a>
                  )}
                </div>

                <button
                  onClick={() => handleClearCash(item.orderId)}
                  disabled={clearingOrderId === item.orderId}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {clearingOrderId === item.orderId ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Enregistrement en caisse...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span>Valider la réception en caisse</span>
                    </>
                  )}
                </button>
              </div>
            ))}
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
              <>
                <button
                  onClick={() => setFilter("INCOME")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${filter === "INCOME" ? "bg-green-500/20 text-green-400" : "text-gray-400 hover:text-white"}`}
                >
                  Entrées (Ventes)
                </button>
                <button
                  onClick={() => setFilter("PENDING_HANDOVER")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5 ${filter === "PENDING_HANDOVER" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-white"}`}
                >
                  <Clock size={14} />
                  <span>Chez les Livreurs {pendingHandovers.length > 0 ? `(${pendingHandovers.length})` : ''}</span>
                </button>
              </>
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
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    <p className="font-semibold text-white">Aucune opération pour : {getPeriodLabel()}</p>
                    {periodFilter === "today" ? (
                      <p className="text-xs text-gray-400 mt-1">
                        Les transactions de plus de 24h sont automatiquement archivées dans l'historique.<br />
                        Pour les consulter, sélectionnez <strong className="text-white">"Hier"</strong>, <strong className="text-white">"7 derniers jours"</strong> ou <strong className="text-white">"Tout l'historique"</strong> dans la barre de période ci-dessus.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Aucune transaction ne correspond à cette période ou à vos filtres.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const isHotel = t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel");
                  const isRent = t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_");
                  const isPending = t.isPendingHandover || t.status === "PENDING_HANDOVER";

                  return (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {isPending ? (
                          <span className="inline-flex items-center text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded text-xs font-semibold">
                            <Clock size={12} className="mr-1"/> Chez le Livreur
                          </span>
                        ) : t.type === "INCOME" ? (
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
                              <ArrowDownRight size={12} className="mr-1"/> Entrée Caisse
                            </span>
                          )
                        ) : t.type === "PAYOUT" ? (
                          <span className="inline-flex items-center text-blue-400 bg-blue-400/10 px-2 py-1 rounded text-xs"><ArrowUpRight size={12} className="mr-1"/> Retrait</span>
                        ) : (
                          <span className="inline-flex items-center text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs"><ArrowUpRight size={12} className="mr-1"/> Sortie {t.category ? `(${t.category})` : ''}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{t.description}</span>
                          {isPending && (
                            <button
                              onClick={() => handleClearCash(t.orderId || t.referenceId || t.id)}
                              disabled={clearingOrderId === (t.orderId || t.referenceId || t.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg transition-colors"
                            >
                              {clearingOrderId === (t.orderId || t.referenceId || t.id) ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Validation...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={12} />
                                  <span>Valider Réception</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{t.referenceId || "-"}</td>
                      <td className={`px-6 py-4 text-right font-bold ${
                        isPending 
                          ? 'text-amber-400' 
                          : t.type === 'INCOME' 
                          ? 'text-green-400' 
                          : 'text-white'
                      }`}>
                        <div>
                          <div>{t.type === 'INCOME' ? '+' : '-'}${t.amount.toFixed(2)}</div>
                          {t.type === 'INCOME' && (Number(t.capital) > 0 || Number(t.profit) > 0) && (
                            <div className="flex flex-col text-[10px] font-normal mt-0.5 text-right">
                              <span className="text-gray-400">Capital: ${Number(t.capital || 0).toFixed(2)}</span>
                              <span className="text-emerald-400 font-semibold">Intérêt: +${Number(t.profit !== undefined ? t.profit : (t.amount - (t.capital || 0))).toFixed(2)}</span>
                            </div>
                          )}
                          {isPending && (
                            <span className="block text-[10px] text-amber-300/80 font-normal">
                              en attente caisse
                            </span>
                          )}
                        </div>
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
