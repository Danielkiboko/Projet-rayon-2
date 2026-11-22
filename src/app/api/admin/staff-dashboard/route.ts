import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminCaller } from "@/server/guards";
import { hasStaffPermission } from "@/domain/permissions";
import { isSuperAdmin } from "@/domain/roles";
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES } from "@/lib/serverAuth";

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

function buildDailyBuckets(daysCount: number) {
  const buckets: { key: string; name: string; total: number }[] = [];
  const map = new Map<string, { key: string; name: string; total: number }>();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const name = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    const entry = { key, name, total: 0 };
    buckets.push(entry);
    map.set(key, entry);
  }
  return { buckets, map };
}

function classifyRayon(item: any): "saveurs" | "mode" | "connect" | "immo" {
  const cat = String(item.category || "").toLowerCase();
  const ray = String(item.rayon || "").toLowerCase();
  const combined = `${cat} ${ray}`;
  if (combined.includes("saveur") || combined.includes("resto") || combined.includes("plat") || combined.includes("food") || combined.includes("cuisine")) {
    return "saveurs";
  }
  if (combined.includes("mode") || combined.includes("vetement") || combined.includes("vêtement") || combined.includes("chaussure") || combined.includes("habit")) {
    return "mode";
  }
  if (combined.includes("immo") || combined.includes("hotel") || combined.includes("maison") || combined.includes("appart")) {
    return "immo";
  }
  return "connect";
}

/**
 * GET /api/admin/staff-dashboard
 * Retourne des statistiques, courbes d'évolution (14j/30j), prévoyances et listes récentes
 * strictement cloisonnées selon les permissions réelles du fonctionnaire connecté.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminCaller(req);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;

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
      needUsers ? adminDb.collection("users").get() : Promise.resolve(null),
      scopes.finance ? adminDb.collection("transactions").limit(500).get() : Promise.resolve(null),
      scopes.finance ? adminDb.collection("referral_commissions").limit(400).get() : Promise.resolve(null),
      scopes.finance
        ? adminDb.collection("subscription_payment_requests").where("status", "==", "PENDING").limit(100).get()
        : Promise.resolve(null),
      scopes.finance ? adminDb.collection("settings").doc("financial").get() : Promise.resolve(null),
      scopes.logistics ? adminDb.collection("orders").limit(500).get() : Promise.resolve(null),
      scopes.logistics ? adminDb.collection("drivers").limit(300).get() : Promise.resolve(null),
      scopes.support ? adminDb.collection("tickets").limit(300).get() : Promise.resolve(null),
      scopes.catalogue ? adminDb.collection("products").limit(400).get() : Promise.resolve(null),
      scopes.catalogue ? adminDb.collection("properties").limit(400).get() : Promise.resolve(null),
      scopes.growth ? adminDb.collection("push_devices").limit(400).get() : Promise.resolve(null),
    ]);

    // ── Parsing partagé de `users` si nécessaire ──
    const partnersMap: Record<string, { id: string; name: string; code: string; balance: number; totalEarned: number }> = {};
    const supplierDocs: any[] = [];
    let totalClientsCount = 0;
    let pendingSuppliersKyc = 0;
    const growthBuckets = buildDailyBuckets(14);

    if (usersSnap) {
      usersSnap.forEach((docSnap: any) => {
        const d = docSnap.data() || {};
        const r = String(d.role || "").toUpperCase();
        const created = toDateObj(d.createdAt);

        if (created) {
          const dayKey = created.toISOString().slice(0, 10);
          const b = growthBuckets.map.get(dayKey);
          if (b && !isStaffOrAdminDoc(d)) {
            b.total += 1;
          }
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

      const revBuckets = buildDailyBuckets(14);
      const paidBySupplier: Record<string, { count: number; totalUSD: number; lastPaidAt: string | null }> = {};
      let collectedSubscriptionRevenueUSD = 0;

      transactionsSnap?.forEach((docSnap: any) => {
        const t = docSnap.data() || {};
        const isSub =
          t.type === "SUBSCRIPTION" ||
          t.category === "Abonnement" ||
          String(t.description || "").toLowerCase().includes("abonnement");
        const amt = Number(t.amount) || 0;

        const created = toDateObj(t.createdAt);
        if (created && amt > 0 && (isSub || t.status === "COMPLETED")) {
          const dayKey = created.toISOString().slice(0, 10);
          const bucket = revBuckets.map.get(dayKey);
          if (bucket) bucket.total += amt;
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
        const daysRemaining = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
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

      // Courbe prévisionnelle M+1 -> M+6 basée sur le MRR réel + conversion prudente des essais & recouvrements
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      const nowDate = new Date();
      const forecastProjectionSeries = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(nowDate.getFullYear(), nowDate.getMonth() + i, 1);
        const label = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
        // Réalisé / acquis (MRR actuel), Prévu (MRR + conversion progressive des essais et recouvrement)
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

      financeData = {
        summary: {
          collectedSubscriptionRevenueUSD,
          netPlatformRevenueUSD,
          paidActiveCount,
          trialCount,
          unpaidExpiredCount,
          officialCount,
          pendingMobileMoneyCount: mobileMoneySnap?.size ?? 0,
          pendingPartnerPayoutsUSD,
          paidPartnerPayoutsUSD,
          totalPartnerCommissionsEarnedUSD,
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
        revenueSeries: revBuckets.buckets.map(({ name, total }) => ({ name, total })),
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
      const orderBuckets = buildDailyBuckets(14);
      let ordersAwaitingDriver = 0;
      let ordersInProgress = 0;
      let ordersCompleted = 0;
      let ordersCancelled = 0;
      let totalGMV = 0;
      let last7dOrders = 0;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentOrders: any[] = [];

      ordersSnap?.forEach((docSnap: any) => {
        const o = docSnap.data() || {};
        const st = String(o.status || "PENDING").toUpperCase();
        const amt = Number(o.totalAmount || o.subtotal || 0);
        const created = toDateObj(o.createdAt);

        if (st !== "CANCELLED") totalGMV += amt;
        if (st === "CONFIRMED_AWAITING_DRIVER" || st === "PENDING_DRIVER" || st === "PENDING") {
          ordersAwaitingDriver++;
        } else if (["COMPLETED", "DELIVERED", "LIVRE"].includes(st)) {
          ordersCompleted++;
        } else if (st === "CANCELLED") {
          ordersCancelled++;
        } else {
          ordersInProgress++;
        }

        if (created) {
          if (created.getTime() >= sevenDaysAgo) last7dOrders++;
          const dayKey = created.toISOString().slice(0, 10);
          const b = orderBuckets.map.get(dayKey);
          if (b) b.total += 1;
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
      const completionRate = totalOrders > 0 ? Math.round((ordersCompleted / nonCancelled) * 100) : 0;
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
          totalGMV,
          completionRate,
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
        ordersSeries: orderBuckets.buckets.map(({ name, total }) => ({ name, total })),
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
      const ticketBuckets = buildDailyBuckets(14);
      let openTickets = 0;
      let resolvedTickets = 0;
      let last7dTickets = 0;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentTickets: any[] = [];

      ticketsSnap?.forEach((docSnap: any) => {
        const t = docSnap.data() || {};
        const isClosed = t.status === "closed" || t.status === "resolved" || Boolean(t.isArchived);
        if (isClosed) resolvedTickets++;
        else openTickets++;

        const created = toDateObj(t.createdAt);
        if (created) {
          if (created.getTime() >= sevenDaysAgo) last7dTickets++;
          const dayKey = created.toISOString().slice(0, 10);
          const b = ticketBuckets.map.get(dayKey);
          if (b) b.total += 1;
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
          resolutionRate,
          totalClients: totalClientsCount,
        },
        forecasts: {
          avgDailyTickets,
          projected7dTickets: Math.round(avgDailyTickets * 7),
          projected30dTickets: Math.round(avgDailyTickets * 30),
          backlogPressure: openTickets > 10 ? "ELEVEE" : openTickets > 3 ? "MODEREE" : "CALME",
        },
        ticketsSeries: ticketBuckets.buckets.map(({ name, total }) => ({ name, total })),
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
      const catBuckets = buildDailyBuckets(14);
      let pendingProducts = 0;
      let activeProducts = 0;
      let pendingProperties = 0;
      let activeProperties = 0;
      let last7dSubmissions = 0;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const rayonCounts = { saveurs: 0, mode: 0, connect: 0, immo: 0 };
      const recentPendingItems: any[] = [];

      productsSnap?.forEach((docSnap: any) => {
        const p = docSnap.data() || {};
        const st = String(p.status || "ACTIVE").toUpperCase();
        const created = toDateObj(p.createdAt);
        const r = classifyRayon(p);
        rayonCounts[r]++;

        if (created) {
          if (created.getTime() >= sevenDaysAgo) last7dSubmissions++;
          const dayKey = created.toISOString().slice(0, 10);
          const b = catBuckets.map.get(dayKey);
          if (b) b.total += 1;
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
          if (created.getTime() >= sevenDaysAgo) last7dSubmissions++;
          const dayKey = created.toISOString().slice(0, 10);
          const b = catBuckets.map.get(dayKey);
          if (b) b.total += 1;
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
        },
        forecasts: {
          last7dSubmissions,
          projected30dListings: Math.round((last7dSubmissions / 7) * 30),
          rayonCounts,
        },
        catalogueSeries: catBuckets.buckets.map(({ name, total }) => ({ name, total })),
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
      const last7dSignups = growthBuckets.buckets.slice(-7).reduce((acc, b) => acc + b.total, 0);
      growthData = {
        summary: {
          totalClients: totalClientsCount,
          totalPartners: Object.keys(partnersMap).length,
          totalSuppliers: supplierDocs.length,
          activeSuppliers: Math.max(0, supplierDocs.length - pendingSuppliersKyc),
          pendingSuppliersKyc,
          installedAppsCount: (devicesSnap?.size ?? 0) + (driversSnap?.size ?? 0),
        },
        forecasts: {
          last7dSignups,
          avgDailySignups: Number((last7dSignups / 7).toFixed(1)),
          projected30dSignups: Math.round((last7dSignups / 7) * 30),
        },
        growthSeries: growthBuckets.buckets.map(({ name, total }) => ({ name, total })),
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
