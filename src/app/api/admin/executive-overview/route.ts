import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES } from "@/lib/serverAuth";
import { requireAnyStaffPermission } from "@/server/guards";
import { creditReferralCommission } from "@/lib/referrals";
import { dispatchAccountNotification } from "@/lib/pushNotifications";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache";

function resolveSupplierRayon(data: any): string {
  const candidates: string[] = [];
  if (Array.isArray(data?.assignedRayons)) {
    candidates.push(...data.assignedRayons.map((r: any) => String(r || "")));
  }
  if (data?.rayon) candidates.push(String(data.rayon));
  if (data?.serviceAttached) candidates.push(String(data.serviceAttached));
  if (data?.businessType) candidates.push(String(data.businessType));
  if (data?.category) candidates.push(String(data.category));
  if (data?.role) candidates.push(String(data.role));

  for (const raw of candidates) {
    const val = raw.toLowerCase().trim();
    if (!val) continue;
    if (val.includes("immo") || val.includes("hotel") || val.includes("hôtel")) return "immo";
    if (val.includes("saveur") || val.includes("food") || val.includes("alim") || val.includes("resto")) return "saveurs";
    if (val.includes("mode") || val.includes("fashion") || val.includes("vetement") || val.includes("vêtement")) return "mode";
    if (val.includes("connect") || val.includes("tech") || val.includes("elec") || val.includes("service")) return "connect";
  }
  return "connect";
}

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

const OVERVIEW_CACHE_KEY = "admin:executive-overview:v1";
const OVERVIEW_CACHE_TTL_SEC = 30;

/**
 * GET /api/admin/executive-overview
 * Centralise toutes les données financières (Abonnements Payés/Impayés/Essai, Commissions Partenaires, Caisse),
 * les Prévisions Financières (MRR, Projection 30j/90j/Annuelle) et les indicateurs opérationnels (Logistique, Support, Catalogue).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["finance.view", "finance.cash", "subscriptions.manage"]);
    if (!guard.ok) return guard.errorResponse!;

    const forceFresh = req.nextUrl.searchParams.get("fresh") === "1";
    if (!forceFresh) {
      const cached = await cacheGet<any>(OVERVIEW_CACHE_KEY);
      if (cached.hit && cached.value) {
        return NextResponse.json(cached.value, {
          headers: { "X-Rayons-Cache": cached.source },
        });
      }
    }

    const [
      usersSnap,
      transactionsSnap,
      commissionsSnap,
      ordersSnap,
      driversSnap,
      ticketsSnap,
      productsSnap,
      propertiesSnap,
      devicesSnap,
      finSettingsSnap,
    ] = await Promise.all([
      adminDb.collection("users").get(),
      adminDb.collection("transactions").limit(400).get(),
      adminDb.collection("referral_commissions").limit(400).get(),
      adminDb.collection("orders").limit(400).get(),
      adminDb.collection("drivers").limit(200).get(),
      adminDb.collection("tickets").limit(200).get(),
      adminDb.collection("products").limit(300).get(),
      adminDb.collection("properties").limit(300).get(),
      adminDb.collection("push_devices").limit(300).get(),
      adminDb.collection("settings").doc("financial").get(),
    ]);

    const finSettings = finSettingsSnap.exists ? finSettingsSnap.data() || {} : {};
    const baseMonthlyFee = Number(finSettings.monthlySubscriptionPrice) || 50;
    const promoDiscount = Number(finSettings.promoDiscountUSD) || 10;
    const partnerCommissionRate = Number(finSettings.referralCommissionUSD) || 5;

    // 1. Identifier les Partenaires, Clients et Fournisseurs
    const partnersMap: Record<string, { id: string; name: string; code: string; balance: number; totalEarned: number }> = {};
    const supplierDocs: any[] = [];
    let totalClientsCount = 0;
    let pendingSuppliersKyc = 0;

    usersSnap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const role = String(d.role || "").toUpperCase();

      if (d.isPartner === true || role === "PARTNER" || d.accountType === "PARTNER") {
        partnersMap[docSnap.id] = {
          id: docSnap.id,
          name: d.displayName || d.name || d.company || d.email || "Partenaire",
          code: d.partnerCode || d.referralCode || "---",
          balance: Number(d.referralBalance ?? d.partnerBalance) || 0,
          totalEarned: Number(d.referralTotalEarned ?? d.partnerTotalEarned) || 0,
        };
        return;
      }

      if (isStaffOrAdminDoc(d)) {
        return;
      }

      if (role.includes("DRIVER") || role.includes("LIVREUR") || role.includes("CHAUFFEUR")) {
        return;
      }

      const isSupplierUser =
        d.isSupplier === true ||
        role.includes("SUPPLIER") ||
        role.includes("FOURNISSEUR") ||
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

    // 2. Calculer les paiements d'abonnement reçus par fournisseur
    const paidBySupplier: Record<string, { count: number; totalUSD: number; lastPaidAt: string | null }> = {};
    let collectedSubscriptionRevenueUSD = 0;

    transactionsSnap.forEach((docSnap: any) => {
      const t = docSnap.data() || {};
      if (t.type === "SUBSCRIPTION" || t.category === "Abonnement" || String(t.description || "").toLowerCase().includes("abonnement")) {
        const amt = Number(t.amount) || 0;
        collectedSubscriptionRevenueUSD += amt;
        const sId = t.supplierId;
        if (sId) {
          if (!paidBySupplier[sId]) {
            paidBySupplier[sId] = { count: 0, totalUSD: 0, lastPaidAt: null };
          }
          paidBySupplier[sId].count += 1;
          paidBySupplier[sId].totalUSD += amt;
          const tsIso = t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : null;
          if (tsIso && (!paidBySupplier[sId].lastPaidAt || tsIso > paidBySupplier[sId].lastPaidAt!)) {
            paidBySupplier[sId].lastPaidAt = tsIso;
          }
        }
      }
    });

    // 3. Construire la liste détaillée des Abonnements Fournisseurs (Payés / Essai / Expirés)
    let paidActiveCount = 0;
    let trialCount = 0;
    let unpaidExpiredCount = 0;
    let officialCount = 0;
    let expiringIn7DaysCount = 0;

    let currentMRR = 0;
    let confirmedPartnerCommissions30d = 0;
    let trialConversionPotential30d = 0;
    let overdueRecoveryPotential = 0;
    let projected30dPartnerCommissions = 0;

    const supplierSubscriptions = supplierDocs
      .filter((s) => s.isDeleted !== true && s.deletionStatus !== "DELETED")
      .map((s) => {
      const isOfficial = Boolean(s.isOfficialAdminStore || s.isAdminSupplier);
      const partnerId =
        s.referredByPartnerId ||
        s.referredBy ||
        (s.creatorRole === "PARTNER" ? s.createdBy : null);
      const partnerInfo = partnerId ? partnersMap[partnerId] : null;
      const isPartnerRecruited = Boolean(partnerInfo || s.partnerReferral || s.referralCodeUsed);

      const monthlyFeeUSD = isOfficial ? 0 : isPartnerRecruited ? Math.max(0, baseMonthlyFee - promoDiscount) : baseMonthlyFee;
      const partnerCommissionUSD = !isOfficial && isPartnerRecruited ? partnerCommissionRate : 0;

      const endDate = s.subscriptionEndDate?.toDate
        ? s.subscriptionEndDate.toDate()
        : s.subscriptionEndDate
        ? new Date(s.subscriptionEndDate)
        : null;

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
        if (isPartnerRecruited) {
          confirmedPartnerCommissions30d += partnerCommissionUSD;
          projected30dPartnerCommissions += partnerCommissionUSD;
        }
        if (daysRemaining <= 7) expiringIn7DaysCount++;
      } else {
        paymentState = "TRIAL";
        trialCount++;
        trialConversionPotential30d += monthlyFeeUSD;
        if (isPartnerRecruited) projected30dPartnerCommissions += partnerCommissionUSD;
        if (daysRemaining <= 7) expiringIn7DaysCount++;
      }

      return {
        id: s.id,
        name: s.companyName || s.company || s.displayName || s.name || "Boutique",
        email: s.email || "",
        phone: s.phone || s.phoneNumber || "",
        rayon: resolveSupplierRayon(s),
        paymentState,
        subscriptionStatus: rawStatus,
        subscriptionEndDate: endDate ? endDate.toISOString() : null,
        daysRemaining,
        monthlyFeeUSD,
        partnerId: partnerId || null,
        partnerName: partnerInfo?.name || null,
        partnerCode: partnerInfo?.code || s.referralCodeUsed || null,
        partnerCommissionUSD,
        paymentsCount: paymentStats.count,
        totalPaidUSD: paymentStats.totalUSD,
        lastPaidAt: paymentStats.lastPaidAt,
      };
    });

    // Trier : Impayés en premier, puis Essai proche d'expiration, puis Payés Actifs
    const statePriority: Record<string, number> = {
      UNPAID_EXPIRED: 1,
      TRIAL: 2,
      PAID_ACTIVE: 3,
      EXEMPT_OFFICIAL: 4,
    };
    supplierSubscriptions.sort((a, b) => {
      const pDiff = (statePriority[a.paymentState] || 9) - (statePriority[b.paymentState] || 9);
      if (pDiff !== 0) return pDiff;
      return a.daysRemaining - b.daysRemaining;
    });

    // 4. Commissions Partenaires cumulées
    let totalPartnerCommissionsEarnedUSD = 0;
    let pendingPartnerPayoutsUSD = 0;
    let paidPartnerPayoutsUSD = 0;

    Object.values(partnersMap).forEach((p) => {
      totalPartnerCommissionsEarnedUSD += p.totalEarned;
      pendingPartnerPayoutsUSD += p.balance;
    });

    commissionsSnap.forEach((docSnap: any) => {
      const c = docSnap.data() || {};
      if (c.status === "PAID") {
        paidPartnerPayoutsUSD += Number(c.amount) || 0;
      }
    });

    const netPlatformRevenueUSD = Math.max(0, collectedSubscriptionRevenueUSD - totalPartnerCommissionsEarnedUSD);

    // 5. Prévisions Financières HONNÊTES (MRR Confirmé séparé du potentiel d'essais/renouvellements)
    const confirmedNetMRR = Math.max(0, currentMRR - confirmedPartnerCommissions30d);
    const projected30dGrossRevenue = currentMRR;
    const projected30dNetRevenue = confirmedNetMRR;
    const projected90dRevenue = confirmedNetMRR * 3;
    const projectedAnnualARR = currentMRR * 12;

    // 6. Indicateurs Logistique, Commandes, Support & Catalogue
    let ordersAwaitingDriver = 0;
    let ordersInProgress = 0;
    let ordersCompleted = 0;
    let totalGMV = 0;

    ordersSnap.forEach((docSnap: any) => {
      const o = docSnap.data() || {};
      const st = String(o.status || "").toUpperCase();
      const amt = Number(o.totalAmount || o.subtotal || 0);
      if (st !== "CANCELLED") {
        totalGMV += amt;
      }
      if (st === "CONFIRMED_AWAITING_DRIVER" || st === "PENDING_DRIVER") {
        ordersAwaitingDriver++;
      } else if (["COMPLETED", "DELIVERED", "LIVRE"].includes(st)) {
        ordersCompleted++;
      } else if (st !== "CANCELLED") {
        ordersInProgress++;
      }
    });

    let openTicketsCount = 0;
    ticketsSnap.forEach((docSnap: any) => {
      const t = docSnap.data() || {};
      if (t.status !== "closed" && t.status !== "resolved" && !t.isArchived) {
        openTicketsCount++;
      }
    });

    let pendingProductsCount = 0;
    productsSnap.forEach((docSnap: any) => {
      const p = docSnap.data() || {};
      if (String(p.status || "").toUpperCase() === "PENDING_APPROVAL") {
        pendingProductsCount++;
      }
    });

    let pendingPropertiesCount = 0;
    propertiesSnap.forEach((docSnap: any) => {
      const prop = docSnap.data() || {};
      if (String(prop.status || "").toUpperCase() === "PENDING_APPROVAL") {
        pendingPropertiesCount++;
      }
    });

    const payload = {
      success: true,
      financeSummary: {
        paidActiveCount,
        trialCount,
        unpaidExpiredCount,
        officialCount,
        totalCommercialSuppliers: supplierDocs.length,
        collectedSubscriptionRevenueUSD,
        totalPartnerCommissionsEarnedUSD,
        pendingPartnerPayoutsUSD,
        paidPartnerPayoutsUSD,
        netPlatformRevenueUSD,
        baseMonthlyFee,
        promoDiscount,
        partnerCommissionRate,
      },
      forecasts: {
        currentMRR,
        trialConversionPotential30d,
        overdueRecoveryPotential,
        projected30dGrossRevenue,
        projected30dPartnerCommissions,
        projected30dNetRevenue,
        projected90dRevenue,
        projectedAnnualARR,
        expiringIn7DaysCount,
      },
      operations: {
        driversTotal: driversSnap.size,
        ordersAwaitingDriver,
        ordersInProgress,
        ordersCompleted,
        totalOrdersCount: ordersSnap.size,
        totalGMV,
        openTicketsCount,
        totalTicketsCount: ticketsSnap.size,
        totalClientsCount,
        totalPartnersCount: Object.keys(partnersMap).length,
        pendingSuppliersKyc,
        pendingProductsCount,
        pendingPropertiesCount,
        totalProductsCount: productsSnap.size,
        totalPropertiesCount: propertiesSnap.size,
        installedAppsCount: devicesSnap.size + driversSnap.size,
      },
      supplierSubscriptions,
    };

    await cacheSet(OVERVIEW_CACHE_KEY, payload, OVERVIEW_CACHE_TTL_SEC);

    return NextResponse.json(payload, { headers: { "X-Rayons-Cache": "db" } });
  } catch (error: any) {
    console.error("[EXECUTIVE OVERVIEW GET ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/executive-overview
 * Permet au Responsable Financier ou au Super Admin d'enregistrer un paiement d'abonnement fournisseur (+30 jours),
 * d'inscrire l'entrée en caisse et de créditer automatiquement la commission de 5$ au partenaire recruteur.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["finance.cash", "subscriptions.manage"]);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;
    const caller = guard.caller;

    // Invalider le cache distribué Redis + L1 lors d'une écriture financière
    await cacheDel(OVERVIEW_CACHE_KEY);

    const body = await req.json();
    const {
      action,
      supplierId,
      amountPaid,
      amount,
      paymentMethod = "Mobile Money / Caisse Centrale",
      referencePiece = "",
      note = "",
    } = body;

    if (action === "RECORD_SUBSCRIPTION_PAYMENT") {
      if (!supplierId) {
        return NextResponse.json({ success: false, error: "supplierId requis." }, { status: 400 });
      }

      const cleanRef = String(referencePiece || "").trim();
      if (cleanRef.length < 3 || cleanRef.length > 80) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Référence de paiement obligatoire (ex: ID transaction M-Pesa, Airtel Money, Orange Money ou n° reçu caisse).",
          },
          { status: 400 }
        );
      }

      const userRef = adminDb.collection("users").doc(supplierId);
      const supplierRef = adminDb.collection("suppliers").doc(supplierId);
      const lockId = `sub_${cleanRef.toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}`;
      const lockRef = adminDb.collection("subscription_payments").doc(lockId);

      const requestedAmount = Number(amountPaid ?? amount);
      if (
        (amountPaid !== undefined || amount !== undefined) &&
        (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > 10000)
      ) {
        return NextResponse.json(
          { success: false, error: "Montant d'abonnement invalide." },
          { status: 400 }
        );
      }

      const year = new Date().getFullYear();
      const entryNumber = `ECR-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
      const cleanMethod = String(paymentMethod || "Mobile Money / Caisse Centrale").trim().slice(0, 80);
      const cleanNote = String(note || "").trim().slice(0, 200);

      let supplierName = "Fournisseur";
      let finalAmount = 50;
      let newEndDate = new Date();

      // Transaction atomique unique : verrou d'idempotence + activation + caisse + Grand Livre Admin + audit
      await adminDb.runTransaction(async (tx: any) => {
        const [userSnap, lockSnap] = await Promise.all([tx.get(userRef), tx.get(lockRef)]);

        if (!userSnap.exists) {
          throw new Error("SUPPLIER_NOT_FOUND");
        }
        if (lockSnap.exists) {
          throw new Error("DUPLICATE_PAYMENT_REF");
        }

        const sData = userSnap.data() || {};
        supplierName = sData.companyName || sData.company || sData.displayName || sData.name || "Fournisseur";
        const hasPartner = Boolean(sData.referredByPartnerId || sData.referredBy || sData.partnerReferral);
        finalAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : hasPartner ? 40 : 50;

        // Calculer la nouvelle échéance (+30 jours à partir de la date la plus lointaine)
        let baseDate = new Date();
        if (sData.subscriptionEndDate) {
          const existingEnd = sData.subscriptionEndDate.toDate
            ? sData.subscriptionEndDate.toDate()
            : new Date(sData.subscriptionEndDate);
          if (existingEnd > baseDate) {
            baseDate = existingEnd;
          }
        }
        newEndDate = new Date(baseDate);
        newEndDate.setDate(newEndDate.getDate() + 30);

        const now = FieldValue.serverTimestamp();
        const noteSuffix = cleanNote ? ` · ${cleanNote}` : "";

        // 1. Verrou d'idempotence anti-double encaissement
        tx.set(lockRef, {
          supplierId,
          supplierName,
          referencePiece: cleanRef,
          amount: finalAmount,
          paymentMethod: cleanMethod,
          note: cleanNote || null,
          recordedBy: caller.email || caller.uid,
          recordedByUid: caller.uid,
          entryNumber,
          createdAt: now,
        });

        // 2. Activer l'abonnement sur users/{supplierId} et suppliers/{supplierId}
        tx.set(
          userRef,
          {
            subscriptionStatus: "ACTIVE",
            subscriptionEndDate: newEndDate,
            isBlocked: false,
            isSuspended: false,
            status: "active",
            lastSubscriptionPaidAt: now,
            lastDepositPaidAt: now,
            lastDepositAmount: finalAmount,
          },
          { merge: true }
        );
        tx.set(
          supplierRef,
          {
            subscriptionStatus: "ACTIVE",
            subscriptionEndDate: newEndDate,
            isBlocked: false,
            status: "active",
            updatedAt: now,
          },
          { merge: true }
        );

        // 3. Transaction Plateforme Admin (`PLATFORM_ADMIN`)
        tx.set(adminDb.collection("transactions").doc(), {
          type: "SUBSCRIPTION",
          category: "Abonnement Mensuel Boutique",
          amount: finalAmount,
          currency: "USD",
          description: `Abonnement mensuel (30j) — ${supplierName} (${cleanMethod})${noteSuffix}`,
          referenceId: cleanRef,
          supplierId,
          supplierName,
          accountingScope: "PLATFORM_ADMIN",
          status: "COMPLETED",
          recordedBy: caller.email || caller.uid,
          recordedByUid: caller.uid,
          createdAt: now,
        });

        // 4. Grand Livre Plateforme Admin (`accounting_ledger`, actorType: "ADMIN", scope: "PLATFORM_ADMIN")
        tx.set(adminDb.collection("accounting_ledger").doc(), {
          entryNumber,
          date: now,
          createdAt: now,
          journal: "AB",
          journalName: "Journal des Abonnements Plateforme",
          referencePiece: cleanRef,
          label: `Abonnement mensuel boutique ${supplierName} (${cleanMethod})${noteSuffix}`,
          debit: finalAmount,
          credit: 0,
          currency: "USD",
          actorType: "ADMIN",
          accountingScope: "PLATFORM_ADMIN",
          supplierId,
          supplierName,
          category: "Abonnement Fournisseur",
          status: "VALIDATED",
          recordedBy: caller.email || caller.uid,
          recordedByUid: caller.uid,
        });

        // 5. Dépense dans le livre privé du fournisseur (`supplier_transactions`, scope: "SUPPLIER_PRIVATE")
        tx.set(adminDb.collection("supplier_transactions").doc(), {
          type: "EXPENSE",
          category: "Abonnement Plateforme",
          amount: finalAmount,
          currency: "USD",
          description: `Cotisation mensuelle Rayons.net (${cleanMethod}) — Réf: ${cleanRef}`,
          referenceId: cleanRef,
          supplierId,
          accountingScope: "SUPPLIER_PRIVATE",
          status: "COMPLETED",
          createdAt: now,
        });

        // 6. Trace immuable dans `audit_logs`
        tx.set(adminDb.collection("audit_logs").doc(), {
          action: "ADMIN_RECORD_SUBSCRIPTION_PAYMENT",
          category: "FINANCE",
          actorUid: caller.uid,
          actorEmail: caller.email || null,
          actorRole: caller.role || null,
          supplierId,
          supplierName,
          amount: finalAmount,
          paymentMethod: cleanMethod,
          referencePiece: cleanRef,
          entryNumber,
          newEndDate: newEndDate.toISOString(),
          createdAt: now,
        });
      });

      await cacheDel("admin:suppliers:list:v1");

      // 7. Créditer automatiquement la commission de 5$ au partenaire si la boutique est affiliée
      let commissionCredited = false;
      try {
        const commRes = await creditReferralCommission({
          filleulId: supplierId,
          paymentRef: cleanRef,
          amountPaid: finalAmount,
        });
        commissionCredited = commRes.credited;
      } catch (commErr) {
        console.warn("[EXECUTIVE OVERVIEW] Partner commission credit warning:", commErr);
      }

      // 8. Envoyer une notification au fournisseur
      await dispatchAccountNotification({
        userId: supplierId,
        supplierId,
        type: "system",
        title: "✅ Abonnement Mensuel Validé (+30 jours)",
        message: `Votre règlement de $${finalAmount.toFixed(2)} USD (Réf: ${cleanRef}) est confirmé. Votre boutique est active jusqu'au ${newEndDate.toLocaleDateString("fr-FR")}.`,
        link: "/supplier/finance",
      });

      return NextResponse.json({
        success: true,
        entryNumber,
        referencePiece: cleanRef,
        newEndDate: newEndDate.toISOString(),
        commissionCredited,
        message: `Abonnement de "${supplierName}" validé (+30j, $${finalAmount.toFixed(2)} USD · Réf ${cleanRef})${
          commissionCredited ? " et commission partenaire créditée !" : "."
        }`,
      });
    }

    return NextResponse.json({ success: false, error: "Action non reconnue." }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "SUPPLIER_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Fournisseur introuvable." }, { status: 404 });
    }
    if (error?.message === "DUPLICATE_PAYMENT_REF") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cette référence de paiement a déjà été enregistrée. Double encaissement bloqué automatiquement.",
        },
        { status: 409 }
      );
    }
    console.error("[EXECUTIVE OVERVIEW POST ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
