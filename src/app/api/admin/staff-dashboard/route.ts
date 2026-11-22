import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminCaller, requireFullAdminCaller } from "@/server/guards";
import { recordAuditLog } from "@/server/auditLog";
import { hasStaffPermission } from "@/domain/permissions";
import { isSuperAdmin } from "@/domain/roles";
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES } from "@/lib/serverAuth";

type RangeDays = 7 | 30 | 90;

export interface TeamGoals {
  monthlyRevenueTargetUSD: number;
  deliveryRateTargetPct: number;
  supportResolutionTargetPct: number;
  catalogueApprovalTargetPct: number;
  monthlyNewSignupsTarget: number;
}

const DEFAULT_TEAM_GOALS: TeamGoals = {
  monthlyRevenueTargetUSD: 1500,
  deliveryRateTargetPct: 95,
  supportResolutionTargetPct: 90,
  catalogueApprovalTargetPct: 90,
  monthlyNewSignupsTarget: 50,
};

function isStaffOrAdminDoc(data: any): boolean {
  if (!data) return false;
  if (data.isInternalStaff === true || data.accountType === "STAFF") return true;
  const email = String(data.email || "").toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;
  const role = String(data.role || "").toUpperCase().trim();
  return (
    ADMIN_ROLES.includes(role) ||
    role.includes("ADMIN") ||
    role.includes("FONCTIONNAIRE") ||
    role.includes("RESPONSABLE_") ||
    role.includes("GESTIONNAIRE_") ||
    role === "SUPPORT_CLIENT"
  );
}

function toDateObj(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw?.toDate === "function") return raw.toDate();
  if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000);
  if (typeof raw?._seconds === "number") return new Date(raw._seconds * 1000);
  if (typeof raw === "number") return new Date(raw);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface TimeBucket {
  startMs: number;
  endMs: number;
  name: string;
  total: number;
}

function buildTimeBuckets(rangeDays: RangeDays): TimeBucket[] {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const buckets: TimeBucket[] = [];

  if (rangeDays === 90) {
    // 13 tranches hebdomadaires (7 jours chacune) pour une lecture fluide sur 90j
    const weeks = 13;
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(endOfToday.getTime() - i * 7 * 86400000);
      const start = new Date(end.getTime() - 7 * 86400000 + 1);
      const label = start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      buckets.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        name: label,
        total: 0,
      });
    }
    return buckets;
  }

  for (let i = rangeDays - 1; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);
    const label = dayStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    buckets.push({
      startMs: dayStart.getTime(),
      endMs: dayEnd.getTime(),
      name: label,
      total: 0,
    });
  }
  return buckets;
}

function addToBucket(buckets: TimeBucket[], timestampMs: number, value: number) {
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (timestampMs >= buckets[i].startMs && timestampMs <= buckets[i].endMs) {
      buckets[i].total += value;
      return;
    }
  }
}

function computeTrend(current: number, previous: number) {
  if (previous <= 0 && current <= 0) {
    return { current, previous, deltaPct: 0, direction: "flat" as const };
  }
  if (previous <= 0 && current > 0) {
    return { current, previous, deltaPct: 100, direction: "up" as const };
  }
  const raw = Math.round(((current - previous) / previous) * 100);
  return {
    current,
    previous,
    deltaPct: raw,
    direction: raw > 0 ? ("up" as const) : raw < 0 ? ("down" as const) : ("flat" as const),
  };
}

function classifyRayon(item: any): "saveurs" | "mode" | "connect" | "immo" {
  const cat = String(item.category || "").toLowerCase();
  const ray = String(item.rayon || "").toLowerCase();
  const combined = `${cat} ${ray}`;
  if (
    combined.includes("saveur") ||
    combined.includes("resto") ||
    combined.includes("plat") ||
    combined.includes("food") ||
    combined.includes("cuisine")
  ) {
    return "saveurs";
  }
  if (
    combined.includes("mode") ||
    combined.includes("vetement") ||
    combined.includes("vêtement") ||
    combined.includes("chaussure") ||
    combined.includes("habit")
  ) {
    return "mode";
  }
  if (
    combined.includes("immo") ||
    combined.includes("hotel") ||
    combined.includes("maison") ||
    combined.includes("appart")
  ) {
    return "immo";
  }
  return "connect";
}

/**
 * GET /api/admin/staff-dashboard?range=7|30|90
 * Retourne des statistiques, courbes d'évolution (7j/30j/90j), tendances % vs période précédente,
 * jauges d'objectifs mensuels, prévoyances et listes récentes strictement cloisonnées selon les permissions du membre du Team.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminCaller(req);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;

    const rawRange = Number(req.nextUrl.searchParams.get("range") || 30);
    const rangeDays: RangeDays = rawRange === 7 ? 7 : rawRange === 90 ? 90 : 30;

    const nowMs = Date.now();
    const rangeMs = rangeDays * 86400000;
    const currentPeriodStartMs = nowMs - rangeMs;
    const previousPeriodStartMs = nowMs - rangeMs * 2;

    // Bornes du mois civil en cours (pour les objectifs mensuels MTD + projection fin de mois)
    const nowDate = new Date(nowMs);
    const monthStartMs = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0).getTime();
    const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
    const dayOfMonth = Math.max(1, nowDate.getDate());
    const monthElapsedPct = Math.round((dayOfMonth / daysInMonth) * 100);

    const caller = guard.caller;
    const subject = {
      ...(caller.data || {}),
      email: caller.email,
      role: caller.role,
    };

    const roleUpper = String(caller.role || "").toUpperCase();
    const positions: string[] = Array.isArray(caller.data?.staffProfile?.positions)
      ? caller.data.staffProfile.positions
      : [];

    const isSuper = isSuperAdmin(subject);
    const isFullAdmin =
      isSuper ||
      roleUpper === "SUB_ADMIN" ||
      roleUpper === "SUBADMIN" ||
      roleUpper === "ADMIN" ||
      positions.includes("SUB_ADMIN");

    const scopes = {
      finance:
        isFullAdmin ||
        hasStaffPermission(subject, "finance.view") ||
        hasStaffPermission(subject, "finance.cash") ||
        hasStaffPermission(subject, "subscriptions.manage"),
      logistics:
        isFullAdmin ||
        hasStaffPermission(subject, "orders.view") ||
        hasStaffPermission(subject, "orders.manage") ||
        hasStaffPermission(subject, "drivers.view") ||
        hasStaffPermission(subject, "deliveries.dispatch"),
      support:
        isFullAdmin ||
        hasStaffPermission(subject, "tickets.handle") ||
        hasStaffPermission(subject, "clients.view"),
      catalogue:
        isFullAdmin ||
        hasStaffPermission(subject, "products.moderate") ||
        hasStaffPermission(subject, "properties.moderate") ||
        hasStaffPermission(subject, "suppliers.view"),
      growth:
        isFullAdmin ||
        hasStaffPermission(subject, "suppliers.validate_kyc") ||
        hasStaffPermission(subject, "partners.view") ||
        hasStaffPermission(subject, "clients.manage"),
    };

    const needUsers = scopes.finance || scopes.support || scopes.catalogue || scopes.growth;

    const [
      goalsSnap,
      usersSnap,
      transactionsSnap,
      commissionsSnap,
      mobileMoneySnap,
      finSettingsSnap,
      ordersSnap,
      driversSnap,
      ticketsSnap,
      productsSnap,
      propertiesSnap,
      devicesSnap,
    ] = await Promise.all([
      adminDb.collection("settings").doc("team_goals").get(),
      needUsers ? adminDb.collection("users").get() : Promise.resolve(null),
      scopes.finance ? adminDb.collection("transactions").limit(600).get() : Promise.resolve(null),
      scopes.finance ? adminDb.collection("referral_commissions").limit(400).get() : Promise.resolve(null),
      scopes.finance
        ? adminDb.collection("subscription_payment_requests").where("status", "==", "PENDING").limit(100).get()
        : Promise.resolve(null),
      scopes.finance ? adminDb.collection("settings").doc("financial").get() : Promise.resolve(null),
      scopes.logistics ? adminDb.collection("orders").limit(600).get() : Promise.resolve(null),
      scopes.logistics ? adminDb.collection("drivers").limit(300).get() : Promise.resolve(null),
      scopes.support ? adminDb.collection("tickets").limit(400).get() : Promise.resolve(null),
      scopes.catalogue ? adminDb.collection("products").limit(500).get() : Promise.resolve(null),
      scopes.catalogue ? adminDb.collection("properties").limit(500).get() : Promise.resolve(null),
      scopes.growth ? adminDb.collection("push_devices").limit(400).get() : Promise.resolve(null),
    ]);

    const rawGoals = goalsSnap.exists ? goalsSnap.data() || {} : {};
    const goals: TeamGoals = {
      monthlyRevenueTargetUSD: Number(rawGoals.monthlyRevenueTargetUSD) > 0 ? Number(rawGoals.monthlyRevenueTargetUSD) : DEFAULT_TEAM_GOALS.monthlyRevenueTargetUSD,
      deliveryRateTargetPct: Number(rawGoals.deliveryRateTargetPct) > 0 ? Math.min(100, Number(rawGoals.deliveryRateTargetPct)) : DEFAULT_TEAM_GOALS.deliveryRateTargetPct,
      supportResolutionTargetPct: Number(rawGoals.supportResolutionTargetPct) > 0 ? Math.min(100, Number(rawGoals.supportResolutionTargetPct)) : DEFAULT_TEAM_GOALS.supportResolutionTargetPct,
      catalogueApprovalTargetPct: Number(rawGoals.catalogueApprovalTargetPct) > 0 ? Math.min(100, Number(rawGoals.catalogueApprovalTargetPct)) : DEFAULT_TEAM_GOALS.catalogueApprovalTargetPct,
      monthlyNewSignupsTarget: Number(rawGoals.monthlyNewSignupsTarget) > 0 ? Number(rawGoals.monthlyNewSignupsTarget) : DEFAULT_TEAM_GOALS.monthlyNewSignupsTarget,
    };

    // ── Parsing partagé de `users` ──
    const partnersMap: Record<string, { id: string; name: string; code: string; balance: number; totalEarned: number }> = {};
    const supplierDocs: any[] = [];
    let totalClientsCount = 0;
    let pendingSuppliersKyc = 0;
    const growthBuckets = buildTimeBuckets(rangeDays);
    let currentSignups = 0;
    let previousSignups = 0;
    let mtdSignups = 0;

    if (usersSnap) {
      usersSnap.forEach((docSnap: any) => {
        const d = docSnap.data() || {};
        const r = String(d.role || "").toUpperCase();
        const created = toDateObj(d.createdAt);

        if (created && !isStaffOrAdminDoc(d)) {
          const ms = created.getTime();
          addToBucket(growthBuckets, ms, 1);
          if (ms >= currentPeriodStartMs) currentSignups++;
          else if (ms >= previousPeriodStartMs) previousSignups++;
          if (ms >= monthStartMs) mtdSignups++;
        }

        if (d.isPartner === true || r === "PARTNER" || d.accountType === "PARTNER") {
          partnersMap[docSnap.id] = {
            id: docSnap.id,
            name: d.displayName || d.name || d.company || d.email || "Partenaire",
            code: d.partnerCode || d.referralCode || "---",
            balance: Number(d.referralBalance ?? d.partnerBalance) || 0,
            totalEarned: Number(d.referralTotalEarned ?? d.partnerTotalEarned) || 0,
          };
          return;
        }

        if (isStaffOrAdminDoc(d)) return;
        if (r.includes("DRIVER") || r.includes("LIVREUR") || r.includes("CHAUFFEUR")) return;

        const isSupplierUser =
          d.isSupplier === true ||
          r.includes("SUPPLIER") ||
          r.includes("FOURNISSEUR") ||
          d.accountType === "SUPPLIER";

        if (isSupplierUser) {
          if (d.profileUpdateStatus === "PENDING_APPROVAL" || d.status === "PENDING_APPROVAL") {
            pendingSuppliersKyc++;
          }
          supplierDocs.push({ id: docSnap.id, ...d });
        } else {
          totalClientsCount++;
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. PÔLE FINANCES & PRÉVOYANCES
    // ═══════════════════════════════════════════════════════════════════════
    let financeData: any = null;
    if (scopes.finance) {
      const finSettings = finSettingsSnap && finSettingsSnap.exists ? finSettingsSnap.data() || {} : {};
      const baseMonthlyFee = Number(finSettings.monthlySubscriptionPrice) || 50;
      const promoDiscount = Number(finSettings.promoDiscountUSD) || 10;
      const partnerCommissionRate = Number(finSettings.referralCommissionUSD) || 5;

      const revBuckets = buildTimeBuckets(rangeDays);
      const paidBySupplier: Record<string, { count: number; totalUSD: number; lastPaidAt: string | null }> = {};
      let collectedSubscriptionRevenueUSD = 0;
      let currentPeriodRevenueUSD = 0;
      let previousPeriodRevenueUSD = 0;
      let mtdRevenueUSD = 0;

      transactionsSnap?.forEach((docSnap: any) => {
        const t = docSnap.data() || {};
        const isSub =
          t.type === "SUBSCRIPTION" ||
          t.category === "Abonnement" ||
          String(t.description || "").toLowerCase().includes("abonnement");
        const amt = Number(t.amount) || 0;
        const created = toDateObj(t.createdAt);

        if (created && amt > 0 && (isSub || t.status === "COMPLETED")) {
          const ms = created.getTime();
          addToBucket(revBuckets, ms, amt);
          if (ms >= currentPeriodStartMs) currentPeriodRevenueUSD += amt;
          else if (ms >= previousPeriodStartMs) previousPeriodRevenueUSD += amt;
          if (ms >= monthStartMs) mtdRevenueUSD += amt;
        }

        if (isSub) {
          collectedSubscriptionRevenueUSD += amt;
          const sId = t.supplierId;
          if (sId) {
            if (!paidBySupplier[sId]) {
              paidBySupplier[sId] = { count: 0, totalUSD: 0, lastPaidAt: null };
            }
            paidBySupplier[sId].count += 1;
            paidBySupplier[sId].totalUSD += amt;
            const tsIso = created ? created.toISOString() : null;
            if (tsIso && (!paidBySupplier[sId].lastPaidAt || tsIso > paidBySupplier[sId].lastPaidAt!)) {
              paidBySupplier[sId].lastPaidAt = tsIso;
            }
          }
        }
      });

      let paidActiveCount = 0;
      let trialCount = 0;
      let unpaidExpiredCount = 0;
      let officialCount = 0;
      let expiringIn7DaysCount = 0;

      let currentMRR = 0;
      let trialConversionPotential30d = 0;
      let overdueRecoveryPotential = 0;
      let projected30dPartnerCommissions = 0;

      const allSubs = supplierDocs.map((s) => {
        const isOfficial = Boolean(s.isOfficialAdminStore || s.isAdminSupplier);
        const partnerId =
          s.referredByPartnerId ||
          s.referredBy ||
          (s.creatorRole === "PARTNER" ? s.createdBy : null);
        const partnerInfo = partnerId ? partnersMap[partnerId] : null;
        const isPartnerRecruited = Boolean(partnerInfo || s.partnerReferral || s.referralCodeUsed);

        const monthlyFeeUSD = isOfficial
          ? 0
          : isPartnerRecruited
          ? Math.max(0, baseMonthlyFee - promoDiscount)
          : baseMonthlyFee;
        const partnerCommissionUSD = !isOfficial && isPartnerRecruited ? partnerCommissionRate : 0;

        const endDate = toDateObj(s.subscriptionEndDate);
        const daysRemaining = endDate ? Math.ceil((endDate.getTime() - nowMs) / 86400000) : 0;
        const rawStatus = String(s.subscriptionStatus || "TRIAL").toUpperCase();
        const paymentStats = paidBySupplier[s.id] || { count: 0, totalUSD: 0, lastPaidAt: null };

        let paymentState: "PAID_ACTIVE" | "TRIAL" | "UNPAID_EXPIRED" | "EXEMPT_OFFICIAL";

        if (isOfficial) {
          paymentState = "EXEMPT_OFFICIAL";
          officialCount++;
        } else if (daysRemaining <= 0 || rawStatus === "SUSPENDED_PAYMENT" || s.isBlocked === true) {
          paymentState = "UNPAID_EXPIRED";
          unpaidExpiredCount++;
          overdueRecoveryPotential += monthlyFeeUSD;
          if (isPartnerRecruited) projected30dPartnerCommissions += partnerCommissionUSD;
        } else if (rawStatus === "ACTIVE" || paymentStats.count > 0) {
          paymentState = "PAID_ACTIVE";
          paidActiveCount++;
          currentMRR += monthlyFeeUSD;
          if (isPartnerRecruited) projected30dPartnerCommissions += partnerCommissionUSD;
          if (daysRemaining <= 7) expiringIn7DaysCount++;
        } else {
          paymentState = "TRIAL";
          trialCount++;
          trialConversionPotential30d += monthlyFeeUSD;
          if (isPartnerRecruited) projected30dPartnerCommissions += partnerCommissionUSD;
          if (daysRemaining <= 7) expiringIn7DaysCount++;
        }

        if (paymentState === "PAID_ACTIVE" && paymentStats.totalUSD === 0) {
          collectedSubscriptionRevenueUSD += monthlyFeeUSD;
        }

        return {
          id: s.id,
          name: s.companyName || s.company || s.displayName || s.name || "Boutique",
          rayon: s.rayon || (Array.isArray(s.assignedRayons) && s.assignedRayons[0]) || "connect",
          paymentState,
          daysRemaining,
          monthlyFeeUSD,
          subscriptionEndDate: endDate ? endDate.toISOString() : null,
        };
      });

      const statePriority: Record<string, number> = {
        UNPAID_EXPIRED: 1,
        TRIAL: 2,
        PAID_ACTIVE: 3,
        EXEMPT_OFFICIAL: 4,
      };
      allSubs.sort((a, b) => {
        const diff = (statePriority[a.paymentState] || 9) - (statePriority[b.paymentState] || 9);
        return diff !== 0 ? diff : a.daysRemaining - b.daysRemaining;
      });

      let totalPartnerCommissionsEarnedUSD = 0;
      let pendingPartnerPayoutsUSD = 0;
      Object.values(partnersMap).forEach((p) => {
        totalPartnerCommissionsEarnedUSD += p.totalEarned;
        pendingPartnerPayoutsUSD += p.balance;
      });

      let paidPartnerPayoutsUSD = 0;
      commissionsSnap?.forEach((docSnap: any) => {
        const c = docSnap.data() || {};
        if (c.status === "PAID") paidPartnerPayoutsUSD += Number(c.amount) || 0;
      });

      const netPlatformRevenueUSD = Math.max(0, collectedSubscriptionRevenueUSD - totalPartnerCommissionsEarnedUSD);
      const projected30dGrossRevenue = currentMRR + trialConversionPotential30d + overdueRecoveryPotential;
      const projected30dNetRevenue = Math.max(0, projected30dGrossRevenue - projected30dPartnerCommissions);
      const projected90dRevenue = projected30dNetRevenue * 3;
      const projectedAnnualARR = projected30dNetRevenue * 12;

      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      const forecastProjectionSeries = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(nowDate.getFullYear(), nowDate.getMonth() + i, 1);
        const label = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
        const conversionFactor = Math.min(1, 0.4 + i * 0.12);
        const projected = Math.round(
          Math.max(
            0,
            currentMRR +
              trialConversionPotential30d * conversionFactor +
              overdueRecoveryPotential * Math.min(0.8, 0.25 + i * 0.1) -
              projected30dPartnerCommissions * conversionFactor
          )
        );
        return {
          name: label,
          total: Math.round(currentMRR),
          projected,
        };
      });

      const revenueGoalPct = Math.min(100, Math.round((mtdRevenueUSD / Math.max(1, goals.monthlyRevenueTargetUSD)) * 100));
      const projectedMonthEndRevenueUSD = Math.round((mtdRevenueUSD / dayOfMonth) * daysInMonth);
      const commercialTotal = Math.max(1, paidActiveCount + unpaidExpiredCount);
      const collectionRatePct = paidActiveCount + unpaidExpiredCount > 0
        ? Math.round((paidActiveCount / commercialTotal) * 100)
        : 100;

      financeData = {
        summary: {
          collectedSubscriptionRevenueUSD,
          netPlatformRevenueUSD,
          periodRevenueUSD: currentPeriodRevenueUSD,
          mtdRevenueUSD,
          paidActiveCount,
          trialCount,
          unpaidExpiredCount,
          officialCount,
          pendingMobileMoneyCount: mobileMoneySnap?.size ?? 0,
          pendingPartnerPayoutsUSD,
          paidPartnerPayoutsUSD,
          totalPartnerCommissionsEarnedUSD,
        },
        trends: {
          revenue: computeTrend(currentPeriodRevenueUSD, previousPeriodRevenueUSD),
        },
        goalProgress: {
          mtdRevenueUSD,
          targetUSD: goals.monthlyRevenueTargetUSD,
          pct: revenueGoalPct,
          remainingUSD: Math.max(0, goals.monthlyRevenueTargetUSD - mtdRevenueUSD),
          projectedMonthEndUSD: projectedMonthEndRevenueUSD,
          onTrack: revenueGoalPct >= monthElapsedPct || projectedMonthEndRevenueUSD >= goals.monthlyRevenueTargetUSD,
          collectionRatePct,
        },
        forecasts: {
          currentMRR,
          trialConversionPotential30d,
          overdueRecoveryPotential,
          projected30dPartnerCommissions,
          projected30dGrossRevenue,
          projected30dNetRevenue,
          projected90dRevenue,
          projectedAnnualARR,
          expiringIn7DaysCount,
        },
        revenueSeries: revBuckets.map(({ name, total }) => ({ name, total })),
        forecastProjectionSeries,
        pie: [
          { name: "Payés actifs", value: paidActiveCount, color: "#C7D300" },
          { name: "Essai actif", value: trialCount, color: "#38bdf8" },
          { name: "Impayés / Expirés", value: unpaidExpiredCount, color: "#ef4444" },
        ],
        urgentSubscriptions: allSubs
          .filter((s) => s.paymentState !== "EXEMPT_OFFICIAL")
          .slice(0, 8),
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. PÔLE LOGISTIQUE & LIVRAISONS
    // ═══════════════════════════════════════════════════════════════════════
    let logisticsData: any = null;
    if (scopes.logistics) {
      const orderBuckets = buildTimeBuckets(rangeDays);
      let ordersAwaitingDriver = 0;
      let ordersInProgress = 0;
      let ordersCompleted = 0;
      let ordersCancelled = 0;
      let totalGMV = 0;
      let currentPeriodOrders = 0;
      let previousPeriodOrders = 0;
      let currentPeriodGMV = 0;
      let previousPeriodGMV = 0;
      let mtdDeliveredOrders = 0;
      let last7dOrders = 0;
      const sevenDaysAgo = nowMs - 7 * 86400000;
      const recentOrders: any[] = [];

      ordersSnap?.forEach((docSnap: any) => {
        const o = docSnap.data() || {};
        const st = String(o.status || "PENDING").toUpperCase();
        const amt = Number(o.totalAmount || o.subtotal || 0);
        const created = toDateObj(o.createdAt);

        if (st !== "CANCELLED") totalGMV += amt;
        const isDelivered = ["COMPLETED", "DELIVERED", "LIVRE"].includes(st);

        if (st === "CONFIRMED_AWAITING_DRIVER" || st === "PENDING_DRIVER" || st === "PENDING") {
          ordersAwaitingDriver++;
        } else if (isDelivered) {
          ordersCompleted++;
        } else if (st === "CANCELLED") {
          ordersCancelled++;
        } else {
          ordersInProgress++;
        }

        if (created) {
          const ms = created.getTime();
          if (ms >= sevenDaysAgo) last7dOrders++;
          addToBucket(orderBuckets, ms, 1);
          if (ms >= currentPeriodStartMs) {
            currentPeriodOrders++;
            if (st !== "CANCELLED") currentPeriodGMV += amt;
          } else if (ms >= previousPeriodStartMs) {
            previousPeriodOrders++;
            if (st !== "CANCELLED") previousPeriodGMV += amt;
          }
          if (ms >= monthStartMs && isDelivered) mtdDeliveredOrders++;
        }

        recentOrders.push({
          id: docSnap.id,
          clientName: o.clientName || o.customerName || o.clientPhone || "Client",
          amount: amt,
          status: st,
          rayon: o.rayon || o.category || "marketplace",
          driverName: o.driverName || null,
          createdAtMs: created ? created.getTime() : 0,
        });
      });

      recentOrders.sort((a, b) => b.createdAtMs - a.createdAtMs);

      let onlineDrivers = 0;
      driversSnap?.forEach((docSnap: any) => {
        const d = docSnap.data() || {};
        if (d.isOnline === true || d.status === "ONLINE" || d.status === "AVAILABLE") {
          onlineDrivers++;
        }
      });

      const totalDrivers = driversSnap?.size ?? 0;
      const totalOrders = ordersSnap?.size ?? 0;
      const nonCancelled = Math.max(1, totalOrders - ordersCancelled);
      const completionRate = totalOrders > 0 ? Math.round((ordersCompleted / nonCancelled) * 100) : 100;
      const avgDailyOrders = Number((last7dOrders / 7).toFixed(1));
      const projected7dOrders = Math.round(avgDailyOrders * 7);
      const activeWorkload = ordersAwaitingDriver + ordersInProgress;
      const estimatedLoadPerDriver = totalDrivers > 0 ? Number((activeWorkload / totalDrivers).toFixed(1)) : activeWorkload;

      logisticsData = {
        summary: {
          totalDrivers,
          onlineDrivers,
          ordersAwaitingDriver,
          ordersInProgress,
          ordersCompleted,
          ordersCancelled,
          totalOrders,
          periodOrders: currentPeriodOrders,
          periodGMV: currentPeriodGMV,
          totalGMV,
          completionRate,
          mtdDeliveredOrders,
        },
        trends: {
          orders: computeTrend(currentPeriodOrders, previousPeriodOrders),
          gmv: computeTrend(currentPeriodGMV, previousPeriodGMV),
        },
        goalProgress: {
          currentRatePct: completionRate,
          targetRatePct: goals.deliveryRateTargetPct,
          onTrack: completionRate >= goals.deliveryRateTargetPct,
          mtdDeliveredOrders,
        },
        forecasts: {
          avgDailyOrders,
          projected7dOrders,
          projected30dOrders: Math.round(avgDailyOrders * 30),
          estimatedLoadPerDriver,
          fleetStatus:
            totalDrivers === 0
              ? "AUCUN_LIVREUR"
              : estimatedLoadPerDriver > 4
              ? "TENDU"
              : "FLUIDE",
        },
        ordersSeries: orderBuckets.map(({ name, total }) => ({ name, total })),
        pie: [
          { name: "Livrées", value: ordersCompleted, color: "#22c55e" },
          { name: "En cours", value: ordersInProgress, color: "#38bdf8" },
          { name: "En attente", value: ordersAwaitingDriver, color: "#f59e0b" },
          { name: "Annulées", value: ordersCancelled, color: "#ef4444" },
        ],
        recentOrders: recentOrders.slice(0, 8),
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. PÔLE SERVICE CLIENT & SAV
    // ═══════════════════════════════════════════════════════════════════════
    let supportData: any = null;
    if (scopes.support) {
      const ticketBuckets = buildTimeBuckets(rangeDays);
      let openTickets = 0;
      let resolvedTickets = 0;
      let currentPeriodTickets = 0;
      let previousPeriodTickets = 0;
      let mtdResolvedTickets = 0;
      let last7dTickets = 0;
      const sevenDaysAgo = nowMs - 7 * 86400000;
      const recentTickets: any[] = [];

      ticketsSnap?.forEach((docSnap: any) => {
        const t = docSnap.data() || {};
        const isClosed = t.status === "closed" || t.status === "resolved" || Boolean(t.isArchived);
        if (isClosed) resolvedTickets++;
        else openTickets++;

        const created = toDateObj(t.createdAt);
        if (created) {
          const ms = created.getTime();
          if (ms >= sevenDaysAgo) last7dTickets++;
          addToBucket(ticketBuckets, ms, 1);
          if (ms >= currentPeriodStartMs) currentPeriodTickets++;
          else if (ms >= previousPeriodStartMs) previousPeriodTickets++;
          if (ms >= monthStartMs && isClosed) mtdResolvedTickets++;
        }

        recentTickets.push({
          id: docSnap.id,
          subject: t.subject || t.title || "Requête client",
          userName: t.userName || t.userEmail || t.clientName || "Utilisateur",
          status: isClosed ? "RESOLVED" : "OPEN",
          priority: t.priority || "NORMAL",
          createdAtMs: created ? created.getTime() : 0,
        });
      });

      recentTickets.sort((a, b) => {
        if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
        return b.createdAtMs - a.createdAtMs;
      });

      const totalTickets = ticketsSnap?.size ?? 0;
      const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;
      const avgDailyTickets = Number((last7dTickets / 7).toFixed(1));

      supportData = {
        summary: {
          openTickets,
          resolvedTickets,
          totalTickets,
          periodTickets: currentPeriodTickets,
          resolutionRate,
          totalClients: totalClientsCount,
          mtdResolvedTickets,
        },
        trends: {
          tickets: computeTrend(currentPeriodTickets, previousPeriodTickets),
        },
        goalProgress: {
          currentRatePct: resolutionRate,
          targetRatePct: goals.supportResolutionTargetPct,
          onTrack: resolutionRate >= goals.supportResolutionTargetPct,
          mtdResolvedTickets,
        },
        forecasts: {
          avgDailyTickets,
          projected7dTickets: Math.round(avgDailyTickets * 7),
          projected30dTickets: Math.round(avgDailyTickets * 30),
          backlogPressure: openTickets > 10 ? "ELEVEE" : openTickets > 3 ? "MODEREE" : "CALME",
        },
        ticketsSeries: ticketBuckets.map(({ name, total }) => ({ name, total })),
        pie: [
          { name: "Ouvertes", value: openTickets, color: "#f59e0b" },
          { name: "Résolues", value: resolvedTickets, color: "#22c55e" },
        ],
        recentTickets: recentTickets.slice(0, 8),
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. PÔLE CATALOGUE & MODÉRATION
    // ═══════════════════════════════════════════════════════════════════════
    let catalogueData: any = null;
    if (scopes.catalogue) {
      const catBuckets = buildTimeBuckets(rangeDays);
      let pendingProducts = 0;
      let activeProducts = 0;
      let pendingProperties = 0;
      let activeProperties = 0;
      let currentPeriodSubmissions = 0;
      let previousPeriodSubmissions = 0;
      let mtdSubmissions = 0;
      let last7dSubmissions = 0;
      const sevenDaysAgo = nowMs - 7 * 86400000;
      const rayonCounts = { saveurs: 0, mode: 0, connect: 0, immo: 0 };
      const recentPendingItems: any[] = [];

      productsSnap?.forEach((docSnap: any) => {
        const p = docSnap.data() || {};
        const st = String(p.status || "ACTIVE").toUpperCase();
        const created = toDateObj(p.createdAt);
        const r = classifyRayon(p);
        rayonCounts[r]++;

        if (created) {
          const ms = created.getTime();
          if (ms >= sevenDaysAgo) last7dSubmissions++;
          addToBucket(catBuckets, ms, 1);
          if (ms >= currentPeriodStartMs) currentPeriodSubmissions++;
          else if (ms >= previousPeriodStartMs) previousPeriodSubmissions++;
          if (ms >= monthStartMs) mtdSubmissions++;
        }

        if (st === "PENDING_APPROVAL") {
          pendingProducts++;
          recentPendingItems.push({
            id: docSnap.id,
            kind: "PRODUCT",
            title: typeof p.title === "object" ? p.title?.fr || p.name || "Produit" : p.title || p.name || "Produit",
            rayon: r,
            price: Number(p.price) || 0,
            status: st,
            createdAtMs: created ? created.getTime() : 0,
          });
        } else if (st !== "REJECTED") {
          activeProducts++;
        }
      });

      propertiesSnap?.forEach((docSnap: any) => {
        const prop = docSnap.data() || {};
        const st = String(prop.status || "ACTIVE").toUpperCase();
        const created = toDateObj(prop.createdAt);
        rayonCounts.immo++;

        if (created) {
          const ms = created.getTime();
          if (ms >= sevenDaysAgo) last7dSubmissions++;
          addToBucket(catBuckets, ms, 1);
          if (ms >= currentPeriodStartMs) currentPeriodSubmissions++;
          else if (ms >= previousPeriodStartMs) previousPeriodSubmissions++;
          if (ms >= monthStartMs) mtdSubmissions++;
        }

        if (st === "PENDING_APPROVAL") {
          pendingProperties++;
          recentPendingItems.push({
            id: docSnap.id,
            kind: "PROPERTY",
            title: prop.title || "Bien immobilier",
            rayon: "immo",
            price: Number(prop.price) || 0,
            status: st,
            createdAtMs: created ? created.getTime() : 0,
          });
        } else if (st !== "REJECTED") {
          activeProperties++;
        }
      });

      recentPendingItems.sort((a, b) => b.createdAtMs - a.createdAtMs);
      const totalListings = (productsSnap?.size ?? 0) + (propertiesSnap?.size ?? 0);
      const totalPendingModeration = pendingProducts + pendingProperties;
      const approvalRate = totalListings > 0 ? Math.round(((activeProducts + activeProperties) / totalListings) * 100) : 100;

      catalogueData = {
        summary: {
          totalProducts: productsSnap?.size ?? 0,
          activeProducts,
          pendingProducts,
          totalProperties: propertiesSnap?.size ?? 0,
          activeProperties,
          pendingProperties,
          totalPendingModeration,
          activeSuppliers: Math.max(0, supplierDocs.length - pendingSuppliersKyc),
          pendingSuppliersKyc,
          approvalRate,
          periodSubmissions: currentPeriodSubmissions,
          mtdSubmissions,
        },
        trends: {
          submissions: computeTrend(currentPeriodSubmissions, previousPeriodSubmissions),
        },
        goalProgress: {
          currentRatePct: approvalRate,
          targetRatePct: goals.catalogueApprovalTargetPct,
          onTrack: approvalRate >= goals.catalogueApprovalTargetPct,
          mtdSubmissions,
        },
        forecasts: {
          last7dSubmissions,
          projected30dListings: Math.round((last7dSubmissions / 7) * 30),
          rayonCounts,
        },
        catalogueSeries: catBuckets.map(({ name, total }) => ({ name, total })),
        pie: [
          { name: "Saveurs", value: rayonCounts.saveurs, color: "#FF6B35" },
          { name: "Mode", value: rayonCounts.mode, color: "#D4B08C" },
          { name: "Connect", value: rayonCounts.connect, color: "#00B5A5" },
          { name: "Immo", value: rayonCounts.immo, color: "#4C6EF5" },
        ],
        recentPendingItems: recentPendingItems.slice(0, 8),
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. PÔLE CROISSANCE & ADMINISTRATION (KYC, Partenaires, Clients, App)
    // ═══════════════════════════════════════════════════════════════════════
    let growthData: any = null;
    if (scopes.growth) {
      const last7dSignups = growthBuckets.slice(-7).reduce((acc, b) => acc + b.total, 0);
      const signupsGoalPct = Math.min(100, Math.round((mtdSignups / Math.max(1, goals.monthlyNewSignupsTarget)) * 100));
      const projectedMonthEndSignups = Math.round((mtdSignups / dayOfMonth) * daysInMonth);

      growthData = {
        summary: {
          totalClients: totalClientsCount,
          totalPartners: Object.keys(partnersMap).length,
          totalSuppliers: supplierDocs.length,
          activeSuppliers: Math.max(0, supplierDocs.length - pendingSuppliersKyc),
          pendingSuppliersKyc,
          installedAppsCount: (devicesSnap?.size ?? 0) + (driversSnap?.size ?? 0),
          periodSignups: currentSignups,
          mtdSignups,
        },
        trends: {
          signups: computeTrend(currentSignups, previousSignups),
        },
        goalProgress: {
          mtdSignups,
          targetSignups: goals.monthlyNewSignupsTarget,
          pct: signupsGoalPct,
          projectedMonthEndSignups,
          onTrack: signupsGoalPct >= monthElapsedPct || projectedMonthEndSignups >= goals.monthlyNewSignupsTarget,
        },
        forecasts: {
          last7dSignups,
          avgDailySignups: Number((last7dSignups / 7).toFixed(1)),
          projected30dSignups: Math.round((last7dSignups / 7) * 30),
        },
        growthSeries: growthBuckets.map(({ name, total }) => ({ name, total })),
        pie: [
          { name: "Clients", value: totalClientsCount, color: "#38bdf8" },
          { name: "Fournisseurs", value: supplierDocs.length, color: "#C7D300" },
          { name: "Partenaires", value: Object.keys(partnersMap).length, color: "#a855f7" },
        ],
      };
    }

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      rangeDays,
      monthContext: {
        dayOfMonth,
        daysInMonth,
        monthElapsedPct,
        monthLabel: nowDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      },
      goals,
      isSuper,
      isFullAdmin,
      positions,
      scopes,
      finance: financeData,
      logistics: logisticsData,
      support: supportData,
      catalogue: catalogueData,
      growth: growthData,
    });
  } catch (error: any) {
    console.error("[STAFF DASHBOARD GET ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/staff-dashboard
 * Permet à la Direction (Super Admin / Sous-Admin) d'ajuster les objectifs mensuels du Team (`settings/team_goals`).
 */
export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireFullAdminCaller(req);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;

    const body = await req.json();
    const clamp = (val: any, min: number, max: number, fallback: number) => {
      const n = Number(val);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.round(n)));
    };

    const nextGoals: TeamGoals = {
      monthlyRevenueTargetUSD: clamp(body.monthlyRevenueTargetUSD, 50, 1_000_000, DEFAULT_TEAM_GOALS.monthlyRevenueTargetUSD),
      deliveryRateTargetPct: clamp(body.deliveryRateTargetPct, 50, 100, DEFAULT_TEAM_GOALS.deliveryRateTargetPct),
      supportResolutionTargetPct: clamp(body.supportResolutionTargetPct, 50, 100, DEFAULT_TEAM_GOALS.supportResolutionTargetPct),
      catalogueApprovalTargetPct: clamp(body.catalogueApprovalTargetPct, 50, 100, DEFAULT_TEAM_GOALS.catalogueApprovalTargetPct),
      monthlyNewSignupsTarget: clamp(body.monthlyNewSignupsTarget, 5, 100_000, DEFAULT_TEAM_GOALS.monthlyNewSignupsTarget),
    };

    await adminDb
      .collection("settings")
      .doc("team_goals")
      .set(
        {
          ...nextGoals,
          updatedBy: guard.caller.email || guard.caller.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    recordAuditLog({
      action: "SETTINGS_UPDATED",
      caller: guard.caller,
      targetType: "settings",
      targetId: "team_goals",
      summary: `Objectifs mensuels du Team mis à jour (Revenus: $${nextGoals.monthlyRevenueTargetUSD}, Livraison: ${nextGoals.deliveryRateTargetPct}%, SAV: ${nextGoals.supportResolutionTargetPct}%, Inscriptions: ${nextGoals.monthlyNewSignupsTarget})`,
      metadata: nextGoals,
    });

    return NextResponse.json({ success: true, goals: nextGoals });
  } catch (error: any) {
    console.error("[STAFF DASHBOARD PATCH GOALS ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Impossible de sauvegarder les objectifs." },
      { status: 500 }
    );
  }
}
