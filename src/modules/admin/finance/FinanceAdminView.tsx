"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowDownRight, Plus, Download, X, Search,
  FileText, CheckCircle, Clock, Sliders, Lock,
  TrendingUp, Award, ShieldCheck, Coins, Check,
  AlertTriangle, Building2, RefreshCw, CreditCard, Copy, ExternalLink
} from "lucide-react";
import { useDatePeriodFilter } from "@/hooks/useDatePeriodFilter";
import DateRangeFilterPills from "@/modules/shared/components/finance/DateRangeFilterPills";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot, limit
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { fetchSuppliersAction } from "@/app/(admin)/admin/finance/actions";
import { canAccessFinance, isSuperAdmin as checkIsSuperAdmin } from "@/lib/permissions";
import {
  AccountingEntry,
  ADJUSTMENT_REASONS,
  isOfficialAdminSupplier,
} from "@/lib/accountingLedger";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";
import MobileMoneyRequestsPanel from "./MobileMoneyRequestsPanel";
import PaymentIntentsPanel from "./PaymentIntentsPanel";

interface Transaction {
  id: string;
  type: "SUBSCRIPTION" | "EXPENSE" | "OTHER_INCOME";
  amount: number;
  currency: string;
  description: string;
  referenceId?: string;
  accountingScope?: string;
  recordedBy?: string;
  status: "COMPLETED" | "PENDING";
  createdAt: any;
}

interface UserSupplier {
  id: string;
  displayName: string;
  email: string;
  company?: string;
  phone?: string;
  role?: string;
  rayon?: string;
  assignedRayons?: string[];
  subscriptionEndDate?: any;
  subscriptionStatus?: string;
  isBlocked?: boolean;
  depositAmount?: number;
  isOfficialAdminStore?: boolean;
  isAdminSupplier?: boolean;
  referredByPartnerId?: string | null;
  createdAt?: any;
}

const RAYON_META: Record<string, { label: string; badgeClass: string }> = {
  immo: {
    label: "Immobilier",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  mode: {
    label: "Mode",
    badgeClass: "bg-pink-500/10 text-pink-300 border-pink-500/20",
  },
  connect: {
    label: "Connect",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  },
  saveurs: {
    label: "Saveurs",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
};

const PAYMENT_CHANNELS = [
  "M-Pesa",
  "Airtel Money",
  "Orange Money",
  "Espèces (Caisse Centrale)",
  "Virement Bancaire",
] as const;

function formatRayonBadge(rayon?: string) {
  const key = String(rayon || "connect").toLowerCase().trim();
  return RAYON_META[key] || {
    label: key ? key.charAt(0).toUpperCase() + key.slice(1) : "Connect",
    badgeClass: "bg-white/5 text-gray-300 border-white/10",
  };
}

function formatEntryDate(raw: any): string {
  if (!raw) return "—";
  if (raw?.toDate) return raw.toDate().toLocaleDateString("fr-FR");
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}

export default function AdminFinancePage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"deposits" | "commissions" | "ledger" | "admin_shop" | "settings" | "overview">("deposits");

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<AccountingEntry[]>([]);
  const [suppliers, setSuppliers] = useState<UserSupplier[]>([]);
  const [adminStoreSales, setAdminStoreSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [journalFilter, setJournalFilter] = useState<string>("ALL");

  // Par défaut sur le mois en cours pour afficher immédiatement les écritures comptables pertinentes
  const dateFilter = useDatePeriodFilter("this_month");
  const { periodFilter, isItemInPeriod: isTxInPeriod, getPeriodLabel } = dateFilter;
  const [search, setSearch] = useState("");

  // Filtres abonnements fournisseurs
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

  // Paramètres financiers & Double Approbation
  const [financialSettings, setFinancialSettings] = useState<any>(null);
  const [pendingProposal, setPendingProposal] = useState<any>(null);
  const [financialHistory, setFinancialHistory] = useState<any[]>([]);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  const [formUsdRate, setFormUsdRate] = useState("2850");
  const [formCommission, setFormCommission] = useState("5");
  const [formSubscription, setFormSubscription] = useState("50");
  const [formPromo, setFormPromo] = useState("10");
  const [formReason, setFormReason] = useState("");

  // Configuration dynamique Carte Visa / Mastercard & Prélèvement Automatique
  const [visaEnabled, setVisaEnabled] = useState(false);
  const [visaProviderName, setVisaProviderName] = useState("Stripe");
  const [visaSubscriptionUrl, setVisaSubscriptionUrl] = useState("");
  const [visaCheckoutUrl, setVisaCheckoutUrl] = useState("");
  const [visaAutoBillingEnabled, setVisaAutoBillingEnabled] = useState(true);
  const [isSavingVisa, setIsSavingVisa] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Modales sécurisées
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [paymentTargetSupplier, setPaymentTargetSupplier] = useState<UserSupplier | null>(null);

  // Form : Encaissement Abonnement Sécurisé (anti-doublon + référence obligatoire)
  const [subAmount, setSubAmount] = useState("50");
  const [subChannel, setSubChannel] = useState<string>(PAYMENT_CHANNELS[0]);
  const [subRef, setSubRef] = useState("");
  const [subNote, setSubNote] = useState("");
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  // Form : Nouvelle Écriture Plateforme (serveur uniquement)
  const [txKind, setTxKind] = useState<"OTHER_INCOME" | "EXPENSE">("OTHER_INCOME");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txReference, setTxReference] = useState("");
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  // Form : Ajustement de Caisse (Super Admin uniquement)
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState<"ADD" | "SUBTRACT">("ADD");
  const [adjReason, setAdjReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [adjLabel, setAdjLabel] = useState("");
  const [adjRef, setAdjRef] = useState("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  const [actionNotice, setActionNotice] = useState("");
  const [execOverview, setExecOverview] = useState<any>(null);

  const hasFinanceAccess = canAccessFinance(user, userData);
  const isSuperAdmin = useMemo(
    () =>
      checkIsSuperAdmin(user, userData) ||
      Boolean(
        Array.isArray(userData?.staffProfile?.positions) &&
          userData.staffProfile.positions.includes("DIRECTEUR_GENERAL")
      ),
    [user, userData]
  );

  const fetchExecutiveOverview = async (fresh = false) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/executive-overview${fresh ? "?fresh=1" : ""}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setExecOverview(json);
      }
    } catch (e) {
      console.warn("Executive overview fetch warning:", e);
    }
  };

  const fetchFinancialSettings = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/financial-settings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
          setVisaEnabled(Boolean(json.settings.visaEnabled));
          setVisaProviderName(String(json.settings.visaProviderName || "Stripe"));
          setVisaSubscriptionUrl(String(json.settings.visaSubscriptionUrl || ""));
          setVisaCheckoutUrl(String(json.settings.visaCheckoutUrl || ""));
          setVisaAutoBillingEnabled(json.settings.visaAutoBillingEnabled !== false);
        }
      }
    } catch (e) {
      console.error("Error loading financial settings:", e);
    }
  };

  const fetchPartners = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/commissions", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setPartners(json.partners || []);
      }
    } catch (e) {
      console.error("Error loading partners:", e);
    }
  };

  const refreshSuppliers = async () => {
    try {
      const sups = await fetchSuppliersAction();
      setSuppliers(sups as UserSupplier[]);
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  };

  useEffect(() => {
    if (!loading && !hasFinanceAccess) {
      router.push("/admin/dashboard");
      return;
    }

    if (!hasFinanceAccess) return;

    refreshSuppliers();
    fetchPartners();
    fetchFinancialSettings();
    fetchExecutiveOverview();

    // 1. Transactions Plateforme Admin (`transactions`)
    const qTx = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(150));
    const unsubTx = onSnapshot(
      qTx,
      (snapshot) => {
        const data: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          // Exclure toute éventuelle transaction hors périmètre plateforme (ex: future agence immo)
          if (d.accountingScope === "SUPPLIER_PRIVATE" || d.accountingScope === "ADMIN_IMMO") return;
          data.push({ id: docSnap.id, ...d } as Transaction);
        });
        setTransactions(data);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching transactions:", error);
        setIsLoading(false);
      }
    );

    // 2. Grand Livre Plateforme Admin (`accounting_ledger`, strictement filtré côté plateforme)
    const qLedger = query(collection(db, "accounting_ledger"), orderBy("date", "desc"), limit(150));
    const unsubLedger = onSnapshot(
      qLedger,
      (snapshot) => {
        const entries: AccountingEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          // Cloisonnement strict : exclure les anciens loyers/ventes privées fournisseurs qui avaient fuité dans accounting_ledger
          const isSupplierPrivate =
            d.accountingScope === "SUPPLIER_PRIVATE" ||
            d.accountingScope === "ADMIN_IMMO" ||
            (d.actorType === "SUPPLIER" &&
              d.category !== "Abonnement Mensuel" &&
              d.category !== "Abonnement Fournisseur");
          if (isSupplierPrivate) return;
          entries.push({ id: docSnap.id, ...d } as AccountingEntry);
        });
        setLedgerEntries(entries);
      },
      (error) => {
        console.warn("Accounting ledger listener warning:", error.message);
      }
    );

    // 3. Suivi analytique (lecture seule) des propres rayons de l'Admin uniquement (jamais les vendeurs tiers, jamais encaissé dans la caisse plateforme)
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(150));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const sales: any[] = [];
        snapshot.forEach((docSnap) => {
          const order = docSnap.data();
          const status = (order.status || "").toUpperCase();
          if (status === "COMPLETED" || status === "LIVRÉE" || status === "DELIVERED") {
            const adminItems = (order.items || []).filter(
              (item: any) =>
                item.isAdminProduct ||
                item.isOfficialRayons ||
                item.isOfficialAdminStore ||
                item.supplierId === "admin" ||
                (user?.uid && item.supplierId === user.uid)
            );
            if (adminItems.length > 0) {
              const revenue = adminItems.reduce(
                (acc: number, it: any) => acc + Number(it.price || 0) * Number(it.quantity || 1),
                0
              );
              const invested = adminItems.reduce((acc: number, it: any) => {
                const qty = Number(it.quantity || 1);
                const cogs =
                  it.costOfGoodsSold !== undefined
                    ? Number(it.costOfGoodsSold || 0)
                    : Number(it.purchasePrice || 0) * qty;
                return acc + Math.max(0, cogs);
              }, 0);
              const profit = revenue - invested;
              const primaryRayon = String(adminItems[0]?.rayon || adminItems[0]?.category || "connect").toLowerCase();
              const title =
                adminItems.length === 1
                  ? adminItems[0]?.title || order.productTitle || "Article Admin"
                  : `${adminItems[0]?.title || "Articles Admin"} (+${adminItems.length - 1})`;
              sales.push({
                id: docSnap.id,
                orderId: docSnap.id,
                title,
                rayon: primaryRayon,
                quantity: adminItems.reduce((acc: number, it: any) => acc + Number(it.quantity || 1), 0),
                invested,
                amount: revenue,
                revenue,
                profit,
                clientName: order.clientName || "Client",
                createdAt: order.deliveredAt || order.createdAt,
              });
            }
          }
        });
        setAdminStoreSales(sales);
      },
      (error) => {
        console.warn("Orders finance listener warning:", error.message);
      }
    );

    return () => {
      unsubTx();
      unsubLedger();
      unsubOrders();
    };
  }, [user?.uid, hasFinanceAccess, loading, router]);

  // ── Calculs réconciliés (Trésorerie Plateforme pure : abonnements & commissions uniquement, sans encaissement de ventes boutique) ──
  const totalSubscriptions = useMemo(
    () => transactions.filter((t) => t.type === "SUBSCRIPTION").reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [transactions]
  );

  const totalOtherIncome = useMemo(
    () => transactions.filter((t) => t.type === "OTHER_INCOME").reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [transactions]
  );

  const periodAdminSales = useMemo(
    () => adminStoreSales.filter((s) => isTxInPeriod(s, periodFilter)),
    [adminStoreSales, periodFilter, isTxInPeriod]
  );

  const adminShopAnalytics = useMemo(() => {
    const invested = periodAdminSales.reduce((acc, s) => acc + Number(s.invested || 0), 0);
    const revenue = periodAdminSales.reduce((acc, s) => acc + Number(s.revenue || s.amount || 0), 0);
    const profit = revenue - invested;
    const byRayon: Record<string, { rayon: string; count: number; invested: number; revenue: number; profit: number }> = {};

    periodAdminSales.forEach((s) => {
      const key = String(s.rayon || "connect").toLowerCase();
      if (!byRayon[key]) {
        byRayon[key] = { rayon: key, count: 0, invested: 0, revenue: 0, profit: 0 };
      }
      byRayon[key].count += 1;
      byRayon[key].invested += Number(s.invested || 0);
      byRayon[key].revenue += Number(s.revenue || s.amount || 0);
      byRayon[key].profit += Number(s.profit || 0);
    });

    return {
      invested,
      revenue,
      profit,
      marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      byRayon: Object.values(byRayon).sort((a, b) => b.revenue - a.revenue),
    };
  }, [periodAdminSales]);

  const totalPayout = useMemo(
    () => transactions.filter((t) => t.type === "EXPENSE").reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [transactions]
  );

  // L'Admin Plateforme n'encaisse pas les ventes des boutiques (seule la boutique encaisse ses ventes)
  const currentBalance = totalSubscriptions + totalOtherIncome - totalPayout;

  // Flux filtrés selon la période comptable sélectionnée (Plateforme uniquement)
  const periodTx = useMemo(
    () => transactions.filter((t) => isTxInPeriod(t, periodFilter)),
    [transactions, periodFilter, isTxInPeriod]
  );
  const periodIncome = useMemo(
    () =>
      periodTx
        .filter((t) => t.type === "SUBSCRIPTION" || t.type === "OTHER_INCOME")
        .reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [periodTx]
  );
  const periodPayout = useMemo(
    () => periodTx.filter((t) => t.type === "EXPENSE").reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [periodTx]
  );

  // Statistiques abonnements fournisseurs (MRR confirmé strictement séparé des expirés/essais)
  const supplierStats = useMemo(() => {
    let official = 0;
    let overdue = 0;
    let trial = 0;
    let active = 0;
    let confirmedMRR = 0;
    let expiredPotential = 0;

    suppliers.forEach((s) => {
      const isOff = isOfficialAdminSupplier(s);
      if (isOff) {
        official++;
        return;
      }
      const subInfo = evaluateSupplierSubscription(s);
      const fee = Number(s.depositAmount) || 50;
      if (subInfo.isBlocked) {
        overdue++;
        expiredPotential += fee;
      } else if (subInfo.isTrial) {
        trial++;
      } else {
        active++;
        confirmedMRR += fee;
      }
    });

    return {
      total: suppliers.length,
      official,
      overdue,
      trial,
      active,
      confirmedMRR,
      confirmedARR: confirmedMRR * 12,
      expiredPotential,
    };
  }, [suppliers]);

  const filteredSuppliersList = useMemo(() => {
    return suppliers
      .filter((s) => {
        const isOfficial = isOfficialAdminSupplier(s);
        const subInfo = evaluateSupplierSubscription(s);

        if (supplierStatusFilter === "OVERDUE" && (isOfficial || !subInfo.isBlocked)) return false;
        if (supplierStatusFilter === "TRIAL" && (isOfficial || subInfo.isBlocked || !subInfo.isTrial)) return false;
        if (supplierStatusFilter === "ACTIVE" && (isOfficial || subInfo.isBlocked || subInfo.isTrial)) return false;
        if (supplierStatusFilter === "OFFICIAL" && !isOfficial) return false;

        if (supplierRayonFilter !== "ALL" && (s.rayon || "connect").toLowerCase() !== supplierRayonFilter.toLowerCase()) {
          return false;
        }

        if (supplierSearch.trim()) {
          const q = supplierSearch.toLowerCase();
          const name = (s.displayName || s.company || "").toLowerCase();
          const email = (s.email || "").toLowerCase();
          return name.includes(q) || email.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const rank = (s: UserSupplier) => {
          if (isOfficialAdminSupplier(s)) return 4;
          const info = evaluateSupplierSubscription(s);
          if (info.isBlocked) return 1;
          if (info.isTrial) return 2;
          return 3;
        };
        return rank(a) - rank(b);
      });
  }, [suppliers, supplierStatusFilter, supplierRayonFilter, supplierSearch]);

  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      if (!isTxInPeriod({ createdAt: entry.date }, periodFilter)) return false;
      if (journalFilter !== "ALL" && entry.journal !== journalFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchLabel = (entry.label || "").toLowerCase().includes(q);
        const matchRef = (entry.referencePiece || "").toLowerCase().includes(q);
        const matchNum = (entry.entryNumber || "").toLowerCase().includes(q);
        if (!matchLabel && !matchRef && !matchNum) return false;
      }
      return true;
    });
  }, [ledgerEntries, periodFilter, journalFilter, search, isTxInPeriod]);

  // ── Handlers sécurisés (100 % serveur) ──

  const openPaymentModal = (supplier: UserSupplier) => {
    setPaymentTargetSupplier(supplier);
    setSubAmount(String(supplier.depositAmount || 50));
    setSubChannel(PAYMENT_CHANNELS[0]);
    setSubRef("");
    setSubNote("");
  };

  const handleConfirmSubscriptionPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetSupplier) return;
    const parsedAmt = parseFloat(subAmount);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }
    if (subRef.trim().length < 3) {
      alert("Une référence de preuve de paiement (ID Mobile Money ou n° reçu) est obligatoire pour éviter tout double encaissement.");
      return;
    }

    setIsSubmittingSub(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/executive-overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "RECORD_SUBSCRIPTION_PAYMENT",
          supplierId: paymentTargetSupplier.id,
          amountPaid: parsedAmt,
          paymentMethod: subChannel,
          referencePiece: subRef.trim(),
          note: subNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de l'encaissement.");
      }

      setPaymentTargetSupplier(null);
      setSubRef("");
      setSubNote("");
      await Promise.all([refreshSuppliers(), fetchExecutiveOverview(true), fetchPartners()]);
      setActionNotice(json.message);
      setTimeout(() => setActionNotice(""), 7000);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'encaissement sécurisé.");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjAmount);
    if (!Number.isFinite(val) || val <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    const signedAmount = adjType === "ADD" ? val : -val;
    setIsSubmittingAdj(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/finance/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind: "ADJUSTMENT",
          amount: signedAmount,
          reason: adjReason,
          label: adjLabel.trim(),
          referencePiece: adjRef.trim(),
          accountingScope: "PLATFORM_ADMIN",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de l'enregistrement de l'ajustement.");
      }

      setIsAdjustmentModalOpen(false);
      setAdjAmount("");
      setAdjLabel("");
      setAdjRef("");
      setActionNotice(json.message);
      setTimeout(() => setActionNotice(""), 6000);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajustement de caisse.");
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(txAmount);
    if (!Number.isFinite(val) || val <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    setIsSubmittingTx(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/finance/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind: txKind,
          amount: val,
          label: txDescription.trim(),
          referencePiece: txReference.trim(),
          accountingScope: "PLATFORM_ADMIN",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de l'enregistrement.");
      }

      setIsTxModalOpen(false);
      setTxAmount("");
      setTxDescription("");
      setTxReference("");
      setActionNotice(json.message);
      setTimeout(() => setActionNotice(""), 6000);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement de l'écriture.");
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleSaveVisaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert("Seul le Super Admin / DG peut modifier les liens de paiement Visa.");
      return;
    }

    setIsSavingVisa(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "UPDATE_VISA_CONFIG",
          visaEnabled,
          visaProviderName: visaProviderName.trim() || "Stripe",
          visaSubscriptionUrl: visaSubscriptionUrl.trim(),
          visaCheckoutUrl: visaCheckoutUrl.trim(),
          visaAutoBillingEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors de la sauvegarde de la configuration Visa.");
      }

      await fetchFinancialSettings();
      setActionNotice(json.message || "Configuration Carte Visa enregistrée et synchronisée.");
      setTimeout(() => setActionNotice(""), 6500);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la mise à jour des liens Visa.");
    } finally {
      setIsSavingVisa(false);
    }
  };

  const handleCopyWebhook = async () => {
    const endpoint =
      financialSettings?.visaWebhookEndpoint || "https://rayons.net/api/payments/visa-webhook";
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
    } catch {
      alert(`Copiez manuellement ce lien Webhook : ${endpoint}`);
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
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/commissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      fetchExecutiveOverview(true);
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
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
        throw new Error(json.error || "Erreur lors de la soumission.");
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
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/financial-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const downloadCSV = () => {
    const headers = ["Date", "N° Écriture", "Journal", "Réf Pièce", "Libellé", "Débit (+)", "Crédit (-)"];
    const rows = filteredLedger.map((e) => [
      formatEntryDate(e.date),
      e.entryNumber || "-",
      e.journal || "-",
      e.referencePiece || "-",
      `"${(e.label || "").replace(/"/g, '""')}"`,
      e.debit ? e.debit.toFixed(2) : "",
      e.credit ? e.credit.toFixed(2) : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `grand_livre_plateforme_rayons_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingPartnerPayouts = partners.reduce((sum, p) => sum + Number(p.balance || 0), 0);
  const totalPartnerEarned = partners.reduce((sum, p) => sum + Number(p.totalEarned || 0), 0);
  const targetSubInfo = paymentTargetSupplier ? evaluateSupplierSubscription(paymentTargetSupplier) : null;
  const targetAlreadyActive = Boolean(
    paymentTargetSupplier &&
      !isOfficialAdminSupplier(paymentTargetSupplier) &&
      targetSubInfo &&
      !targetSubInfo.isBlocked &&
      !targetSubInfo.isTrial
  );

  return (
    <div className="space-y-5 pb-20">
      {/* Header Exécutif (1 seule ligne d'actions propre) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Finances Plateforme</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">
              <ShieldCheck size={11} />
              Audit &amp; Grand Livre Immuable
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
            <Building2 size={12} className="text-gray-500 shrink-0" />
            <span>
              Trésorerie Rayons.net uniquement (abonnements boutiques &amp; commissions). La comptabilité locative des agences Immo reste privée dans leur espace.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          {isSuperAdmin && (
            <button
              onClick={() => setIsAdjustmentModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sliders size={13} />
              <span>Ajustement</span>
            </button>
          )}

          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download size={13} />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={() => {
              setTxKind("OTHER_INCOME");
              setIsTxModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus size={14} />
            <span>Nouvelle Écriture</span>
          </button>
        </div>
      </div>

      {/* Preuves Mobile Money en attente de validation */}
      <MobileMoneyRequestsPanel
        onApproved={() => {
          refreshSuppliers();
          fetchExecutiveOverview(true);
          fetchPartners();
        }}
      />

      {/* Traces Anti-Coupure : paiements fournisseurs interrompus avant la fin de l'Étape 2 */}
      <PaymentIntentsPanel />

      {/* Période Comptable */}
      <DateRangeFilterPills filter={dateFilter} />

      {/* 4 Cartes KPI Exécutives (1 seule rangée sobre, chiffres réconciliés) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* KPI 1: Trésorerie Plateforme */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Trésorerie Nette
            </span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300">
              <Wallet size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
            {isLoading ? "—" : `$${currentBalance.toFixed(2)}`}
          </p>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">
            <span className="truncate">{getPeriodLabel()}</span>
            <span className="tabular-nums whitespace-nowrap">
              <span className="text-emerald-400 font-semibold">+${periodIncome.toFixed(0)}</span>
              {" / "}
              <span className="text-rose-400 font-semibold">-${periodPayout.toFixed(0)}</span>
            </span>
          </div>
        </div>

        {/* KPI 2: MRR Confirmé */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              MRR Confirmé
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
            ${supplierStats.confirmedMRR.toFixed(0)}
            <span className="text-xs font-medium text-gray-400 ml-1">/mois</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">
            <span>{supplierStats.active} boutique(s) active(s)</span>
            <span className="tabular-nums text-emerald-400 font-medium">
              ARR ${supplierStats.confirmedARR.toFixed(0)}/an
            </span>
          </div>
        </div>

        {/* KPI 3: Abonnements Expirés (vocable SaaS clair, aucune confusion Immo) */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Abonnements Expirés
            </span>
            <span className={`p-1.5 rounded-lg ${supplierStats.overdue > 0 ? "bg-rose-500/10 text-rose-400" : "bg-white/[0.05] text-gray-400"}`}>
              <Clock size={14} />
            </span>
          </div>
          <p className={`text-2xl font-bold tabular-nums tracking-tight ${supplierStats.overdue > 0 ? "text-rose-400" : "text-white"}`}>
            {supplierStats.overdue}
            <span className="text-xs font-medium text-gray-400 ml-1.5">compte(s) suspendu(s)</span>
          </p>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">
            <span>Renouvellement : ${supplierStats.expiredPotential}/mois</span>
            <span className="text-amber-300">{supplierStats.trial} en essai</span>
          </div>
        </div>

        {/* KPI 4: Commissions Partenaires */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Commissions Partenaires
            </span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300">
              <Award size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
            ${pendingPartnerPayouts.toFixed(2)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">
            <span>À verser ({partners.length} partenaire{partners.length > 1 ? "s" : ""})</span>
            <span className="tabular-nums text-gray-300">Cumul ${totalPartnerEarned.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {actionNotice ? (
        <ValidationSuccessView
          title="Opération enregistrée"
          message={actionNotice}
          badgeLabel="Journal Comptable Auditée"
          onDone={() => setActionNotice("")}
        />
      ) : (
        <>
          {/* Onglets */}
          <div className="flex border-b border-white/[0.08] gap-5 text-xs font-semibold overflow-x-auto scrollbar-none whitespace-nowrap">
            {[
              { id: "deposits", label: `Abonnements Boutiques (${suppliers.length})`, icon: <Clock size={13} /> },
              { id: "admin_shop", label: `Mes Rayons Admin (${periodAdminSales.length})`, icon: <TrendingUp size={13} /> },
              { id: "commissions", label: `Commissions Partenaires (${partners.length})`, icon: <Award size={13} /> },
              { id: "ledger", label: `Grand Livre Plateforme (${filteredLedger.length})`, icon: <FileText size={13} /> },
              {
                id: "settings",
                label: pendingProposal ? "Paramètres & Taux (1 en attente)" : "Paramètres & Taux",
                icon: <Sliders size={13} />,
                hasBadge: Boolean(pendingProposal),
              },
              { id: "overview", label: `Livre de Caisse (${periodTx.length})`, icon: <Wallet size={13} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? "border-[#C7D300] text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.hasBadge && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />}
              </button>
            ))}
          </div>

          {/* TAB 1: ABONNEMENTS FOURNISSEURS */}
          {activeTab === "deposits" && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">Suivi des Abonnements Fournisseurs</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Cotisations mensuelles plateforme · Encaissement sécurisé avec preuve de paiement obligatoire
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/[0.06]">
                    {(
                      [
                        { id: "ALL", label: `Tous (${supplierStats.total})` },
                        { id: "OVERDUE", label: `Expirés (${supplierStats.overdue})` },
                        { id: "ACTIVE", label: `Actifs (${supplierStats.active})` },
                        { id: "TRIAL", label: `Essai (${supplierStats.trial})` },
                        { id: "OFFICIAL", label: `Officielles (${supplierStats.official})` },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setSupplierStatusFilter(btn.id)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          supplierStatusFilter === btn.id
                            ? "bg-white/15 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={supplierRayonFilter}
                    onChange={(e) => setSupplierRayonFilter(e.target.value)}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 focus:outline-none focus:border-white/25"
                  >
                    <option value="ALL" className="bg-[#0F1D27]">Tous les rayons</option>
                    <option value="immo" className="bg-[#0F1D27]">Immobilier</option>
                    <option value="mode" className="bg-[#0F1D27]">Mode</option>
                    <option value="connect" className="bg-[#0F1D27]">Connect</option>
                    <option value="saveurs" className="bg-[#0F1D27]">Saveurs</option>
                  </select>

                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="bg-white/[0.04] border border-white/10 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-white/25 w-40"
                    />
                  </div>
                </div>
              </div>

              {/* Table Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.01]">
                      {["Fournisseur", "Rayon", "Cycle", "Échéance", "Tarif", "Statut", "Action"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider last:text-right whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredSuppliersList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-xs text-gray-500">
                          Aucun fournisseur ne correspond aux filtres sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliersList.map((s) => {
                        const isOfficial = isOfficialAdminSupplier(s);
                        const subInfo = evaluateSupplierSubscription(s);
                        const depositAmount = Number(s.depositAmount) || 50;
                        const rayonMeta = formatRayonBadge(s.rayon);

                        return (
                          <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold text-white truncate max-w-[200px]">
                                {s.displayName || s.company || "Boutique"}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate max-w-[200px]">{s.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${rayonMeta.badgeClass}`}
                              >
                                {rayonMeta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {isOfficial
                                ? "Officielle Rayons"
                                : subInfo.isTrial
                                ? `Essai (${subInfo.daysLeft}j)`
                                : "Mensuel"}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-300 tabular-nums whitespace-nowrap">
                              {isOfficial ? "—" : subInfo.isBlocked ? "Expirée" : subInfo.formattedDueDate}
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-200 tabular-nums whitespace-nowrap">
                              {isOfficial ? "$0" : `$${depositAmount}/mois`}
                            </td>
                            <td className="px-4 py-3">
                              {isOfficial ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-300 bg-white/[0.06] px-2 py-0.5 rounded-md border border-white/10 whitespace-nowrap">
                                  Boutique Officielle
                                </span>
                              ) : subInfo.isBlocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 whitespace-nowrap">
                                  <Lock size={10} /> Suspendu
                                </span>
                              ) : subInfo.isTrial ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 whitespace-nowrap">
                                  Essai · {subInfo.daysLeft}j
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 whitespace-nowrap">
                                  <CheckCircle size={10} /> À jour
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isOfficial ? (
                                <span className="text-[11px] text-gray-600">Exemptée</span>
                              ) : subInfo.isBlocked ? (
                                <button
                                  onClick={() => openPaymentModal(s)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-[11px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  <RefreshCw size={11} />
                                  <span>Renouveler</span>
                                </button>
                              ) : subInfo.isTrial ? (
                                <button
                                  onClick={() => openPaymentModal(s)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-[11px] bg-[#C7D300]/15 hover:bg-[#C7D300]/25 text-[#C7D300] border border-[#C7D300]/30 transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  <ArrowDownRight size={12} />
                                  <span>Activer (${depositAmount})</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openPaymentModal(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/10 transition-colors whitespace-nowrap cursor-pointer"
                                  title="Déjà actif — prolonger uniquement après réception d'une avance"
                                >
                                  <span>Prolonger</span>
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

              {/* Cartes Mobile */}
              <div className="md:hidden divide-y divide-white/[0.06]">
                {filteredSuppliersList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">Aucun fournisseur ne correspond.</div>
                ) : (
                  filteredSuppliersList.map((s) => {
                    const isOfficial = isOfficialAdminSupplier(s);
                    const subInfo = evaluateSupplierSubscription(s);
                    const depositAmount = Number(s.depositAmount) || 50;
                    const rayonMeta = formatRayonBadge(s.rayon);

                    return (
                      <div key={s.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{s.displayName || s.company || "Boutique"}</h4>
                            <p className="text-[11px] text-gray-500 truncate">{s.email}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${rayonMeta.badgeClass}`}>
                            {rayonMeta.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>Échéance : <strong className="text-gray-200">{isOfficial ? "—" : subInfo.isBlocked ? "Expirée" : subInfo.formattedDueDate}</strong></span>
                          <span className="tabular-nums font-semibold text-gray-200">{isOfficial ? "$0" : `$${depositAmount}/mois`}</span>
                        </div>

                        {!isOfficial && (
                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            {subInfo.isBlocked ? (
                              <span className="text-[10px] font-semibold text-rose-300">Suspendu</span>
                            ) : subInfo.isTrial ? (
                              <span className="text-[10px] font-semibold text-amber-300">Essai ({subInfo.daysLeft}j)</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-300">À jour</span>
                            )}
                            <button
                              onClick={() => openPaymentModal(s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                                subInfo.isBlocked
                                  ? "bg-rose-500/20 text-rose-200 border border-rose-500/30"
                                  : subInfo.isTrial
                                  ? "bg-[#C7D300]/15 text-[#C7D300] border border-[#C7D300]/30"
                                  : "bg-white/[0.05] text-gray-200 border border-white/10"
                              }`}
                            >
                              {subInfo.isBlocked ? "Renouveler" : subInfo.isTrial ? `Activer ($${depositAmount})` : "Prolonger"}
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

          {/* TAB 2: GRAND LIVRE PLATEFORME */}
          {activeTab === "ledger" && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    { code: "ALL", label: "Tous" },
                    { code: "AB", label: "AB · Abonnements" },
                    { code: "AJ", label: "AJ · Ajustements" },
                    { code: "CS", label: "CS · Caisse" },
                    { code: "BQ", label: "BQ · Banque" },
                    { code: "VT", label: "VT · Ventes Officielles" },
                  ].map((j) => (
                    <button
                      key={j.code}
                      onClick={() => setJournalFilter(j.code)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        journalFilter === j.code
                          ? "bg-white/15 text-white"
                          : "bg-white/[0.03] text-gray-400 hover:text-white"
                      }`}
                    >
                      {j.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                  <input
                    type="text"
                    placeholder="Libellé ou référence..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg focus:outline-none focus:border-white/25 text-white text-[11px] placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      {["N° Écriture", "Date", "Journal", "Réf. Pièce", "Libellé", "Débit (+)", "Crédit (-)"].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-left last:text-right">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <p className="text-sm font-semibold text-gray-300">Aucune écriture plateforme pour {getPeriodLabel()}</p>
                          <p className="text-xs text-gray-500 mt-1">Élargissez la période (ex : Tout) pour consulter l&apos;historique complet.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredLedger.map((entry) => (
                        <tr key={entry.id || entry.entryNumber} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-200 font-semibold whitespace-nowrap">{entry.entryNumber}</td>
                          <td className="px-4 py-3 text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{formatEntryDate(entry.date)}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[10px] font-bold text-gray-200 bg-white/[0.07] px-2 py-0.5 rounded">
                              {entry.journal}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">{entry.referencePiece || "—"}</td>
                          <td className="px-4 py-3 text-[11px] text-gray-200 max-w-xs truncate" title={entry.label}>{entry.label}</td>
                          <td className="px-4 py-3 text-[11px] font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                            {entry.debit > 0 ? `+$${Number(entry.debit).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] font-bold text-rose-400 tabular-nums whitespace-nowrap">
                            {entry.credit > 0 ? `-$${Number(entry.credit).toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-white/[0.05]">
                {filteredLedger.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">Aucune écriture pour {getPeriodLabel()}</div>
                ) : (
                  filteredLedger.map((entry) => (
                    <div key={entry.id || entry.entryNumber} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-200 font-bold">{entry.entryNumber}</span>
                          <span className="font-mono text-[9px] font-bold text-gray-300 bg-white/10 px-1.5 py-0.5 rounded">{entry.journal}</span>
                        </div>
                        <span className="text-gray-500 text-[10px]">{formatEntryDate(entry.date)}</span>
                      </div>
                      <p className="text-xs text-white line-clamp-2">{entry.label}</p>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.05]">
                        <span className="font-mono text-[10px] text-gray-500">{entry.referencePiece || "—"}</span>
                        {entry.debit > 0 ? (
                          <span className="font-bold text-emerald-400 tabular-nums">+${Number(entry.debit).toFixed(2)}</span>
                        ) : (
                          <span className="font-bold text-rose-400 tabular-nums">-${Number(entry.credit).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LIVRE DE CAISSE */}
          {activeTab === "overview" && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.08]">
                <h2 className="text-sm font-bold text-white">Livre de Caisse Plateforme ({getPeriodLabel()})</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Historique immuable des encaissements et décaissements Rayons.net.</p>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      {["Date", "Type", "Description", "Référence", "Montant"].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider last:text-right">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {periodTx.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-xs text-gray-500">
                          Aucune transaction pour {getPeriodLabel()}.
                        </td>
                      </tr>
                    ) : (
                      periodTx.map((t) => (
                        <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{formatEntryDate(t.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                                t.type === "EXPENSE"
                                  ? "text-rose-300 bg-rose-500/10"
                                  : "text-emerald-300 bg-emerald-500/10"
                              }`}
                            >
                              {t.type === "SUBSCRIPTION" ? "Abonnement" : t.type === "OTHER_INCOME" ? "Recette" : "Dépense"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-200 max-w-md truncate">{t.description}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">{t.referenceId || "—"}</td>
                          <td
                            className={`px-4 py-3 text-right text-[11px] font-bold tabular-nums whitespace-nowrap ${
                              t.type === "EXPENSE" ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {t.type === "EXPENSE" ? "-" : "+"}${Number(t.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-white/[0.05]">
                {periodTx.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">Aucune transaction pour {getPeriodLabel()}.</div>
                ) : (
                  periodTx.map((t) => (
                    <div key={t.id} className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${t.type === "EXPENSE" ? "text-rose-300 bg-rose-500/10" : "text-emerald-300 bg-emerald-500/10"}`}>
                          {t.type === "SUBSCRIPTION" ? "Abonnement" : t.type === "OTHER_INCOME" ? "Recette" : "Dépense"}
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${t.type === "EXPENSE" ? "text-rose-400" : "text-emerald-400"}`}>
                          {t.type === "EXPENSE" ? "-" : "+"}${Number(t.amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-200">{t.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>{formatEntryDate(t.createdAt)}</span>
                        <span className="font-mono">{t.referenceId || "—"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: COMMISSIONS PARTENAIRES */}
          {activeTab === "commissions" && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Award size={15} className="text-[#C7D300]" />
                    <span>Commissions Partenaires &amp; Crédit Direct</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Soldes apporteurs d&apos;affaires agréés · Crédit direct audité
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedPartnerId(partners[0]?.id || "");
                    setIsCommissionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-lg font-bold text-xs transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <Plus size={14} />
                  <span>Créditer une Commission</span>
                </button>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      {["Partenaire", "Code", "Boutiques", "Solde Disponible", "Cumulé à Vie", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider last:text-right">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {partners.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-xs text-gray-500">Aucun partenaire enregistré.</td>
                      </tr>
                    ) : (
                      partners.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-white">{p.displayName}</p>
                            <p className="text-[11px] text-gray-500">{p.email || p.phone || "—"}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#C7D300]">{p.referralCode}</td>
                          <td className="px-4 py-3 text-xs text-gray-300">{p.referralCount} boutique{p.referralCount > 1 ? "s" : ""}</td>
                          <td className="px-4 py-3 text-xs font-bold text-emerald-400 tabular-nums">${Number(p.balance || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-300 tabular-nums">${Number(p.totalEarned || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedPartnerId(p.id);
                                setIsCommissionModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
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

              <div className="md:hidden divide-y divide-white/[0.05]">
                {partners.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">Aucun partenaire enregistré.</div>
                ) : (
                  partners.map((p) => (
                    <div key={p.id} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{p.displayName}</p>
                          <p className="text-[10px] text-gray-500 truncate">{p.email || p.phone || "—"}</p>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#C7D300] bg-[#C7D300]/10 px-2 py-0.5 rounded">{p.referralCode}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.05]">
                        <span className="text-emerald-400 font-bold tabular-nums">${Number(p.balance || 0).toFixed(2)} dispo</span>
                        <button
                          onClick={() => {
                            setSelectedPartnerId(p.id);
                            setIsCommissionModalOpen(true);
                          }}
                          className="px-3 py-1 bg-white/[0.06] text-white rounded text-xs font-semibold"
                        >
                          Créditer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: SUIVI RENTABILITÉ DES PROPRES RAYONS ADMIN (LECTURE SEULE — SANS ENCAISSEMENT PLATEFORME) */}
          {activeTab === "admin_shop" && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Suivi Rentabilité — Propres Rayons de l&apos;Admin (Lecture Seule)
                    </h2>
                    <p className="text-xs text-gray-400">
                      Seule la boutique officielle encaisse ses ventes. Ici, l&apos;Admin visualise uniquement la somme investie, le prix de vente et le gain net sur ses propres rayons ({getPeriodLabel()}).
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 whitespace-nowrap self-start">
                    <ShieldCheck size={12} /> Exclusivement Rayons Admin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                      Somme Investie (Coût Produits)
                    </span>
                    <div className="text-2xl font-bold text-amber-300 mt-1 tabular-nums">
                      ${adminShopAnalytics.invested.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-gray-500">Capital d&apos;achat sur les ventes livrées</span>
                  </div>

                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                      Prix de Vente Total (Boutique Admin)
                    </span>
                    <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                      ${adminShopAnalytics.revenue.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-gray-500">{periodAdminSales.length} vente(s) livrée(s)</span>
                  </div>

                  <div className="bg-black/30 p-4 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-300 uppercase font-semibold block">
                      Gain Net Reçu (Marge)
                    </span>
                    <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                      ${adminShopAnalytics.profit.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-emerald-300/80">
                      Marge moyenne : {adminShopAnalytics.marginPct}%
                    </span>
                  </div>
                </div>

                {adminShopAnalytics.byRayon.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {adminShopAnalytics.byRayon.map((r) => {
                      const badge = formatRayonBadge(r.rayon);
                      return (
                        <div key={r.rayon} className="bg-black/20 p-3.5 rounded-xl border border-white/[0.06] space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                            <span className="text-[10px] text-gray-400">{r.count} vente(s)</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Investi :</span>
                            <span className="text-amber-300 font-semibold tabular-nums">${r.invested.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Vendu :</span>
                            <span className="text-white font-semibold tabular-nums">${r.revenue.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-white/[0.06] pt-1">
                            <span className="text-gray-300 font-semibold">Gain :</span>
                            <span className="text-emerald-400 font-bold tabular-nums">+${r.profit.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Détail des ventes sur vos propres rayons
                  </h3>
                  <span className="text-[11px] text-gray-500">Hors vendeurs tiers</span>
                </div>
                {periodAdminSales.length === 0 ? (
                  <p className="p-6 text-center text-xs text-gray-500">
                    Aucune vente livrée sur les propres rayons de l&apos;Admin pour cette période.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/25 text-[10px] uppercase text-gray-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Produit (Rayon)</th>
                          <th className="px-4 py-3 text-right">Investi</th>
                          <th className="px-4 py-3 text-right">Prix Vente</th>
                          <th className="px-4 py-3 text-right">Gain Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {periodAdminSales.map((s) => {
                          const badge = formatRayonBadge(s.rayon);
                          return (
                            <tr key={s.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-gray-400 font-mono whitespace-nowrap">
                                {formatEntryDate(s.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{s.title}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badge.badgeClass}`}>
                                    {badge.label}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    Qté {s.quantity} · #{s.orderId.slice(-8)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-amber-300 tabular-nums font-medium">
                                ${Number(s.invested || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right text-white tabular-nums font-semibold">
                                ${Number(s.revenue || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-400 tabular-nums font-bold">
                                +${Number(s.profit || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PARAMÈTRES FINANCIERS & DOUBLE VALIDATION */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              {pendingProposal && pendingProposal.status === "PENDING_APPROVAL" && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Proposition financière en attente d&apos;approbation</h3>
                        <p className="text-xs text-amber-200/80">
                          Demandée par <strong>{pendingProposal.requestedByName}</strong> ({pendingProposal.requestedByRole})
                        </p>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleApproveProposal}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold rounded-lg text-xs cursor-pointer"
                        >
                          <Check size={13} /> Approuver
                        </button>
                        <button
                          onClick={() => setIsRejectModalOpen(true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 text-rose-200 font-semibold rounded-lg text-xs border border-rose-500/30 cursor-pointer"
                        >
                          <X size={13} /> Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
                      <span className="text-[10px] text-gray-400 uppercase block">Taux USD / CDF</span>
                      <span className="text-gray-500 line-through mr-2">{pendingProposal.current?.usdToFcRate}</span>
                      <span className="font-bold text-[#C7D300]">➔ {pendingProposal.proposed?.usdToFcRate} FC</span>
                    </div>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
                      <span className="text-[10px] text-gray-400 uppercase block">Commission Partenaire</span>
                      <span className="text-gray-500 line-through mr-2">${pendingProposal.current?.referralCommissionUSD}</span>
                      <span className="font-bold text-[#C7D300]">➔ ${pendingProposal.proposed?.referralCommissionUSD}</span>
                    </div>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
                      <span className="text-[10px] text-gray-400 uppercase block">Abonnement Mensuel</span>
                      <span className="text-gray-500 line-through mr-2">${pendingProposal.current?.monthlySubscriptionPrice}</span>
                      <span className="font-bold text-[#C7D300]">➔ ${pendingProposal.proposed?.monthlySubscriptionPrice}</span>
                    </div>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
                      <span className="text-[10px] text-gray-400 uppercase block">Réduction Promo</span>
                      <span className="text-gray-500 line-through mr-2">-${pendingProposal.current?.promoDiscountUSD}</span>
                      <span className="font-bold text-[#C7D300]">➔ -${pendingProposal.proposed?.promoDiscountUSD}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">Paramètres Financiers Plateforme</h2>
                    <p className="text-xs text-gray-400">Taux de change, tarification abonnement et commission partenaire</p>
                  </div>
                  <button
                    onClick={() => setIsProposalModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Sliders size={13} />
                    <span>{isSuperAdmin ? "Modifier les paramètres" : "Proposer une modification"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Taux USD / CDF</span>
                    <div className="text-xl font-bold text-white mt-1 tabular-nums">1 $ = {financialSettings?.usdToFcRate || 2850} FC</div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Commission Partenaire</span>
                    <div className="text-xl font-bold text-[#C7D300] mt-1 tabular-nums">${financialSettings?.referralCommissionUSD || 5} USD</div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Abonnement Mensuel</span>
                    <div className="text-xl font-bold text-white mt-1 tabular-nums">${financialSettings?.monthlySubscriptionPrice || 50} USD</div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Réduction Code Promo</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">-${financialSettings?.promoDiscountUSD || 10} USD</div>
                  </div>
                </div>
              </div>

              {/* CARTE VISA / MASTERCARD & PRÉLÈVEMENT AUTOMATIQUE (LIENS DYNAMIQUES) */}
              <form
                onSubmit={handleSaveVisaConfig}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-white">
                          Paiement Carte Visa / Mastercard &amp; Prélèvement Automatique
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            financialSettings?.visaEnabled &&
                            (financialSettings?.visaSubscriptionUrl || financialSettings?.visaCheckoutUrl)
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                              : "bg-white/5 text-gray-400 border-white/10"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              financialSettings?.visaEnabled &&
                              (financialSettings?.visaSubscriptionUrl || financialSettings?.visaCheckoutUrl)
                                ? "bg-emerald-400"
                                : "bg-gray-500"
                            }`}
                          />
                          {financialSettings?.visaEnabled &&
                          (financialSettings?.visaSubscriptionUrl || financialSettings?.visaCheckoutUrl)
                            ? `Actif (${financialSettings?.visaProviderName || "Stripe"})`
                            : "En attente de lien"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Configurez vos liens de paiement hébergés (HTTPS) pour les abonnements fournisseurs mensuels automatiques et les achats clients. Synchronisé en temps réel via Redis.
                      </p>
                    </div>
                  </div>
                  {isSuperAdmin ? (
                    <button
                      type="submit"
                      disabled={isSavingVisa}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] disabled:opacity-50 text-[#0F1D27] font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <ShieldCheck size={14} />
                      <span>{isSavingVisa ? "Enregistrement..." : "Enregistrer les liens Visa"}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-400 whitespace-nowrap">
                      <Lock size={12} /> Réservé Super Admin / DG
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between gap-3 bg-black/30 p-3.5 rounded-xl border border-white/[0.06] cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-white block">Activer la Carte Visa</span>
                      <span className="text-[11px] text-gray-400">Affiche l&apos;option Visa sur le site</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visaEnabled}
                      disabled={!isSuperAdmin}
                      onChange={(e) => setVisaEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#C7D300] cursor-pointer disabled:opacity-50"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 bg-black/30 p-3.5 rounded-xl border border-white/[0.06] cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-white block">Prélèvement mensuel auto</span>
                      <span className="text-[11px] text-gray-400">Renouvellement ${financialSettings?.monthlySubscriptionPrice || 50}/mois</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visaAutoBillingEnabled}
                      disabled={!isSuperAdmin}
                      onChange={(e) => setVisaAutoBillingEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#C7D300] cursor-pointer disabled:opacity-50"
                    />
                  </label>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/[0.06]">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1.5">
                      Prestataire Passerelle
                    </label>
                    <select
                      value={visaProviderName}
                      disabled={!isSuperAdmin}
                      onChange={(e) => setVisaProviderName(e.target.value)}
                      className="w-full bg-[#0B151D] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C7D300]/50 disabled:opacity-60"
                    >
                      <option value="Stripe">Stripe (Recommandé · Auto-Billing)</option>
                      <option value="Flutterwave">Flutterwave (RDC / Afrique · Visa)</option>
                      <option value="FlexPay">FlexPay RDC (Visa / Mastercard)</option>
                      <option value="Maxicash">Maxicash (Visa / Mastercard)</option>
                      <option value="CinetPay">CinetPay</option>
                      <option value="PayPal">PayPal</option>
                      <option value="Passerelle Visa">Autre passerelle HTTPS</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-gray-300 font-semibold uppercase tracking-wider">
                        Lien Visa · Abonnement Fournisseur (${financialSettings?.monthlySubscriptionPrice || 50}/mois)
                      </label>
                      {visaSubscriptionUrl && (
                        <a
                          href={visaSubscriptionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
                        >
                          Tester <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <input
                      type="url"
                      value={visaSubscriptionUrl}
                      disabled={!isSuperAdmin}
                      onChange={(e) => setVisaSubscriptionUrl(e.target.value)}
                      placeholder="https://buy.stripe.com/... (lien récurrent mensuel)"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 font-mono focus:outline-none focus:border-[#C7D300]/50 disabled:opacity-60"
                    />
                    <p className="text-[11px] text-gray-500">
                      Utilisé dans l&apos;inscription fournisseur et la modale de renouvellement. Le paramètre <code className="text-gray-300">client_reference_id=sub_&#123;uid&#125;</code> est injecté automatiquement.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-gray-300 font-semibold uppercase tracking-wider">
                        Lien Visa · Boutique &amp; Achats Clients
                      </label>
                      {visaCheckoutUrl && (
                        <a
                          href={visaCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
                        >
                          Tester <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <input
                      type="url"
                      value={visaCheckoutUrl}
                      disabled={!isSuperAdmin}
                      onChange={(e) => setVisaCheckoutUrl(e.target.value)}
                      placeholder="https://buy.stripe.com/... ou lien checkout hébergé"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 font-mono focus:outline-none focus:border-[#C7D300]/50 disabled:opacity-60"
                    />
                    <p className="text-[11px] text-gray-500">
                      Affiché dans le tunnel de commande client. La référence <code className="text-gray-300">client_reference_id=ord_&#123;orderId&#125;</code> permet la confirmation automatique.
                    </p>
                  </div>
                </div>

                <div className="bg-[#0B151D] border border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                      Endpoint Webhook de Prélèvement Automatique (Fail-Closed · HMAC-SHA256)
                    </span>
                    <code className="text-xs font-mono text-white block truncate">
                      {financialSettings?.visaWebhookEndpoint || "https://rayons.net/api/payments/visa-webhook"}
                    </code>
                    <p className="text-[11px] text-gray-400">
                      À coller dans le tableau de bord de votre prestataire (événements <code className="text-gray-300">checkout.session.completed</code> &amp; <code className="text-gray-300">invoice.paid</code>) avec la variable serveur <code className="text-gray-300">STRIPE_WEBHOOK_SECRET</code> ou <code className="text-gray-300">VISA_WEBHOOK_SECRET</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white cursor-pointer shrink-0 transition-colors"
                  >
                    {copiedWebhook ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedWebhook ? "Copié !" : "Copier l'URL Webhook"}</span>
                  </button>
                </div>
              </form>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-2.5">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Historique des validations</h3>
                {financialHistory.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucun changement récent enregistré.</p>
                ) : (
                  <div className="divide-y divide-white/[0.05] text-xs">
                    {financialHistory.map((h) => (
                      <div key={h.id} className="py-2.5 flex items-center justify-between text-gray-400">
                        <div>
                          <span className="font-semibold text-white">{h.reason || "Mise à jour financière"}</span>
                          <p className="text-[10px] text-gray-500">
                            Validé par {h.approvedByName || h.appliedByName || "Direction"} · Taux {h.values?.usdToFcRate} FC · Comm. ${h.values?.referralCommissionUSD}
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
        </>
      )}

      {/* MODAL 1 : ENCAISSEMENT SÉCURISÉ D'ABONNEMENT (PREUVE OBLIGATOIRE + ANTI-DOUBLON) */}
      <AnimatePresence>
        {paymentTargetSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>Enregistrer un Paiement d&apos;Abonnement</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {paymentTargetSupplier.displayName || paymentTargetSupplier.email}
                  </p>
                </div>
                <button
                  onClick={() => setPaymentTargetSupplier(null)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmSubscriptionPayment} className="p-6 space-y-4">
                {targetAlreadyActive && targetSubInfo && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Attention :</strong> ce fournisseur est <strong>déjà actif</strong> jusqu&apos;au{" "}
                      <strong>{targetSubInfo.formattedDueDate}</strong>. Ne validez que si vous avez effectivement reçu une avance supplémentaire (+30 jours).
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
                      Canal de paiement *
                    </label>
                    <select
                      value={subChannel}
                      onChange={(e) => setSubChannel(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-white/25"
                    >
                      {PAYMENT_CHANNELS.map((c) => (
                        <option key={c} value={c} className="bg-[#0F1D27]">{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
                      Montant reçu ($ USD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={subAmount}
                      onChange={(e) => setSubAmount(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:border-white/25"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
                    Référence unique de transaction / Reçu *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={subRef}
                    onChange={(e) => setSubRef(e.target.value)}
                    placeholder="ex: MP261123.1420.A123 ou REC-CAISSE-042"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#C7D300]/60 placeholder:text-gray-600"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Verrou anti-doublon : une même référence ne peut jamais être encaissée deux fois.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
                    Note interne (optionnel)
                  </label>
                  <input
                    type="text"
                    value={subNote}
                    onChange={(e) => setSubNote(e.target.value)}
                    placeholder="ex: Paiement mensuel décembre validé par la caisse"
                    className="w-full px-3.5 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentTargetSupplier(null)}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSub}
                    className="px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingSub ? "Validation atomique..." : `Confirmer $${subAmount || 0} (+30j)`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2 : NOUVELLE ÉCRITURE PLATEFORME (SERVEUR + AUDIT) */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus size={16} className="text-[#C7D300]" />
                    <span>Nouvelle Écriture Plateforme</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Enregistrée de façon immuable dans le Grand Livre Rayons.net
                  </p>
                </div>
                <button onClick={() => setIsTxModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveManualEntry} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxKind("OTHER_INCOME")}
                    className={`py-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      txKind === "OTHER_INCOME"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-white/[0.04] text-gray-400 border-white/10"
                    }`}
                  >
                    + Recette Plateforme
                  </button>
                  <button
                    type="button"
                    disabled={!isSuperAdmin}
                    onClick={() => setTxKind("EXPENSE")}
                    title={!isSuperAdmin ? "Réservé au Directeur Général (Super Admin)" : ""}
                    className={`py-2.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      txKind === "EXPENSE"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : "bg-white/[0.04] text-gray-400 border-white/10"
                    }`}
                  >
                    - Dépense {!isSuperAdmin && "(DG)"}
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="50.00"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Libellé comptable *</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    placeholder="ex: Hébergement serveur cloud / Sponsoring campagne"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">N° Pièce justificative</label>
                  <input
                    type="text"
                    value={txReference}
                    onChange={(e) => setTxReference(e.target.value)}
                    placeholder="ex: FACT-2026-014"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white font-mono text-xs placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => setIsTxModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTx}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingTx ? "Enregistrement..." : "Valider l'Écriture"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3 : AJUSTEMENT DE CAISSE (SUPER ADMIN UNIQUEMENT) */}
      <AnimatePresence>
        {isAdjustmentModalOpen && isSuperAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-lg bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="text-[#C7D300]" size={15} />
                    <span>Ajustement de Caisse (Direction Générale)</span>
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Solde actuel : <span className="text-white font-semibold tabular-nums">${currentBalance.toFixed(2)}</span> · Audité dans `audit_logs`
                  </p>
                </div>
                <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType("ADD")}
                    className={`py-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      adjType === "ADD"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-white/[0.04] text-gray-400 border-white/10"
                    }`}
                  >
                    + Entrée / Apport
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType("SUBTRACT")}
                    className={`py-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      adjType === "SUBTRACT"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : "bg-white/[0.04] text-gray-400 border-white/10"
                    }`}
                  >
                    - Sortie / Prélèvement
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="50.00"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Motif *</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs"
                  >
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#0F1D27]">{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Libellé précis *</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={adjLabel}
                    onChange={(e) => setAdjLabel(e.target.value)}
                    placeholder="ex: Régularisation inventaire coffre central"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">N° Pièce justificative</label>
                  <input
                    type="text"
                    value={adjRef}
                    onChange={(e) => setAdjRef(e.target.value)}
                    placeholder="ex: REC-INV-2026-01"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white font-mono text-xs placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdj}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingAdj ? "Enregistrement..." : "Valider l'Ajustement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4 : CRÉDITER COMMISSION PARTENAIRE */}
      <AnimatePresence>
        {isCommissionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="text-[#C7D300]" size={16} />
                  <span>Créditer une Commission Partenaire</span>
                </h2>
                <button onClick={() => setIsCommissionModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreditCommissionSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Partenaire *</label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs"
                  >
                    <option value="">Sélectionnez un partenaire</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0F1D27]">
                        {p.displayName} ({p.referralCode} · Solde: ${Number(p.balance || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Montant ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    required
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    placeholder="25.00"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">Motif *</label>
                  <input
                    type="text"
                    required
                    value={commissionReason}
                    onChange={(e) => setCommissionReason(e.target.value)}
                    placeholder="ex: Prime apport 5 nouvelles boutiques"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs placeholder:text-gray-600"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button type="button" onClick={() => setIsCommissionModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCommission}
                    className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingCommission ? "Enregistrement..." : "Créditer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5 : PARAMÈTRES FINANCIERS */}
      <AnimatePresence>
        {isProposalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-lg bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <h2 className="text-sm font-bold text-white">
                  {isSuperAdmin ? "Modifier les Paramètres Financiers" : "Proposer une Modification Financière"}
                </h2>
                <button onClick={() => setIsProposalModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleProposeChangeSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Taux USD / CDF *</label>
                    <input type="number" required value={formUsdRate} onChange={(e) => setFormUsdRate(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Commission ($ USD) *</label>
                    <input type="number" required value={formCommission} onChange={(e) => setFormCommission(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Abonnement ($ USD) *</label>
                    <input type="number" required value={formSubscription} onChange={(e) => setFormSubscription(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Réduction Promo ($ USD) *</label>
                    <input type="number" required value={formPromo} onChange={(e) => setFormPromo(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase">Justification *</label>
                  <textarea required rows={2} value={formReason} onChange={(e) => setFormReason(e.target.value)} className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                </div>
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => setIsProposalModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" disabled={isSubmittingProposal} className="px-5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">
                    {isSubmittingProposal ? "Traitement..." : isSuperAdmin ? "Appliquer" : "Soumettre au DG"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6 : REJET PROPOSITION */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <span>Rejeter la proposition</span>
              </h3>
              <form onSubmit={handleRejectProposalSubmit} className="space-y-4">
                <textarea required rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Motif du refus..." className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs" />
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white cursor-pointer">Annuler</button>
                  <button type="submit" className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg cursor-pointer">Confirmer le rejet</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
