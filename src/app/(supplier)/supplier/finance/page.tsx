"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, X, Search, Home, Hotel, Sparkles, Sliders, ShieldAlert, CheckCircle, Clock, Phone, Loader2, Calendar, TrendingUp, Landmark } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, doc, updateDoc, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getSupplierType } from "@/lib/permissions";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";
import { ADJUSTMENT_REASONS, recordCashAdjustment, recordSubscriptionDeposit, recordRentPayment } from "@/lib/accountingLedger";

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
          limit(300)
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
        if (!tenant) {
          alert("Locataire introuvable");
          setIsSubmitting(false);
          return;
        }

        const clientName = tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || "Locataire";
        const propertyName = tenant.propertyName || tenant.propertyTitle || "Propriété";
        const unitName = tenant.unitName || tenant.unitTitle || null;
        const refStr = referenceId || `Loyer ${new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;

        // 1. Ajouter le paiement dans la collection 'payments'
        await addDoc(collection(db, "payments"), {
          supplierId: activeSupplierId,
          tenantId: tenant.id,
          clientName: clientName,
          tenantName: clientName,
          propertyId: tenant.propertyId || null,
          propertyName: propertyName,
          propertyTitle: propertyName,
          unitId: tenant.unitId || null,
          unitTitle: unitName,
          unitName: unitName,
          amount: Number(amount),
          currency: "USD",
          status: "COMPLETED",
          createdAt: serverTimestamp(),
          createdBy: activeSupplierId,
          reference: refStr,
        });

        // 1b. Écriture comptable dans le grand livre
        try {
          await recordRentPayment({
            supplierId: activeSupplierId!,
            supplierName: userData?.companyName || userData?.name || "Agence Immobilière",
            tenantId: tenant.id,
            tenantName: clientName,
            propertyId: tenant.propertyId || "",
            propertyName: propertyName,
            unitName: unitName || undefined,
            amount: Number(amount),
            currency: "USD",
            reference: refStr,
            periodicity: tenant.periodicity || "Mensuel",
          });
        } catch (ledgerErr) {
          console.warn("Écriture comptable loyer non enregistrée (non bloquant) :", ledgerErr);
        }

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
    const baseAmount = userData?.depositAmount || 50;
    const pendingDiscount = Number(userData?.referralDiscountPending) || 0;
    const effectiveToPay = Math.max(0, baseAmount - pendingDiscount);

    const discountMsg = pendingDiscount > 0
      ? `\n\n🎉 Réduction de parrainage appliquée : -$${pendingDiscount} USD !\nMontant effectif à régler : $${effectiveToPay} USD au lieu de $${baseAmount} USD.`
      : "";

    if (!confirm(`Confirmez-vous le paiement de votre dépôt mensuel de $${effectiveToPay} ?${discountMsg}\n\nCette action débloquera instantanément votre compte pour 30 jours supplémentaires.`)) {
      return;
    }
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/supplier/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplierId: activeSupplierId,
          supplierName: userData?.displayName || userData?.company || "Partenaire",
          supplierEmail: user?.email || "",
          amount: baseAmount,
          currency: "USD",
          paymentMethod: "Paiement direct en ligne",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du paiement du dépôt.");
      }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">Livre de Caisse & Trésorerie</h1>
            <span className="px-2 py-0.5 bg-white/5 text-gray-400 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-widest">
              {isImmo ? "Immobilier & Hôtellerie" : "E-commerce"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isImmo
              ? "Gestion des encaissements de loyers d'habitation, nuitées hôtelières et dépenses"
              : "Suivi des ventes, encaissements livreurs et trésorerie physique disponible"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAdjustmentModalOpen(true)}
            className="flex items-center gap-1.5 bg-white/4 hover:bg-white/8 border border-white/8 text-gray-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
          >
            <Sliders size={14} />
            <span>Ajustement</span>
          </button>

          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 bg-white/4 hover:bg-white/8 border border-white/8 text-gray-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
          >
            <Download size={14} />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] px-4 py-2 rounded-lg text-xs font-bold transition-all"
          >
            <Plus size={14} />
            <span>Nouvelle Opération</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {financeNotice && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-[#C7D300]/8 border border-[#C7D300]/20 rounded-xl flex items-center gap-3 text-[#C7D300] text-xs font-semibold"
        >
          <CheckCircle size={16} className="shrink-0" />
          <span>{financeNotice}</span>
        </motion.div>
      )}

      {/* Boutique Officielle Admin (si applicable) */}
      {(userData?.isOfficialAdminStore || userData?.isAdminSupplier) && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-white/5 text-gray-300 shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="font-bold text-xs text-white flex items-center gap-2">
                <span>Boutique Officielle Rayons</span>
                <span className="text-[10px] bg-[#C7D300]/10 text-[#C7D300] border border-[#C7D300]/20 px-2 py-0.5 rounded font-bold uppercase">
                  Admin
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Ce compte est dispensé de frais de tenue de compte. Toutes vos recettes sont consolidées dans la comptabilité centrale.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-semibold px-2.5 py-1 bg-white/5 text-gray-400 border border-white/8 rounded-lg shrink-0">
            Exempté de dépôt
          </div>
        </div>
      )}

      {/* Sélecteur de Période Comptable */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 text-gray-400 rounded-lg shrink-0">
            <Calendar size={16} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Période comptable</p>
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

        {/* Contrôles Calendrier */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
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
              onClick={() => {
                setPeriodFilter("today");
                setSelectedCalendarDate("");
                setCalendarStartDate("");
                setCalendarEndDate("");
                setShowRangePicker(false);
              }}
              className="text-xs bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              Aujourd&apos;hui
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPeriodFilter("today");
                setSelectedCalendarDate("");
              }}
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
              <input
                type="date"
                value={calendarStartDate}
                onChange={(e) => {
                  setCalendarStartDate(e.target.value);
                  setSelectedCalendarDate("");
                  setPeriodFilter("custom");
                }}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Au</span>
              <input
                type="date"
                value={calendarEndDate}
                onChange={(e) => {
                  setCalendarEndDate(e.target.value);
                  setSelectedCalendarDate("");
                  setPeriodFilter("custom");
                }}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards — Palette Monochromatique Épurée */}
      {isImmo ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {[
            { label: "Caisse Magasin", value: `$${storeAvailableBalance.toFixed(2)}`, sub: "Cash disponible", icon: <Wallet size={14} />, accent: true },
            { label: "Loyers Habitation", value: `$${totalHabitationIncome.toFixed(2)}`, sub: getPeriodLabel(), icon: <Home size={14} />, accent: false },
            { label: "Hôtellerie", value: `$${totalHotelIncome.toFixed(2)}`, sub: getPeriodLabel(), icon: <Hotel size={14} />, accent: false },
            { label: "Charges & Dépenses", value: `$${periodPayout.toFixed(2)}`, sub: getPeriodLabel(), icon: <ArrowUpRight size={14} />, accent: false, negative: true },
            { label: "Capital Récupéré", value: `$${periodCapital.toFixed(2)}`, sub: "Investissement amorti", icon: <Landmark size={14} />, accent: false },
            { label: "Marge Nette", value: `+$${periodNetProfit.toFixed(2)}`, sub: "Bénéfice net", icon: <TrendingUp size={14} />, accent: false, positive: true },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white/3 border border-white/8 rounded-xl p-3 sm:p-4 flex flex-col justify-between gap-2 sm:gap-3 min-h-[95px] sm:min-h-[110px]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider truncate">{kpi.label}</p>
                <span className={`p-1 sm:p-1.5 rounded-md shrink-0 ${kpi.accent ? "bg-[#C7D300]/10 text-[#C7D300]" : "bg-white/5 text-gray-500"}`}>
                  {kpi.icon}
                </span>
              </div>
              <p className={`text-base sm:text-xl font-black tabular-nums truncate ${kpi.negative ? "text-rose-400" : kpi.positive ? "text-emerald-400" : kpi.accent ? "text-[#C7D300]" : "text-white"}`}>
                {kpi.value}
              </p>
              <p className="text-[10px] text-gray-600 truncate">{kpi.sub}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {[
            { label: "Caisse Magasin", value: `$${storeAvailableBalance.toFixed(2)}`, sub: "Cash disponible", icon: <Wallet size={14} />, accent: true },
            { label: "Chez Livreurs", value: `$${pendingCashTotal.toFixed(2)}`, sub: `${pendingHandovers.length} course(s)`, icon: <Clock size={14} />, accent: pendingHandovers.length > 0, pending: true },
            { label: "Revenus Ventes", value: `$${periodIncome.toFixed(2)}`, sub: getPeriodLabel(), icon: <ArrowDownRight size={14} />, accent: false },
            { label: "Dépenses / Sorties", value: `$${periodPayout.toFixed(2)}`, sub: getPeriodLabel(), icon: <ArrowUpRight size={14} />, accent: false, negative: true },
            { label: "Capital Récupéré", value: `$${periodCapital.toFixed(2)}`, sub: "Prix d'achat amorti", icon: <Landmark size={14} />, accent: false },
            { label: "Marge Nette", value: `+$${periodNetProfit.toFixed(2)}`, sub: "Bénéfice net", icon: <TrendingUp size={14} />, accent: false, positive: true },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white/3 border border-white/8 rounded-xl p-3 sm:p-4 flex flex-col justify-between gap-2 sm:gap-3 min-h-[95px] sm:min-h-[110px]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider truncate">{kpi.label}</p>
                <span className={`p-1 sm:p-1.5 rounded-md shrink-0 ${kpi.accent ? "bg-[#C7D300]/10 text-[#C7D300]" : "bg-white/5 text-gray-500"}`}>
                  {kpi.icon}
                </span>
              </div>
              <p className={`text-base sm:text-xl font-black tabular-nums truncate ${kpi.negative ? "text-rose-400" : kpi.positive ? "text-emerald-400" : kpi.pending ? "text-amber-300" : kpi.accent ? "text-[#C7D300]" : "text-white"}`}>
                {kpi.value}
              </p>
              <p className="text-[10px] text-gray-600 truncate">{kpi.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bannière Interactive des Fonds chez les Livreurs */}
      {pendingHandovers.length > 0 && (
        <div className="bg-white/3 border border-amber-500/25 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-300 rounded-lg shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Espèces Détenues par les Livreurs</span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded font-bold">
                    {pendingHandovers.length} commande(s)
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Validez la réception dès que le livreur vous remet le cash en boutique pour l&apos;intégrer à la caisse.
                </p>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total à recevoir</p>
              <p className="text-lg font-black text-amber-300 tabular-nums">${pendingCashTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingHandovers.map((item) => (
              <div key={item.orderId} className="bg-black/30 border border-white/8 rounded-lg p-3 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-gray-400 uppercase">#{item.orderNumber}</span>
                    <p className="text-xs font-semibold text-white mt-0.5 line-clamp-1">{item.description || "Articles livrés"}</p>
                  </div>
                  <span className="text-sm font-black text-white tabular-nums">${Number(item.amount || 0).toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 bg-white/3 px-2.5 py-2 rounded-md">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase">Livreur</p>
                    <p className="font-medium text-gray-300 text-[11px]">{item.driverName || "Livreur"}</p>
                  </div>
                  {item.driverPhone && (
                    <a
                      href={`tel:${item.driverPhone}`}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/8 transition-colors"
                    >
                      <Phone size={10} />
                      <span>{item.driverPhone}</span>
                    </a>
                  )}
                </div>

                <button
                  onClick={() => handleClearCash(item.orderId)}
                  disabled={clearingOrderId === item.orderId}
                  className="w-full py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {clearingOrderId === item.orderId ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Validation...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={12} />
                      <span>Valider la réception</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table & Filtres */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                filter === "ALL" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
              }`}
            >
              Tous
            </button>
            {isImmo ? (
              <>
                <button
                  onClick={() => setFilter("RENT_INCOME")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                    filter === "RENT_INCOME" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Home size={12} />
                  <span>Loyers Habitation</span>
                </button>
                <button
                  onClick={() => setFilter("HOTEL_INCOME")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                    filter === "HOTEL_INCOME" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Hotel size={12} />
                  <span>Hôtellerie</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setFilter("INCOME")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filter === "INCOME" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Ventes
                </button>
                <button
                  onClick={() => setFilter("PENDING_HANDOVER")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                    filter === "PENDING_HANDOVER" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Clock size={12} />
                  <span>Chez Livreurs {pendingHandovers.length > 0 ? `(${pendingHandovers.length})` : ""}</span>
                </button>
              </>
            )}
            {!isImmo && (
              <button
                onClick={() => setFilter("PAYOUT")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  filter === "PAYOUT" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
                }`}
              >
                Paiements Livreurs
              </button>
            )}
            <button
              onClick={() => setFilter("EXPENSE")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                filter === "EXPENSE" ? "bg-[#C7D300] text-[#0F1D27]" : "bg-white/5 text-gray-500 hover:text-gray-300"
              }`}
            >
              Dépenses
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
            <input
              type="text"
              placeholder="Rechercher description ou référence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-60 pl-8 pr-3 py-1.5 bg-white/5 border border-white/8 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 text-white text-[11px] placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Desktop Table (≥ md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-white/8">
                {["Date", "Type / Branche", "Description", "Référence", "Montant (USD)"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-gray-600">Chargement des opérations...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-gray-400">Aucune opération pour {getPeriodLabel()}</p>
                    <p className="text-xs text-gray-600 mt-1">Modifiez la période ou les filtres pour consulter l&apos;historique.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const isHotel = t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel");
                  const isRent = t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_");
                  const isPending = t.isPendingHandover || t.status === "PENDING_HANDOVER";

                  return (
                    <tr key={t.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-gray-500">
                        {t.createdAt?.toDate
                          ? t.createdAt.toDate().toLocaleDateString("fr-FR")
                          : t.createdAt?.seconds
                          ? new Date(t.createdAt.seconds * 1000).toLocaleDateString("fr-FR")
                          : t.createdAt
                          ? new Date(t.createdAt).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                            Chez Livreur
                          </span>
                        ) : t.type === "INCOME" ? (
                          isHotel ? (
                            <span className="text-[10px] font-bold text-gray-300 bg-white/6 px-2 py-0.5 rounded">
                              Hôtellerie
                            </span>
                          ) : isRent ? (
                            <span className="text-[10px] font-bold text-gray-300 bg-white/6 px-2 py-0.5 rounded">
                              Habitation
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#C7D300] bg-[#C7D300]/8 px-2 py-0.5 rounded">
                              Vente
                            </span>
                          )
                        ) : t.type === "PAYOUT" ? (
                          <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                            Paiement
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-400/8 px-2 py-0.5 rounded">
                            Dépense {t.category ? `(${t.category})` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-300 max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          <span title={t.description}>{t.description}</span>
                          {isPending && (
                            <button
                              onClick={() => handleClearCash(t.orderId || t.referenceId || t.id)}
                              disabled={clearingOrderId === (t.orderId || t.referenceId || t.id)}
                              className="px-2 py-0.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-[10px] font-bold rounded transition-colors shrink-0"
                            >
                              {clearingOrderId === (t.orderId || t.referenceId || t.id) ? "Validation..." : "Valider Cash"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{t.referenceId || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-[11px] font-bold tabular-nums ${
                            isPending
                              ? "text-amber-300"
                              : t.type === "INCOME"
                              ? "text-[#C7D300]"
                              : "text-rose-400"
                          }`}
                        >
                          {t.type === "INCOME" ? "+" : "-"}${t.amount.toFixed(2)}
                        </span>
                        {t.type === "INCOME" && (Number(t.capital) > 0 || Number(t.profit) > 0) && (
                          <div className="text-[10px] text-gray-600 font-mono">
                            Marge: +${Number(t.profit !== undefined ? t.profit : t.amount - (t.capital || 0)).toFixed(2)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Transactions List (< md) */}
        <div className="md:hidden divide-y divide-white/5">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-gray-500 font-medium">Chargement des opérations...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs font-semibold text-gray-400">Aucune opération pour {getPeriodLabel()}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Modifiez la période ou les filtres.</p>
            </div>
          ) : (
            filteredTransactions.map((t) => {
              const isHotel = t.branch === "hotel" || (t.category || "").toLowerCase().includes("hôtellerie") || (t.category || "").toLowerCase().includes("hotel");
              const isRent = t.branch === "habitation" || (t.category || "").toLowerCase().includes("loyer") || t.id.startsWith("payment_");
              const isPending = t.isPendingHandover || t.status === "PENDING_HANDOVER";

              const dateStr = t.createdAt?.toDate
                ? t.createdAt.toDate().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                : t.createdAt?.seconds
                ? new Date(t.createdAt.seconds * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                : t.createdAt
                ? new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                : "—";

              return (
                <div key={t.id} className="p-3.5 flex flex-col gap-2 hover:bg-white/3 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono">{dateStr}</span>
                      {isPending ? (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">
                          Chez Livreur
                        </span>
                      ) : t.type === "INCOME" ? (
                        isHotel ? (
                          <span className="text-[9px] font-bold text-gray-300 bg-white/6 px-1.5 py-0.5 rounded">
                            Hôtellerie
                          </span>
                        ) : isRent ? (
                          <span className="text-[9px] font-bold text-gray-300 bg-white/6 px-1.5 py-0.5 rounded">
                            Habitation
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-[#C7D300] bg-[#C7D300]/10 px-1.5 py-0.5 rounded">
                            Vente
                          </span>
                        )
                      ) : t.type === "PAYOUT" ? (
                        <span className="text-[9px] font-bold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                          Paiement
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded">
                          Dépense {t.category ? `(${t.category})` : ""}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm font-black tabular-nums ${
                          isPending
                            ? "text-amber-300"
                            : t.type === "INCOME"
                            ? "text-[#C7D300]"
                            : "text-rose-400"
                        }`}
                      >
                        {t.type === "INCOME" ? "+" : "-"}${t.amount.toFixed(2)}
                      </span>
                      {t.type === "INCOME" && (Number(t.capital) > 0 || Number(t.profit) > 0) && (
                        <div className="text-[9px] text-emerald-400 font-mono leading-tight">
                          Marge: +${Number(t.profit !== undefined ? t.profit : t.amount - (t.capital || 0)).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 line-clamp-2 leading-snug">
                    {t.description || "Opération de caisse"}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-gray-500">
                    <span className="font-mono text-gray-600 truncate max-w-[150px]">
                      {t.referenceId ? `Réf: ${t.referenceId}` : ''}
                    </span>

                    {isPending && (
                      <button
                        onClick={() => handleClearCash(t.orderId || t.referenceId || t.id)}
                        disabled={clearingOrderId === (t.orderId || t.referenceId || t.id)}
                        className="px-2.5 py-1 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-[10px] font-bold rounded-md transition-colors shadow-sm"
                      >
                        {clearingOrderId === (t.orderId || t.referenceId || t.id) ? "Validation..." : "Valider Cash"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal 1: Nouvelle Opération */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                <h2 className="text-sm font-bold text-white">Nouvelle Opération de Caisse</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Type d&apos;opération</label>
                  <select
                    value={txType}
                    onChange={(e: any) => setTxType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                  >
                    {!isImmo && <option value="INCOME" className="bg-[#0F1D27]">Entrée (Vente produit/service)</option>}
                    {isImmo && <option value="RENT_INCOME" className="bg-[#0F1D27]">Paiement Loyer (Habitation)</option>}
                    {isImmo && <option value="HOTEL_INCOME" className="bg-[#0F1D27]">Recette Hôtelière (Séjour / Nuitée)</option>}
                    {isImmo && <option value="INCOME" className="bg-[#0F1D27]">Entrée Générique</option>}
                    {!isImmo && <option value="PAYOUT" className="bg-[#0F1D27]">Paiement d&apos;un Livreur</option>}
                    <option value="EXPENSE" className="bg-[#0F1D27]">Dépense (Entretien, Stock, Factures...)</option>
                  </select>
                </div>

                {txType === "RENT_INCOME" && (
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Locataire *</label>
                    <select
                      required
                      value={selectedTenantId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTenantId(val);
                        const t = tenants.find((x) => x.id === val);
                        if (t && t.rentAmount) setAmount(String(t.rentAmount));
                      }}
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                    >
                      <option value="">Sélectionnez un locataire...</option>
                      {tenants.map((t) => {
                        const tenantName = t.name || `${t.firstName || ""} ${t.lastName || ""}`.trim() || "Locataire";
                        const propertyTitle = t.propertyName || t.propertyTitle || "Propriété";
                        const unitInfo = t.unitName || t.unitTitle ? ` (${t.unitName || t.unitTitle})` : "";
                        const rentInfo = t.rentAmount ? ` - $${t.rentAmount}` : "";
                        return (
                          <option key={t.id} value={t.id} className="bg-[#0F1D27]">
                            {tenantName} — {propertyTitle}{unitInfo}{rentInfo}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {txType === "HOTEL_INCOME" && (
                  <div className="space-y-3 p-3 bg-white/3 border border-white/8 rounded-lg">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Client / Voyageur *</label>
                      <input
                        type="text"
                        required
                        placeholder="ex: Jean Marc"
                        value={hotelGuestName}
                        onChange={(e) => setHotelGuestName(e.target.value)}
                        className="w-full px-3 py-2 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Chambre / Suite *</label>
                      <input
                        type="text"
                        required
                        placeholder="ex: Suite #102"
                        value={hotelRoom}
                        onChange={(e) => setHotelRoom(e.target.value)}
                        className="w-full px-3 py-2 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Nuitées</label>
                        <input
                          type="number"
                          min="1"
                          value={hotelNights}
                          onChange={(e) => {
                            const n = parseInt(e.target.value) || 1;
                            setHotelNights(n);
                            if (hotelNightlyRate) setAmount((n * parseFloat(hotelNightlyRate)).toFixed(2));
                          }}
                          className="w-full px-3 py-2 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Tarif / nuit ($)</label>
                        <input
                          type="number"
                          placeholder="100"
                          value={hotelNightlyRate}
                          onChange={(e) => {
                            setHotelNightlyRate(e.target.value);
                            const r = parseFloat(e.target.value) || 0;
                            setAmount((hotelNights * r).toFixed(2));
                          }}
                          className="w-full px-3 py-2 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {txType === "EXPENSE" && (
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Catégorie *</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                    >
                      {isImmo ? (
                        <>
                          <option value="Entretien" className="bg-[#0F1D27]">Entretien & Nettoyage</option>
                          <option value="Maintenance" className="bg-[#0F1D27]">Maintenance & Réparations</option>
                          <option value="Groupe Electrogene" className="bg-[#0F1D27]">Groupe Électrogène & Carburant</option>
                          <option value="Blanchisserie" className="bg-[#0F1D27]">Blanchisserie & Lingerie</option>
                          <option value="Eau & Electricite" className="bg-[#0F1D27]">Eau & Électricité</option>
                          <option value="Taxes" className="bg-[#0F1D27]">Taxes & Impôts</option>
                          <option value="Commissions" className="bg-[#0F1D27]">Salaires & Commissions</option>
                          <option value="Autre (Immo/Hotel)" className="bg-[#0F1D27]">Autre</option>
                        </>
                      ) : (
                        <>
                          <option value="Loyer" className="bg-[#0F1D27]">Loyer / Factures</option>
                          <option value="Salaires" className="bg-[#0F1D27]">Salaires</option>
                          <option value="Logistique" className="bg-[#0F1D27]">Logistique / Transport</option>
                          <option value="Achats" className="bg-[#0F1D27]">Achats Marchandises</option>
                          <option value="Marketing" className="bg-[#0F1D27]">Publicité / Marketing</option>
                          <option value="Autre" className="bg-[#0F1D27]">Autre</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="150.00"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                {txType !== "RENT_INCOME" && txType !== "HOTEL_INCOME" && (
                  <div>
                    <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Description *</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={isImmo ? "ex: Réparation climatisation" : "ex: Vente directe magasin"}
                      className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Référence pièce</label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="ex: REC-001"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Enregistrement..." : "Valider l'Opération"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Ajustement de Caisse Magasin */}
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
                    Ajustement Caisse Magasin
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Solde actuel : <span className="text-white font-semibold">${balance.toFixed(2)}</span>
                  </p>
                </div>
                <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-2 uppercase tracking-wider">Sens</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjType("ADD")}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all border ${
                        adjType === "ADD"
                          ? "bg-[#C7D300]/10 text-[#C7D300] border-[#C7D300]/30"
                          : "bg-white/4 text-gray-500 border-white/8 hover:border-white/15"
                      }`}
                    >
                      + Entrée / Apport Caisse
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjType("SUBTRACT")}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all border ${
                        adjType === "SUBTRACT"
                          ? "bg-rose-400/10 text-rose-400 border-rose-400/25"
                          : "bg-white/4 text-gray-500 border-white/8 hover:border-white/15"
                      }`}
                    >
                      - Sortie / Prélèvement Caisse
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="25.00"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Motif *</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50"
                  >
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#0F1D27]">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">Libellé précis *</label>
                  <input
                    type="text"
                    required
                    value={adjLabel}
                    onChange={(e) => setAdjLabel(e.target.value)}
                    placeholder="ex: Régularisation inventaire caisse"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5 uppercase tracking-wider">N° Pièce justificative</label>
                  <input
                    type="text"
                    value={adjRef}
                    onChange={(e) => setAdjRef(e.target.value)}
                    placeholder="ex: REC-CAISSE-001"
                    className="w-full px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]/50 placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdj}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-all disabled:opacity-50"
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
