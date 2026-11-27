"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  Truck,
  LifeBuoy,
  Package,
  Building,
  Users,
  Store,
  RefreshCw,
  ArrowRight,
  Bell,
  ChevronRight,
  CheckCircle2,
  Mail,
  Send,
  Smartphone,
  Activity,
  Sparkles,
  CalendarClock,
  AlertTriangle,
  Gauge,
  Clock,
  UserCheck,
  Briefcase,
  Target,
  SlidersHorizontal,
  X,
  Save,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasAdminAccess } from "@/lib/permissions";
import RevenueAreaChart from "@/modules/shared/components/charts/RevenueAreaChart";
import StatusPieChart from "@/modules/shared/components/charts/StatusPieChart";
import { StaffGoalsModal } from "./components/StaffGoalsModal";
import AdminBroadcastModal from "@/modules/admin/components/AdminBroadcastModal";

type PoleId = "overview" | "finance" | "logistics" | "support" | "catalogue" | "growth";
type RangeDays = 7 | 30 | 90;

interface TrendInfo {
  current: number;
  previous: number;
  deltaPct: number;
  direction: "up" | "down" | "flat";
}

interface KpiCardItem {
  title: string;
  value: string | number;
  subtitle: string;
  subInfo: string;
  icon: any;
  href?: string;
  alert?: boolean;
  trend?: TrendInfo;
}

interface GoalGaugeItem {
  id: string;
  label: string;
  currentDisplay: string;
  targetDisplay: string;
  pct: number;
  onTrack: boolean;
  helper: string;
  barColor: string;
}

interface ActionCardItem {
  title: string;
  description: string;
  buttonText: string;
  href: string;
  isPrimary?: boolean;
}

interface AlertCardItem {
  title: string;
  description: string;
  href: string;
  tone: "amber" | "rose" | "blue" | "emerald";
}

function formatMoney(v: number) {
  return `$${Math.round(Number(v || 0)).toLocaleString("fr-FR")}`;
}

function TrendBadge({ trend, rangeDays }: { trend?: TrendInfo; rangeDays: RangeDays }) {
  if (!trend) return null;
  const isUp = trend.direction === "up";
  const isDown = trend.direction === "down";
  const badgeClass = isUp
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
    : isDown
    ? "bg-red-500/15 text-red-300 border-red-500/25"
    : "bg-white/5 text-gray-400 border-white/10";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const sign = trend.deltaPct > 0 ? "+" : "";

  return (
    <span
      title={`Comparé aux ${rangeDays} jours précédents`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold tabular-nums shrink-0 ${badgeClass}`}
    >
      <Icon size={10} />
      <span>
        {sign}
        {trend.deltaPct}%
      </span>
    </span>
  );
}

export default function StaffDashboardView() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const isAuthorized = hasAdminAccess(user, userData);

  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [data, setData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePole, setActivePole] = useState<PoleId>("overview");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isSendingReports, setIsSendingReports] = useState(false);

  // Modal objectifs mensuels (Direction uniquement)
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsForm, setGoalsForm] = useState({
    monthlyRevenueTargetUSD: 1500,
    deliveryRateTargetPct: 95,
    supportResolutionTargetPct: 90,
    catalogueApprovalTargetPct: 90,
    monthlyNewSignupsTarget: 50,
  });

  const loadDashboard = useCallback(
    async (selectedRange: RangeDays, isSoftRefresh = false) => {
      if (!user) return;
      if (isSoftRefresh) setRefreshing(true);
      else setFetching(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/staff-dashboard?range=${selectedRange}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Impossible de charger le tableau de bord.");
        }
        setData(json);
        if (json.goals) {
          setGoalsForm(json.goals);
        }
      } catch (err: any) {
        console.error("[STAFF DASHBOARD]", err);
        setError(err.message || "Erreur lors du chargement des statistiques.");
      } finally {
        setFetching(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!isAuthorized) {
        router.push("/");
      } else {
        loadDashboard(rangeDays, Boolean(data));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isAuthorized, rangeDays]);

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingGoals(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/staff-dashboard", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(goalsForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible d'enregistrer les objectifs.");
      }
      setIsGoalsModalOpen(false);
      await loadDashboard(rangeDays, true);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la sauvegarde.");
    } finally {
      setSavingGoals(false);
    }
  };

  // Déterminer les pôles accessibles pour ce membre du Team
  const availablePoles = useMemo<{ id: PoleId; label: string; icon: any }[]>(() => {
    if (!data?.scopes) return [];
    const list: { id: PoleId; label: string; icon: any }[] = [];
    if (data.isFullAdmin) {
      list.push({ id: "overview", label: "Vue 360°", icon: Activity });
    }
    if (data.scopes.finance) list.push({ id: "finance", label: "Finances", icon: Wallet });
    if (data.scopes.logistics) list.push({ id: "logistics", label: "Logistique", icon: Truck });
    if (data.scopes.support) list.push({ id: "support", label: "Service Client", icon: LifeBuoy });
    if (data.scopes.catalogue) list.push({ id: "catalogue", label: "Catalogue", icon: Package });
    if (data.scopes.growth && !data.isFullAdmin) {
      list.push({ id: "growth", label: "Gestion & KYC", icon: Briefcase });
    }
    return list;
  }, [data]);

  useEffect(() => {
    if (availablePoles.length === 0) return;
    if (!availablePoles.some((p) => p.id === activePole)) {
      setActivePole(availablePoles[0].id);
    }
  }, [availablePoles, activePole]);

  const handleTriggerDailyReports = async () => {
    if (!confirm("Voulez-vous générer et envoyer les rapports journaliers maintenant (aux fournisseurs et à la direction) ?")) {
      return;
    }
    setIsSendingReports(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/cron/daily-reports", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const resJson = await res.json();
      if (resJson.success) {
        alert(
          `✅ Rapports journaliers (07h00) envoyés !\n` +
            `• Période : ${resJson.date}\n` +
            `• Fournisseurs notifiés : ${resJson.suppliersNotified} / ${resJson.suppliersCount}\n` +
            `• Volume d'affaires : ${resJson.metrics?.totalGlobalTurnover?.toLocaleString("fr-FR")} $`
        );
      } else {
        alert(`❌ Erreur: ${resJson.error || "Impossible d'envoyer les rapports"}`);
      }
    } catch (err: any) {
      alert(`Erreur: ${err.message || "Erreur de connexion"}`);
    } finally {
      setIsSendingReports(false);
    }
  };

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-white flex flex-col items-center">
          <ShieldAlert size={44} className="text-[#C7D300] mb-3 animate-pulse" />
          <p className="text-xs font-medium text-gray-400">Vérification des accès sécurisés...</p>
        </div>
      </div>
    );
  }

  if (fetching && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-gray-400">
        <div className="w-10 h-10 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium animate-pulse">Chargement de vos statistiques, objectifs et prévoyances...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-[#0F1A23] border border-red-500/30 rounded-2xl p-6 text-center">
        <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white mb-1">Erreur de chargement</h2>
        <p className="text-xs text-gray-400 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => loadDashboard(rangeDays, false)}
          className="px-4 py-2 rounded-xl bg-[#C7D300] text-[#0F1D27] text-xs font-bold cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const fin = data?.finance;
  const log = data?.logistics;
  const sup = data?.support;
  const cat = data?.catalogue;
  const grw = data?.growth;
  const monthCtx = data?.monthContext;

  const rangeLabel =
    rangeDays === 7 ? "7 derniers jours" : rangeDays === 90 ? "90 derniers jours (par semaine)" : "30 derniers jours";

  const poleHeaderMap: Record<PoleId, { badge: string; title: string; desc: string }> = {
    overview: {
      badge: "Direction Générale · Vue 360°",
      title: "Tableau de Bord Exécutif",
      desc: "Pilotage en temps réel des revenus, objectifs mensuels, évolutions et prévoyances de la plateforme.",
    },
    finance: {
      badge: "Pôle Finances & Trésorerie",
      title: "Statistiques & Prévoyances Financières",
      desc: "Suivi des encaissements, objectifs mensuels, recouvrements impayés et projections 30j / 90j / ARR.",
    },
    logistics: {
      badge: "Pôle Logistique & Flotte",
      title: "Supervision Courses & Livraisons",
      desc: "Suivi en direct des livreurs, évolution des courses, objectif de livraison et prévoyance de charge.",
    },
    support: {
      badge: "Pôle Service Client & SAV",
      title: "Assistance & Requêtes Clients",
      desc: "Suivi des tickets ouverts, taux de résolution cible, évolution des demandes et charge SAV.",
    },
    catalogue: {
      badge: "Pôle Catalogue & Modération",
      title: "Qualité Catalogue & 4 Rayons",
      desc: "Contrôle des produits e-commerce, biens immobiliers, rythme de publication et file d'approbation.",
    },
    growth: {
      badge: "Gestion Administrative & KYC",
      title: "Croissance, KYC & Partenaires",
      desc: "Suivi des nouvelles inscriptions, objectifs d'acquisition mensuels et validations KYC fournisseurs.",
    },
  };

  const currentHeader = poleHeaderMap[activePole] || poleHeaderMap.overview;

  // ── 1. TOP 4 KPI CARDS (avec badges de tendance % vs période précédente) ──
  let kpis: KpiCardItem[] = [];
  if (activePole === "overview") {
    kpis = [
      {
        title: `Revenus (${rangeDays}j)`,
        value: formatMoney(fin?.summary?.periodRevenueUSD ?? 0),
        subtitle: `Cumul total : ${formatMoney(fin?.summary?.collectedSubscriptionRevenueUSD ?? 0)}`,
        subInfo: `${fin?.summary?.paidActiveCount ?? 0} payés · ${fin?.summary?.unpaidExpiredCount ?? 0} impayés`,
        icon: Wallet,
        href: "/admin/finance",
        trend: fin?.trends?.revenue,
        alert: (fin?.summary?.unpaidExpiredCount ?? 0) > 0 || (fin?.summary?.pendingMobileMoneyCount ?? 0) > 0,
      },
      {
        title: `Volume GMV (${rangeDays}j)`,
        value: formatMoney(log?.summary?.periodGMV ?? 0),
        subtitle: `${log?.summary?.periodOrders ?? 0} commande(s) · ${log?.summary?.completionRate ?? 100}% livrées`,
        subInfo: `${log?.summary?.ordersAwaitingDriver ?? 0} en attente · ${log?.summary?.totalDrivers ?? 0} livreur(s)`,
        icon: Truck,
        href: "/admin/orders",
        trend: log?.trends?.gmv,
        alert: (log?.summary?.ordersAwaitingDriver ?? 0) > 0,
      },
      {
        title: `Nouveaux Comptes (${rangeDays}j)`,
        value: grw?.summary?.periodSignups ?? 0,
        subtitle: `${grw?.summary?.totalClients ?? 0} clients · ${grw?.summary?.activeSuppliers ?? 0} boutiques`,
        subInfo: `${cat?.summary?.pendingSuppliersKyc ?? 0} KYC · ${cat?.summary?.totalPendingModeration ?? 0} annonces à valider`,
        icon: Users,
        href: "/admin/suppliers",
        trend: grw?.trends?.signups,
        alert: (cat?.summary?.pendingSuppliersKyc ?? 0) + (cat?.summary?.totalPendingModeration ?? 0) > 0,
      },
      {
        title: `Requêtes SAV (${rangeDays}j)`,
        value: `${sup?.summary?.openTickets ?? 0} ouverte(s)`,
        subtitle: `${sup?.summary?.periodTickets ?? 0} reçue(s) · ${sup?.summary?.resolutionRate ?? 100}% résolues`,
        subInfo: `${grw?.summary?.installedAppsCount ?? 0} app(s) mobiles installées`,
        icon: LifeBuoy,
        href: "/admin/tickets",
        trend: sup?.trends?.tickets,
        alert: (sup?.summary?.openTickets ?? 0) > 0,
      },
    ];
  } else if (activePole === "finance") {
    kpis = [
      {
        title: `Encaissé (${rangeDays}j)`,
        value: formatMoney(fin?.summary?.periodRevenueUSD ?? 0),
        subtitle: `Mois en cours : ${formatMoney(fin?.summary?.mtdRevenueUSD ?? 0)}`,
        subInfo: `Cumul global : ${formatMoney(fin?.summary?.collectedSubscriptionRevenueUSD ?? 0)}`,
        icon: Wallet,
        href: "/admin/finance",
        trend: fin?.trends?.revenue,
      },
      {
        title: "Prévision Nette (30j)",
        value: formatMoney(fin?.forecasts?.projected30dNetRevenue ?? 0),
        subtitle: `MRR acquis : ${formatMoney(fin?.forecasts?.currentMRR ?? 0)}/mois`,
        subInfo: `ARR estimé : ${formatMoney(fin?.forecasts?.projectedAnnualARR ?? 0)}/an`,
        icon: TrendingUp,
        href: "/admin/finance",
      },
      {
        title: "Impayés & Mobile Money",
        value: fin?.summary?.unpaidExpiredCount ?? 0,
        subtitle: `Recouvrement : +${formatMoney(fin?.forecasts?.overdueRecoveryPotential ?? 0)}`,
        subInfo: `${fin?.summary?.pendingMobileMoneyCount ?? 0} preuve(s) Mobile Money à valider`,
        icon: AlertTriangle,
        href: "/admin/finance",
        alert: (fin?.summary?.unpaidExpiredCount ?? 0) > 0 || (fin?.summary?.pendingMobileMoneyCount ?? 0) > 0,
      },
      {
        title: "Commissions Partenaires",
        value: formatMoney(fin?.summary?.pendingPartnerPayoutsUSD ?? 0),
        subtitle: "Soldes à verser",
        subInfo: `Déjà versé : ${formatMoney(fin?.summary?.paidPartnerPayoutsUSD ?? 0)}`,
        icon: Briefcase,
        href: "/admin/partners",
        alert: (fin?.summary?.pendingPartnerPayoutsUSD ?? 0) > 0,
      },
    ];
  } else if (activePole === "logistics") {
    kpis = [
      {
        title: `Courses (${rangeDays}j)`,
        value: log?.summary?.periodOrders ?? 0,
        subtitle: `Taux de réussite : ${log?.summary?.completionRate ?? 100}%`,
        subInfo: `${log?.summary?.ordersCompleted ?? 0} livrées au total`,
        icon: CheckCircle2,
        href: "/admin/orders",
        trend: log?.trends?.orders,
      },
      {
        title: "Courses en Attente",
        value: log?.summary?.ordersAwaitingDriver ?? 0,
        subtitle: "À assigner rapidement",
        subInfo: `${log?.summary?.ordersInProgress ?? 0} en cours d'acheminement`,
        icon: Clock,
        href: "/admin/orders",
        alert: (log?.summary?.ordersAwaitingDriver ?? 0) > 0,
      },
      {
        title: "Flotte de Livreurs",
        value: log?.summary?.totalDrivers ?? 0,
        subtitle: `${log?.summary?.onlineDrivers ?? 0} en ligne actuellement`,
        subInfo: `Charge moy. : ${log?.forecasts?.estimatedLoadPerDriver ?? 0} course/livreur`,
        icon: Truck,
        href: "/admin/drivers",
      },
      {
        title: `Volume GMV (${rangeDays}j)`,
        value: formatMoney(log?.summary?.periodGMV ?? 0),
        subtitle: `Total cumulé : ${formatMoney(log?.summary?.totalGMV ?? 0)}`,
        subInfo: `Prévision 7j : ~${log?.forecasts?.projected7dOrders ?? 0} course(s)`,
        icon: TrendingUp,
        href: "/admin/orders",
        trend: log?.trends?.gmv,
      },
    ];
  } else if (activePole === "support") {
    kpis = [
      {
        title: "Requêtes Ouvertes",
        value: sup?.summary?.openTickets ?? 0,
        subtitle: "En attente de réponse",
        subInfo: `Pression file : ${sup?.forecasts?.backlogPressure || "CALME"}`,
        icon: LifeBuoy,
        href: "/admin/tickets",
        alert: (sup?.summary?.openTickets ?? 0) > 0,
      },
      {
        title: `Reçues (${rangeDays}j)`,
        value: sup?.summary?.periodTickets ?? 0,
        subtitle: `${sup?.summary?.resolvedTickets ?? 0} résolues au total`,
        subInfo: `Taux résolution : ${sup?.summary?.resolutionRate ?? 100}%`,
        icon: CheckCircle2,
        href: "/admin/tickets",
        trend: sup?.trends?.tickets,
      },
      {
        title: "Annuaire Clients",
        value: sup?.summary?.totalClients ?? 0,
        subtitle: "Comptes clients inscrits",
        subInfo: "Consulter les fiches clients",
        icon: UserCheck,
        href: "/admin/clients",
      },
      {
        title: "Prévision Volume (7j)",
        value: `${sup?.forecasts?.projected7dTickets ?? 0} tickets`,
        subtitle: `Moyenne : ${sup?.forecasts?.avgDailyTickets ?? 0} / jour`,
        subInfo: `Estimation 30j : ~${sup?.forecasts?.projected30dTickets ?? 0} requêtes`,
        icon: TrendingUp,
        href: "/admin/tickets",
      },
    ];
  } else if (activePole === "catalogue") {
    kpis = [
      {
        title: `Publications (${rangeDays}j)`,
        value: cat?.summary?.periodSubmissions ?? 0,
        subtitle: `${cat?.summary?.totalProducts ?? 0} produits · ${cat?.summary?.totalProperties ?? 0} biens`,
        subInfo: `${cat?.summary?.totalPendingModeration ?? 0} en attente de modération`,
        icon: Package,
        href: "/admin/products",
        trend: cat?.trends?.submissions,
        alert: (cat?.summary?.totalPendingModeration ?? 0) > 0,
      },
      {
        title: "Biens Immobiliers",
        value: cat?.summary?.totalProperties ?? 0,
        subtitle: `${cat?.summary?.activeProperties ?? 0} annonces actives`,
        subInfo: `${cat?.summary?.pendingProperties ?? 0} bien(s) à approuver`,
        icon: Building,
        href: "/admin/properties",
        alert: (cat?.summary?.pendingProperties ?? 0) > 0,
      },
      {
        title: "Fournisseurs Actifs",
        value: cat?.summary?.activeSuppliers ?? 0,
        subtitle: "Boutiques vérifiées",
        subInfo: `${cat?.summary?.pendingSuppliersKyc ?? 0} dossier(s) KYC en attente`,
        icon: Store,
        href: "/admin/suppliers",
        alert: (cat?.summary?.pendingSuppliersKyc ?? 0) > 0,
      },
      {
        title: "Taux d'Approbation",
        value: `${cat?.summary?.approvalRate ?? 100}%`,
        subtitle: `Cible : ${cat?.goalProgress?.targetRatePct ?? 90}%`,
        subInfo: `Prévision 30j : +${cat?.forecasts?.projected30dListings ?? 0} annonces`,
        icon: Sparkles,
        href: "/admin/products",
      },
    ];
  } else {
    kpis = [
      {
        title: `Inscriptions (${rangeDays}j)`,
        value: grw?.summary?.periodSignups ?? 0,
        subtitle: `${grw?.summary?.mtdSignups ?? 0} ce mois-ci`,
        subInfo: `Objectif mois : ${grw?.goalProgress?.targetSignups ?? 50} comptes`,
        icon: Users,
        href: "/admin/clients",
        trend: grw?.trends?.signups,
      },
      {
        title: "KYC Fournisseurs",
        value: grw?.summary?.pendingSuppliersKyc ?? 0,
        subtitle: "Dossiers à vérifier",
        subInfo: `${grw?.summary?.activeSuppliers ?? 0} boutiques actives`,
        icon: Store,
        href: "/admin/suppliers",
        alert: (grw?.summary?.pendingSuppliersKyc ?? 0) > 0,
      },
      {
        title: "Partenaires Affiliés",
        value: grw?.summary?.totalPartners ?? 0,
        subtitle: "Apporteurs d'affaires",
        subInfo: "Gérer le réseau partenaires",
        icon: Briefcase,
        href: "/admin/partners",
      },
      {
        title: "Apps Installées",
        value: grw?.summary?.installedAppsCount ?? 0,
        subtitle: "Clients + Livreurs",
        subInfo: "Campagnes Push & Mobile",
        icon: Smartphone,
        href: "/admin/push",
      },
    ];
  }

  // ── 2. JAUGES D'OBJECTIFS MENSUELS (Adaptées au pôle actif) ──
  const goalGauges: GoalGaugeItem[] = [];
  if (fin && (activePole === "overview" || activePole === "finance")) {
    goalGauges.push({
      id: "fin-rev",
      label: "Objectif Encaissements du Mois",
      currentDisplay: formatMoney(fin.goalProgress.mtdRevenueUSD),
      targetDisplay: formatMoney(fin.goalProgress.targetUSD),
      pct: fin.goalProgress.pct,
      onTrack: fin.goalProgress.onTrack,
      helper:
        fin.goalProgress.remainingUSD > 0
          ? `Reste ${formatMoney(fin.goalProgress.remainingUSD)} · Fin de mois estimée : ${formatMoney(fin.goalProgress.projectedMonthEndUSD)}`
          : `Objectif mensuel dépassé ! Fin de mois estimée : ${formatMoney(fin.goalProgress.projectedMonthEndUSD)}`,
      barColor: "#C7D300",
    });
    if (activePole === "finance") {
      goalGauges.push({
        id: "fin-coll",
        label: "Taux de Recouvrement Abonnements",
        currentDisplay: `${fin.goalProgress.collectionRatePct}%`,
        targetDisplay: "85%",
        pct: fin.goalProgress.collectionRatePct,
        onTrack: fin.goalProgress.collectionRatePct >= 85,
        helper: `${fin.summary.paidActiveCount} boutique(s) à jour · ${fin.summary.unpaidExpiredCount} expirée(s)`,
        barColor: "#38bdf8",
      });
    }
  }
  if (log && (activePole === "overview" || activePole === "logistics")) {
    goalGauges.push({
      id: "log-rate",
      label: "Taux de Livraison Réussie",
      currentDisplay: `${log.goalProgress.currentRatePct}%`,
      targetDisplay: `${log.goalProgress.targetRatePct}%`,
      pct: log.goalProgress.currentRatePct,
      onTrack: log.goalProgress.onTrack,
      helper: `${log.goalProgress.mtdDeliveredOrders} livraison(s) finalisée(s) ce mois-ci`,
      barColor: "#38bdf8",
    });
  }
  if (sup && (activePole === "overview" || activePole === "support")) {
    goalGauges.push({
      id: "sup-rate",
      label: "Taux de Résolution Service Client",
      currentDisplay: `${sup.goalProgress.currentRatePct}%`,
      targetDisplay: `${sup.goalProgress.targetRatePct}%`,
      pct: sup.goalProgress.currentRatePct,
      onTrack: sup.goalProgress.onTrack,
      helper: `${sup.goalProgress.mtdResolvedTickets} ticket(s) clôturé(s) ce mois-ci · ${sup.summary.openTickets} ouvert(s)`,
      barColor: "#f59e0b",
    });
  }
  if (cat && activePole === "catalogue") {
    goalGauges.push({
      id: "cat-rate",
      label: "Taux d'Approbation Catalogue",
      currentDisplay: `${cat.goalProgress.currentRatePct}%`,
      targetDisplay: `${cat.goalProgress.targetRatePct}%`,
      pct: cat.goalProgress.currentRatePct,
      onTrack: cat.goalProgress.onTrack,
      helper: `${cat.goalProgress.mtdSubmissions} nouvelle(s) annonce(s) soumise(s) ce mois-ci`,
      barColor: "#00B5A5",
    });
  }
  if (grw && (activePole === "overview" || activePole === "growth")) {
    goalGauges.push({
      id: "grw-signups",
      label: "Objectif Nouvelles Inscriptions",
      currentDisplay: `${grw.goalProgress.mtdSignups}`,
      targetDisplay: `${grw.goalProgress.targetSignups}`,
      pct: grw.goalProgress.pct,
      onTrack: grw.goalProgress.onTrack,
      helper: `Projection fin de mois : ~${grw.goalProgress.projectedMonthEndSignups} comptes`,
      barColor: "#a855f7",
    });
  }

  // ── 3. COURBE D'ÉVOLUTION PRINCIPALE (7j / 30j / 90j) ──
  const primaryChartConfig = (() => {
    if (activePole === "overview" || activePole === "finance") {
      return {
        data: fin?.revenueSeries || [],
        title: `Évolution des Encaissements (${rangeLabel})`,
        subtitle: "Recettes réelles enregistrées sur la plateforme (USD)",
        color: "#C7D300",
        valuePrefix: "$",
        valueSuffix: "",
        decimals: 0,
        primaryLabel: "Encaissé",
      };
    }
    if (activePole === "logistics") {
      return {
        data: log?.ordersSeries || [],
        title: `Évolution des Commandes & Courses (${rangeLabel})`,
        subtitle: "Volume réel des commandes traitées sur la période",
        color: "#38bdf8",
        valuePrefix: "",
        valueSuffix: " cmd",
        decimals: 0,
        primaryLabel: "Courses",
      };
    }
    if (activePole === "support") {
      return {
        data: sup?.ticketsSeries || [],
        title: `Évolution des Requêtes SAV (${rangeLabel})`,
        subtitle: "Tickets et correspondances reçus sur la période",
        color: "#f59e0b",
        valuePrefix: "",
        valueSuffix: " req",
        decimals: 0,
        primaryLabel: "Requêtes",
      };
    }
    if (activePole === "catalogue") {
      return {
        data: cat?.catalogueSeries || [],
        title: `Évolution des Publications Catalogue (${rangeLabel})`,
        subtitle: "Nouveaux produits e-commerce et biens immobiliers soumis",
        color: "#00B5A5",
        valuePrefix: "",
        valueSuffix: " art",
        decimals: 0,
        primaryLabel: "Publications",
      };
    }
    return {
      data: grw?.growthSeries || [],
      title: `Évolution des Nouvelles Inscriptions (${rangeLabel})`,
      subtitle: "Clients, fournisseurs et partenaires enregistrés",
      color: "#a855f7",
      valuePrefix: "",
      valueSuffix: " inscr",
      decimals: 0,
      primaryLabel: "Inscriptions",
    };
  })();

  // ── 4. DONUT DE RÉPARTITION ──
  const pieConfig = (() => {
    if (activePole === "overview" || activePole === "finance") {
      return {
        title: "Répartition Abonnements",
        subtitle: "Statut commercial des boutiques",
        data: fin?.pie || [],
      };
    }
    if (activePole === "logistics") {
      return {
        title: "Statut des Courses",
        subtitle: "Livrées, en cours et en attente",
        data: log?.pie || [],
      };
    }
    if (activePole === "support") {
      return {
        title: "État des Requêtes",
        subtitle: "Tickets ouverts vs résolus",
        data: sup?.pie || [],
      };
    }
    if (activePole === "catalogue") {
      return {
        title: "Répartition par Rayon",
        subtitle: "Saveurs, Mode, Connect & Immo",
        data: cat?.pie || [],
      };
    }
    return {
      title: "Structure des Comptes",
      subtitle: "Clients, Fournisseurs & Partenaires",
      data: grw?.pie || [],
    };
  })();

  // ── 5. ALERTES "À NE PAS OUBLIER" ──
  const alerts: AlertCardItem[] = [];
  if (fin && (activePole === "overview" || activePole === "finance")) {
    if (fin.summary.pendingMobileMoneyCount > 0) {
      alerts.push({
        title: `${fin.summary.pendingMobileMoneyCount} preuve(s) Mobile Money en attente`,
        description: "Vérifier les références reçues et activer les abonnements (+30j).",
        href: "/admin/finance",
        tone: "emerald",
      });
    }
    if (fin.summary.unpaidExpiredCount > 0) {
      alerts.push({
        title: `${fin.summary.unpaidExpiredCount} abonnement(s) expiré(s) / impayé(s)`,
        description: `Potentiel à recouvrer : +${formatMoney(fin.forecasts.overdueRecoveryPotential)}.`,
        href: "/admin/finance",
        tone: "rose",
      });
    }
    if (fin.forecasts.expiringIn7DaysCount > 0) {
      alerts.push({
        title: `${fin.forecasts.expiringIn7DaysCount} échéance(s) dans moins de 7 jours`,
        description: "Anticiper la relance avant suspension automatique.",
        href: "/admin/finance",
        tone: "amber",
      });
    }
  }
  if (log && (activePole === "overview" || activePole === "logistics")) {
    if (log.summary.ordersAwaitingDriver > 0) {
      alerts.push({
        title: `${log.summary.ordersAwaitingDriver} course(s) sans livreur`,
        description: "Assigner un coursier disponible pour maintenir le délai.",
        href: "/admin/orders",
        tone: "amber",
      });
    }
  }
  if (sup && (activePole === "overview" || activePole === "support")) {
    if (sup.summary.openTickets > 0) {
      alerts.push({
        title: `${sup.summary.openTickets} requête(s) client ouverte(s)`,
        description: "Répondre aux utilisateurs en attente d'assistance.",
        href: "/admin/tickets",
        tone: "amber",
      });
    }
  }
  if (cat && (activePole === "overview" || activePole === "catalogue")) {
    if (cat.summary.pendingSuppliersKyc > 0) {
      alerts.push({
        title: `${cat.summary.pendingSuppliersKyc} fournisseur(s) en attente KYC`,
        description: "Vérifier les pièces légales et activer les comptes.",
        href: "/admin/suppliers",
        tone: "blue",
      });
    }
    if (cat.summary.pendingProducts + cat.summary.pendingProperties > 0) {
      alerts.push({
        title: `${cat.summary.pendingProducts + cat.summary.pendingProperties} annonce(s) à modérer`,
        description: `${cat.summary.pendingProducts} produit(s) et ${cat.summary.pendingProperties} bien(s) immo.`,
        href: cat.summary.pendingProducts > 0 ? "/admin/products" : "/admin/properties",
        tone: "blue",
      });
    }
  }
  if (grw && activePole === "growth" && grw.summary.pendingSuppliersKyc > 0) {
    alerts.push({
      title: `${grw.summary.pendingSuppliersKyc} dossier(s) KYC à valider`,
      description: "Examiner et approuver les nouveaux fournisseurs.",
      href: "/admin/suppliers",
      tone: "blue",
    });
  }

  // ── 6. ACTIONS RAPIDES ──
  const actions: ActionCardItem[] = (() => {
    if (activePole === "finance") {
      return [
        {
          title: "Caisse & Abonnements",
          description: "Validez les paiements Mobile Money, encaissez un abonnement et suivez le grand livre.",
          buttonText: "Ouvrir la Comptabilité",
          href: "/admin/finance",
          isPrimary: true,
        },
        {
          title: "Commissions Partenaires",
          description: "Consultez les soldes d'affiliation ($5 / boutique) et validez les versements.",
          buttonText: "Gérer les Partenaires",
          href: "/admin/partners",
        },
        {
          title: "Suivi Parrainages",
          description: "Contrôlez les codes promo utilisés et les primes de parrainage.",
          buttonText: "Voir les Parrainages",
          href: "/admin/referrals",
        },
      ];
    }
    if (activePole === "logistics") {
      return [
        {
          title: "Dispatcher les Courses",
          description: "Assignez un livreur disponible aux commandes en attente et suivez les trajets.",
          buttonText: "Gérer les Livraisons",
          href: "/admin/orders",
          isPrimary: true,
        },
        {
          title: "Gérer la Flotte Livreurs",
          description: "Ajoutez de nouveaux coursiers, vérifiez leur statut en ligne et leurs performances.",
          buttonText: "Ouvrir la Flotte",
          href: "/admin/drivers",
        },
      ];
    }
    if (activePole === "support") {
      return [
        {
          title: "Traiter les Requêtes",
          description: "Répondez aux tickets ouverts et clôturez les dossiers résolus.",
          buttonText: "Ouvrir le Support",
          href: "/admin/tickets",
          isPrimary: true,
        },
        {
          title: "Annuaire Clients",
          description: "Recherchez un compte client, vérifiez son historique et ses coordonnées.",
          buttonText: "Consulter les Clients",
          href: "/admin/clients",
        },
      ];
    }
    if (activePole === "catalogue") {
      return [
        {
          title: "Modérer les Produits",
          description: "Validez les nouveaux articles Saveurs, Mode et Connect soumis par les vendeurs.",
          buttonText: "Ouvrir les Produits",
          href: "/admin/products",
          isPrimary: true,
        },
        {
          title: "Valider l'Immobilier",
          description: "Contrôlez les prix, photos et éligibilité des biens immobiliers et hôtels.",
          buttonText: "Ouvrir l'Immobilier",
          href: "/admin/properties",
        },
        {
          title: "Boutiques Fournisseurs",
          description: "Consultez les fiches des vendeurs actifs sur la marketplace.",
          buttonText: "Voir les Fournisseurs",
          href: "/admin/suppliers",
        },
      ];
    }
    if (activePole === "growth") {
      return [
        {
          title: "Valider les KYC Fournisseurs",
          description: "Approuvez les nouveaux vendeurs et vérifiez leurs documents officiels.",
          buttonText: "Gérer les Fournisseurs",
          href: "/admin/suppliers",
          isPrimary: true,
        },
        {
          title: "Notifications Push Mobile",
          description: "Diffusez une annonce ciblée aux utilisateurs de l'application mobile.",
          buttonText: "Ouvrir Push & Mobile",
          href: "/admin/push",
        },
      ];
    }
    return [
      {
        title: "Comptabilité & Caisse",
        description: "Pilotez les abonnements, les preuves Mobile Money et la trésorerie centrale.",
        buttonText: "Ouvrir les Finances",
        href: "/admin/finance",
        isPrimary: true,
      },
      {
        title: "Team Rayons",
        description: "Assignez les postes, permissions et contrôlez les accès de chaque membre du Team.",
        buttonText: "Gérer le Team",
        href: "/admin/team",
      },
      {
        title: "Santé & Journal d'Audit",
        description: "Consultez la journalisation sécurisée des actions sensibles et la santé système.",
        buttonText: "Ouvrir Santé & Audit",
        href: "/admin/health",
      },
    ];
  })();

  const toneClasses: Record<AlertCardItem["tone"], string> = {
    amber: "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/20 text-amber-300",
    rose: "bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20 text-rose-300",
    blue: "bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/20 text-blue-300",
    emerald: "bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20 text-emerald-300",
  };
  const dotClasses: Record<AlertCardItem["tone"], string> = {
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    blue: "bg-blue-400",
    emerald: "bg-emerald-400",
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans pb-16">
      {/* ── EN-TÊTE EXÉCUTIF ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {currentHeader.title}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase tracking-wider whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {currentHeader.badge}
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1 max-w-2xl">
            Bonjour, <strong className="text-gray-200">{userData?.displayName || userData?.name || user?.displayName || user?.email?.split("@")[0] || "Direction"}</strong> — {currentHeader.desc}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => loadDashboard(rangeDays, true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-[#C7D300]" : "text-gray-300"} />
            <span>{refreshing ? "Actualisation..." : "Actualiser"}</span>
          </button>

          {data?.isFullAdmin && (
            <>
              <button
                type="button"
                onClick={() => setIsBroadcastOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Send size={13} className="text-[#C7D300]" />
                <span>Écrire aux Fournisseurs</span>
              </button>
              <Link
                href="/admin/suppliers"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] font-bold text-xs transition-colors whitespace-nowrap"
              >
                <Store size={13} />
                <span>Boutiques</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── BARRE DE FILTRES : SÉLECTEUR DE PÔLE + PÉRIODE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        {availablePoles.length > 1 ? (
          <div className="flex items-center gap-1 bg-black/30 border border-white/[0.06] p-1 rounded-lg overflow-x-auto scrollbar-none w-full sm:w-fit max-w-full">
            {availablePoles.map((pole) => {
              const PoleIcon = pole.icon;
              const isSelected = activePole === pole.id;
              return (
                <button
                  key={pole.id}
                  type="button"
                  onClick={() => setActivePole(pole.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? "bg-white/15 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <PoleIcon size={13} />
                  <span>{pole.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 bg-black/30 border border-white/[0.06] p-1 rounded-lg w-fit shrink-0 self-end sm:self-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-2 hidden sm:inline">
            Période
          </span>
          {([7, 30, 90] as RangeDays[]).map((d) => {
            const active = rangeDays === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {d}j
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RANGÉE 1 : 4 CARTES KPI EXÉCUTIVES ── */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 transition-opacity ${refreshing ? "opacity-75" : "opacity-100"}`}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          const cardContent = (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
              className={`bg-white/[0.03] border rounded-xl p-4 flex flex-col justify-between gap-2.5 transition-colors relative overflow-hidden group ${
                kpi.href ? "cursor-pointer hover:border-white/20 hover:bg-white/[0.05]" : ""
              } ${kpi.alert ? "border-amber-500/30" : "border-white/[0.08]"}`}
            >
              <div className="flex justify-between items-center relative z-10 gap-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 line-clamp-1">
                  {kpi.title}
                </h3>
                <div
                  className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    kpi.alert
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-white/[0.05] text-gray-300 group-hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                </div>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className={`text-2xl font-bold tracking-tight tabular-nums truncate ${
                      kpi.alert ? "text-amber-400" : "text-white"
                    }`}
                  >
                    {kpi.value}
                  </div>
                  <TrendBadge trend={kpi.trend} rangeDays={rangeDays} />
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-400 font-medium mt-0.5 truncate">
                  {kpi.subtitle}
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center text-[10px] sm:text-[11px] text-gray-400 relative z-10">
                <span className="truncate">{kpi.subInfo}</span>
                {kpi.href && (
                  <ArrowRight
                    size={12}
                    className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#C7D300] shrink-0 ml-1"
                  />
                )}
              </div>
            </motion.div>
          );

          return kpi.href ? (
            <Link key={kpi.title} href={kpi.href}>
              {cardContent}
            </Link>
          ) : (
            <div key={kpi.title}>{cardContent}</div>
          );
        })}
      </div>

      {/* ── GRILLE PRINCIPALE : CENTRE (2/3) & DROITE (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ══════ COLONNE CENTRALE (2/3) ══════ */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. COURBE D'ÉVOLUTION (7j / 30j / 90j) */}
          <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md">
            <RevenueAreaChart
              data={primaryChartConfig.data}
              title={primaryChartConfig.title}
              subtitle={primaryChartConfig.subtitle}
              color={primaryChartConfig.color}
              valuePrefix={primaryChartConfig.valuePrefix}
              valueSuffix={primaryChartConfig.valueSuffix}
              decimals={primaryChartConfig.decimals}
              primaryLabel={primaryChartConfig.primaryLabel}
              heightClass="h-64 sm:h-72"
            />
          </div>

          {/* 2. JAUGES D'OBJECTIFS MENSUELS (Targets & Rythme du mois) */}
          {goalGauges.length > 0 && (
            <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#C7D300]/15 border border-[#C7D300]/25 flex items-center justify-center text-[#C7D300]">
                    <Target size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white capitalize">
                      Objectifs du Mois — {monthCtx?.monthLabel || "Mois en cours"}
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Jour {monthCtx?.dayOfMonth ?? 1} / {monthCtx?.daysInMonth ?? 30} ({monthCtx?.monthElapsedPct ?? 0}% du mois écoulé)
                    </p>
                  </div>
                </div>

                {data?.isFullAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsGoalsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <SlidersHorizontal size={13} className="text-[#C7D300]" />
                    <span>Ajuster les objectifs</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {goalGauges.map((g) => (
                  <div
                    key={g.id}
                    className="bg-black/25 border border-white/[0.06] rounded-xl p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white">{g.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          <span className="text-white font-extrabold tabular-nums">{g.currentDisplay}</span>{" "}
                          / {g.targetDisplay}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                          g.pct >= 100
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                            : g.onTrack
                            ? "bg-[#C7D300]/15 text-[#C7D300] border-[#C7D300]/25"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/25"
                        }`}
                      >
                        {g.pct >= 100 ? "Atteint" : g.onTrack ? "Dans les temps" : "À accélérer"}
                      </span>
                    </div>

                    <div className="relative h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(2, g.pct))}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: g.barColor }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[10px] text-gray-400">
                      <span className="truncate">{g.helper}</span>
                      <span className="font-extrabold text-white tabular-nums shrink-0">{g.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. MODULE PRÉVOYANCES & PROJECTIONS */}
          {(activePole === "overview" || activePole === "finance") && fin && (
            <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#C7D300]/15 border border-[#C7D300]/25 flex items-center justify-center text-[#C7D300]">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Prévoyances &amp; Projections Financières (30j · 90j · 6 Mois · Annuel)
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Estimation automatique basée sur le MRR actif, les essais en cours et les recouvrements impayés.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/finance"
                  className="text-xs font-bold text-[#C7D300] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Comptabilité</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">MRR Acquis</span>
                  <span className="text-lg font-extrabold text-white tabular-nums mt-0.5 block">
                    {formatMoney(fin.forecasts.currentMRR)}/mois
                  </span>
                  <span className="text-[10px] text-gray-500">Abonnés payants actifs</span>
                </div>

                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Potentiel Essais (30j)</span>
                  <span className="text-lg font-extrabold text-sky-400 tabular-nums mt-0.5 block">
                    +{formatMoney(fin.forecasts.trialConversionPotential30d)}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {fin.forecasts.expiringIn7DaysCount} échéance(s) &lt; 7 jours
                  </span>
                </div>

                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Recouvrement Impayés</span>
                  <span className="text-lg font-extrabold text-amber-400 tabular-nums mt-0.5 block">
                    +{formatMoney(fin.forecasts.overdueRecoveryPotential)}
                  </span>
                  <span className="text-[10px] text-gray-500">Boutiques suspendues</span>
                </div>

                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Provision Partenaires</span>
                  <span className="text-lg font-extrabold text-gray-200 tabular-nums mt-0.5 block">
                    -{formatMoney(fin.forecasts.projected30dPartnerCommissions)}
                  </span>
                  <span className="text-[10px] text-gray-500">Commissions $5 / affilié</span>
                </div>

                <div className="bg-[#C7D300]/10 border border-[#C7D300]/30 rounded-xl p-3.5">
                  <span className="text-[10px] text-[#C7D300] uppercase font-bold block">Prévision Nette (30j)</span>
                  <span className="text-lg font-extrabold text-[#C7D300] tabular-nums mt-0.5 block">
                    {formatMoney(fin.forecasts.projected30dNetRevenue)}
                  </span>
                  <span className="text-[10px] text-gray-300">
                    Trimestre (90j) : {formatMoney(fin.forecasts.projected90dRevenue)}
                  </span>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5">
                  <span className="text-[10px] text-emerald-300 uppercase font-bold block">Projection Annuelle (ARR)</span>
                  <span className="text-lg font-extrabold text-emerald-400 tabular-nums mt-0.5 block">
                    {formatMoney(fin.forecasts.projectedAnnualARR)}/an
                  </span>
                  <span className="text-[10px] text-gray-400">Run-rate net annuel</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06]">
                <RevenueAreaChart
                  data={fin.forecastProjectionSeries || []}
                  title="Courbe de Prévoyance Revenus (6 prochains mois)"
                  subtitle="Comparaison entre revenu mensuel acquis (MRR) et projection nette avec conversion progressive"
                  color="#C7D300"
                  valuePrefix="$"
                  decimals={0}
                  primaryLabel="MRR acquis"
                  secondaryLabel="Projection nette"
                  heightClass="h-56"
                />
              </div>
            </div>
          )}

          {activePole === "logistics" && log && (
            <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400">
                  <Gauge size={16} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">Prévoyances &amp; Capacité Logistique</h2>
                  <p className="text-[11px] text-gray-400">Estimation de charge sur 7 et 30 jours selon la cadence actuelle.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Cadence Moyenne</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">{log.forecasts.avgDailyOrders}/jour</span>
                  <span className="text-[10px] text-gray-500">Sur 7 derniers jours</span>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Prévision 7 Jours</span>
                  <span className="text-lg font-extrabold text-sky-400 mt-0.5 block">~{log.forecasts.projected7dOrders} courses</span>
                  <span className="text-[10px] text-gray-500">30j : ~{log.forecasts.projected30dOrders}</span>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Charge / Livreur</span>
                  <span className="text-lg font-extrabold text-amber-400 mt-0.5 block">{log.forecasts.estimatedLoadPerDriver}</span>
                  <span className="text-[10px] text-gray-500">Courses actives / livreur</span>
                </div>
                <div className="bg-[#C7D300]/10 border border-[#C7D300]/25 rounded-xl p-3.5">
                  <span className="text-[10px] text-[#C7D300] uppercase font-bold block">État Flotte</span>
                  <span className="text-lg font-extrabold text-[#C7D300] mt-0.5 block">
                    {log.forecasts.fleetStatus === "FLUIDE"
                      ? "Fluide"
                      : log.forecasts.fleetStatus === "TENDU"
                      ? "Tendu"
                      : "À recruter"}
                  </span>
                  <span className="text-[10px] text-gray-300">Taux livraison : {log.summary.completionRate}%</span>
                </div>
              </div>
            </div>
          )}

          {activePole === "support" && sup && (
            <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
                  <CalendarClock size={16} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">Prévoyances Charge Service Client</h2>
                  <p className="text-[11px] text-gray-400">Projection du volume de requêtes à absorber sur les prochaines semaines.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Flux Quotidien</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">{sup.forecasts.avgDailyTickets} / jour</span>
                  <span className="text-[10px] text-gray-500">Moyenne 7 jours</span>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Volume Prévu (30j)</span>
                  <span className="text-lg font-extrabold text-amber-400 mt-0.5 block">~{sup.forecasts.projected30dTickets} tickets</span>
                  <span className="text-[10px] text-gray-500">Semaine : ~{sup.forecasts.projected7dTickets}</span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5">
                  <span className="text-[10px] text-emerald-300 uppercase font-bold block">Performance SAV</span>
                  <span className="text-lg font-extrabold text-emerald-400 mt-0.5 block">{sup.summary.resolutionRate}%</span>
                  <span className="text-[10px] text-gray-300">Taux de résolution global</span>
                </div>
              </div>
            </div>
          )}

          {activePole === "catalogue" && cat && (
            <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
                <div className="w-8 h-8 rounded-lg bg-[#00B5A5]/15 border border-[#00B5A5]/25 flex items-center justify-center text-[#00B5A5]">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">Prévoyances &amp; Rythme des 4 Rayons</h2>
                  <p className="text-[11px] text-gray-400">Volume d&apos;annonces attendues sur 30 jours et répartition par rayon.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-[#FF6B35] uppercase font-bold block">🍽️ Saveurs</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">{cat.forecasts.rayonCounts.saveurs}</span>
                  <span className="text-[10px] text-gray-500">Plats &amp; articles</span>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-[#D4B08C] uppercase font-bold block">👗 Mode</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">{cat.forecasts.rayonCounts.mode}</span>
                  <span className="text-[10px] text-gray-500">Vêtements &amp; style</span>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-[#00B5A5] uppercase font-bold block">📡 Connect</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">{cat.forecasts.rayonCounts.connect}</span>
                  <span className="text-[10px] text-gray-500">High-Tech &amp; équipements</span>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <span className="text-[10px] text-[#4C6EF5] uppercase font-bold block">🏢 Immo</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">{cat.forecasts.rayonCounts.immo}</span>
                  <span className="text-[10px] text-gray-500">Biens &amp; hôtels</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. TABLEAU D'ACTIVITÉ RÉCENTE / PRIORITÉS */}
          <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-md">
            {(activePole === "overview" || activePole === "finance") && fin && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">Échéances &amp; Abonnements Prioritaires</h2>
                    <p className="text-[11px] text-gray-400">Impayés et fins d&apos;essai classés par urgence</p>
                  </div>
                  <Link href="/admin/finance" className="text-xs font-bold text-[#C7D300] hover:underline">
                    Tout voir →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.04] text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-white/[0.06]">
                        <th className="p-3 rounded-l-xl">Boutique</th>
                        <th className="p-3">Rayon</th>
                        <th className="p-3">Mensualité</th>
                        <th className="p-3">Échéance</th>
                        <th className="p-3 rounded-r-xl text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm text-gray-300 divide-y divide-white/[0.04]">
                      {(fin.urgentSubscriptions || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-gray-500 text-xs">
                            Aucun abonnement commercial enregistré.
                          </td>
                        </tr>
                      ) : (
                        fin.urgentSubscriptions.map((sub: any) => (
                          <tr key={sub.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-3 font-semibold text-white">{sub.name}</td>
                            <td className="p-3 uppercase text-[11px] text-gray-400">{sub.rayon}</td>
                            <td className="p-3 font-bold text-[#C7D300] tabular-nums">{formatMoney(sub.monthlyFeeUSD)}</td>
                            <td className="p-3 text-xs text-gray-400">
                              {sub.daysRemaining <= 0
                                ? `Expiré (${Math.abs(sub.daysRemaining)}j)`
                                : `${sub.daysRemaining} jour(s)`}
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  sub.paymentState === "PAID_ACTIVE"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : sub.paymentState === "TRIAL"
                                    ? "bg-sky-500/15 text-sky-400"
                                    : "bg-red-500/15 text-red-400"
                                }`}
                              >
                                {sub.paymentState === "PAID_ACTIVE"
                                  ? "Payé"
                                  : sub.paymentState === "TRIAL"
                                  ? "Essai"
                                  : "Impayé"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activePole === "logistics" && log && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm sm:text-base font-bold text-white">Courses &amp; Commandes Récentes</h2>
                  <Link href="/admin/orders" className="text-xs font-bold text-[#C7D300] hover:underline">
                    Tout voir →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.04] text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-white/[0.06]">
                        <th className="p-3 rounded-l-xl">ID</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Livreur</th>
                        <th className="p-3">Montant</th>
                        <th className="p-3 rounded-r-xl text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm text-gray-300 divide-y divide-white/[0.04]">
                      {(log.recentOrders || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-gray-500 text-xs">
                            Aucune commande enregistrée.
                          </td>
                        </tr>
                      ) : (
                        log.recentOrders.map((o: any) => (
                          <tr key={o.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-3 font-mono font-bold text-white">#{o.id.slice(0, 6).toUpperCase()}</td>
                            <td className="p-3">{o.clientName}</td>
                            <td className="p-3 text-gray-400">{o.driverName || "Non assigné"}</td>
                            <td className="p-3 font-bold text-sky-400 tabular-nums">{formatMoney(o.amount)}</td>
                            <td className="p-3 text-right">
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-white/10 text-gray-200">
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activePole === "support" && sup && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm sm:text-base font-bold text-white">Dernières Requêtes Clients</h2>
                  <Link href="/admin/tickets" className="text-xs font-bold text-[#C7D300] hover:underline">
                    Tout voir →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.04] text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-white/[0.06]">
                        <th className="p-3 rounded-l-xl">Objet</th>
                        <th className="p-3">Utilisateur</th>
                        <th className="p-3">Priorité</th>
                        <th className="p-3 rounded-r-xl text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm text-gray-300 divide-y divide-white/[0.04]">
                      {(sup.recentTickets || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-gray-500 text-xs">
                            Aucune requête enregistrée.
                          </td>
                        </tr>
                      ) : (
                        sup.recentTickets.map((tk: any) => (
                          <tr key={tk.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-3 font-semibold text-white">{tk.subject}</td>
                            <td className="p-3 text-gray-400">{tk.userName}</td>
                            <td className="p-3 uppercase text-[11px] text-gray-400">{tk.priority}</td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  tk.status === "OPEN"
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-emerald-500/15 text-emerald-400"
                                }`}
                              >
                                {tk.status === "OPEN" ? "Ouvert" : "Résolu"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activePole === "catalogue" && cat && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm sm:text-base font-bold text-white">File de Modération (Produits &amp; Biens)</h2>
                  <Link href="/admin/products" className="text-xs font-bold text-[#C7D300] hover:underline">
                    Modérer →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.04] text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-white/[0.06]">
                        <th className="p-3 rounded-l-xl">Titre</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Rayon</th>
                        <th className="p-3 rounded-r-xl text-right">Prix</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm text-gray-300 divide-y divide-white/[0.04]">
                      {(cat.recentPendingItems || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-emerald-400 text-xs font-semibold">
                            ✅ Aucune annonce en attente de modération.
                          </td>
                        </tr>
                      ) : (
                        cat.recentPendingItems.map((it: any) => (
                          <tr key={it.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-3 font-semibold text-white">{it.title}</td>
                            <td className="p-3 text-gray-400">{it.kind === "PROPERTY" ? "Immobilier" : "Produit"}</td>
                            <td className="p-3 uppercase text-[11px] text-[#00B5A5] font-bold">{it.rayon}</td>
                            <td className="p-3 text-right font-bold text-white tabular-nums">{formatMoney(it.price)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activePole === "growth" && grw && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[11px] text-gray-400 uppercase font-semibold">Inscriptions (7j)</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{grw.forecasts.last7dSignups}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Moyenne : {grw.forecasts.avgDailySignups}/jour</p>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[11px] text-gray-400 uppercase font-semibold">Projection 30 Jours</p>
                  <p className="text-2xl font-extrabold text-purple-400 mt-1">+{grw.forecasts.projected30dSignups}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Nouveaux comptes estimés</p>
                </div>
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[11px] text-gray-400 uppercase font-semibold">KYC en Attente</p>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1">{grw.summary.pendingSuppliersKyc}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">À valider dans Fournisseurs</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════ COLONNE DROITE (1/3) ══════ */}
        <div className="space-y-6">
          <StatusPieChart
            data={pieConfig.data}
            title={pieConfig.title}
            subtitle={pieConfig.subtitle}
          />

          <div className="bg-[#0F1A23] rounded-2xl p-5 border border-white/[0.08] shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Bell size={15} />
              </div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">À ne pas oublier</h3>
            </div>

            <div className="space-y-2.5">
              {alerts.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <CheckCircle2 size={20} className="text-[#C7D300] mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-gray-200">Aucune urgence en attente</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Tous les dossiers de votre périmètre sont à jour.
                  </p>
                </div>
              ) : (
                alerts.map((al, i) => (
                  <Link
                    key={i}
                    href={al.href}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors group ${toneClasses[al.tone]}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotClasses[al.tone]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{al.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{al.description}</p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 self-center opacity-70 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C7D300]/[0.04] rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4 relative z-10">
              Actions Rapides
            </h3>
            <div className="space-y-3 relative z-10">
              {actions.map((action, idx) => (
                <div
                  key={idx}
                  className="rounded-xl p-4 border bg-white/[0.03] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05] transition-all"
                >
                  <h4 className="text-sm font-semibold text-white mb-1">{action.title}</h4>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">{action.description}</p>
                  <Link
                    href={action.href}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      action.isPrimary
                        ? "bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] shadow-md shadow-[#C7D300]/15"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                    }`}
                  >
                    <span>{action.buttonText}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {data?.isFullAdmin && (
            <div className="bg-gradient-to-br from-[#0F1D27] to-[#12232E] rounded-2xl p-5 border border-[#C7D300]/25 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300]">
                  <Mail size={15} />
                </div>
                <h3 className="font-bold text-white text-sm">Rapport Matinal (07h00)</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Envoi programmé chaque matin à <strong>07h00</strong> aux fournisseurs partenaires et à la direction.
              </p>
              <button
                type="button"
                onClick={handleTriggerDailyReports}
                disabled={isSendingReports}
                className="w-full py-2.5 px-4 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Mail size={14} className={isSendingReports ? "animate-spin" : ""} />
                <span>{isSendingReports ? "Diffusion en cours..." : "Envoyer les Rapports Journaliers"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBroadcastOpen(true)}
                className="w-full mt-2.5 py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition-all border border-white/15 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={14} className="text-[#C7D300]" />
                <span>Diffuser un Message (Email + App)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <StaffGoalsModal
        isOpen={Boolean(isGoalsModalOpen && data?.isFullAdmin)}
        onClose={() => setIsGoalsModalOpen(false)}
        goalsForm={goalsForm}
        setGoalsForm={setGoalsForm}
        savingGoals={savingGoals}
        onSaveGoals={handleSaveGoals}
      />

      {/* Modal Broadcast (Direction uniquement) */}
      {data?.isFullAdmin && (
        <AdminBroadcastModal
          isOpen={isBroadcastOpen}
          onClose={() => setIsBroadcastOpen(false)}
        />
      )}
    </div>
  );
}
