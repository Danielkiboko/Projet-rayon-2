import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller, SUPER_ADMIN_EMAILS, ADMIN_ROLES } from "@/lib/serverAuth";
import { creditReferralCommission } from "@/lib/referrals";
import { dispatchAccountNotification } from "@/lib/pushNotifications";

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

/**
 * GET /api/admin/executive-overview
 * Centralise toutes les données financières (Abonnements Payés/Impayés/Essai, Commissions Partenaires, Caisse),
 * les Prévisions Financières (MRR, Projection 30j/90j/Annuelle) et les indicateurs opérationnels (Logistique, Support, Catalogue).
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Accès réservé à l'administration." }, { status: 403 });
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

    // 3. Construire la liste détaillée des Abonnements Fournisseurs (Payés / Essai / Impayés)
    let paidActiveCount = 0;
    let trialCount = 0;
    let unpaidExpiredCount = 0;
    let officialCount = 0;
    let expiringIn7DaysCount = 0;

    let currentMRR = 0;
    let trialConversionPotential30d = 0;
    let overdueRecoveryPotential = 0;
    let projected30dPartnerCommissions = 0;

    const supplierSubscriptions = supplierDocs.map((s) => {
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
        if (isPartnerRecruited) projected30dPartnerCommissions += partnerCommissionUSD;
        if (daysRemaining <= 7) expiringIn7DaysCount++;
      } else {
        paymentState = "TRIAL";
        trialCount++;
        trialConversionPotential30d += monthlyFeeUSD;
        if (isPartnerRecruited) projected30dPartnerCommissions += partnerCommissionUSD;
        if (daysRemaining <= 7) expiringIn7DaysCount++;
      }

      // Si un fournisseur est marqué ACTIVE mais qu'aucune transaction n'avait été comptabilisée
      if (paymentState === "PAID_ACTIVE" && paymentStats.totalUSD === 0) {
        collectedSubscriptionRevenueUSD += monthlyFeeUSD;
      }

      return {
        id: s.id,
        name: s.companyName || s.company || s.displayName || s.name || "Boutique",
        email: s.email || "",
        phone: s.phone || s.phoneNumber || "",
        rayon: s.rayon || (Array.isArray(s.assignedRayons) && s.assignedRayons[0]) || "connect",
        paymentState,
        subscriptionStatus: rawStatus,
        subscriptionEndDate: endDate ? endDate.toISOString() : null,
        daysRemaining,
        monthlyFeeUSD,
        partnerId: partnerId || null,
        partnerName: partnerInfo?.name || null,
        partnerCode: partnerInfo?.code || s.referralCodeUsed || null,
        partnerCommissionUSD,
        paymentsCount: paymentStats.count || (paymentState === "PAID_ACTIVE" ? 1 : 0),
        totalPaidUSD: paymentStats.totalUSD || (paymentState === "PAID_ACTIVE" ? monthlyFeeUSD : 0),
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

    // 5. Prévisions Financières (30j, 90j, Annuel)
    const projected30dGrossRevenue = currentMRR + trialConversionPotential30d + overdueRecoveryPotential;
    const projected30dNetRevenue = Math.max(0, projected30dGrossRevenue - projected30dPartnerCommissions);
    const projected90dRevenue = projected30dGrossRevenue * 3;
    const projectedAnnualARR = projected30dGrossRevenue * 12;

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

    return NextResponse.json({
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
    });
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
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Accès réservé à la Direction Financière." }, { status: 403 });
    }

    const body = await req.json();
    const { action, supplierId, amountPaid, paymentMethod = "Mobile Money / Caisse Centrale" } = body;

    if (action === "RECORD_SUBSCRIPTION_PAYMENT") {
      if (!supplierId) {
        return NextResponse.json({ success: false, error: "supplierId requis." }, { status: 400 });
      }

      const userRef = adminDb.collection("users").doc(supplierId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ success: false, error: "Fournisseur introuvable." }, { status: 404 });
      }

      const sData = userSnap.data() || {};
      const supplierName = sData.companyName || sData.company || sData.displayName || sData.name || "Fournisseur";
      const hasPartner = Boolean(sData.referredByPartnerId || sData.referredBy || sData.partnerReferral);
      const finalAmount = Number(amountPaid) > 0 ? Number(amountPaid) : hasPartner ? 40 : 50;

      // Calculer la nouvelle échéance (+30 jours)
      let baseDate = new Date();
      if (sData.subscriptionEndDate) {
        const existingEnd = sData.subscriptionEndDate.toDate
          ? sData.subscriptionEndDate.toDate()
          : new Date(sData.subscriptionEndDate);
        if (existingEnd > baseDate) {
          baseDate = existingEnd;
        }
      }
      const newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + 30);

      const refPiece = `ABO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Activer l'abonnement sur users/{supplierId} et suppliers/{supplierId}
      await Promise.all([
        userRef.set(
          {
            subscriptionStatus: "ACTIVE",
            subscriptionEndDate: newEndDate,
            isBlocked: false,
            isSuspended: false,
            status: "active",
            lastSubscriptionPaidAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
        adminDb
          .collection("suppliers")
          .doc(supplierId)
          .set(
            {
              subscriptionStatus: "ACTIVE",
              subscriptionEndDate: newEndDate,
              isBlocked: false,
              status: "active",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),
      ]);

      // 2. Enregistrer l'encaissement dans `transactions` et `accounting_ledger`
      await Promise.all([
        adminDb.collection("transactions").add({
          type: "SUBSCRIPTION",
          category: "Abonnement Mensuel Boutique",
          amount: finalAmount,
          currency: "USD",
          description: `Règlement abonnement mensuel (30j) — ${supplierName} (${paymentMethod})`,
          referenceId: refPiece,
          supplierId,
          supplierName,
          status: "COMPLETED",
          recordedBy: caller.email || caller.uid,
          createdAt: FieldValue.serverTimestamp(),
        }),
        adminDb.collection("accounting_ledger").add({
          entryNumber: `ECR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          date: FieldValue.serverTimestamp(),
          journal: "BQ",
          journalName: "Journal de Trésorerie (Abonnements Fournisseurs)",
          referencePiece: refPiece,
          label: `Encaissement abonnement mensuel boutique ${supplierName} (${paymentMethod})`,
          debit: finalAmount,
          credit: 0,
          balanceAfter: finalAmount,
          currency: "USD",
          actorType: "SUPPLIER",
          supplierId,
          supplierName,
          category: "Abonnement Mensuel",
          status: "VALIDATED",
          createdAt: FieldValue.serverTimestamp(),
        }),
      ]);

      // 3. Créditer automatiquement la commission de 5$ au partenaire si la boutique est affiliée
      let commissionCredited = false;
      try {
        const commRes = await creditReferralCommission({
          filleulId: supplierId,
          paymentRef: refPiece,
          amountPaid: finalAmount,
        });
        commissionCredited = commRes.credited;
      } catch (commErr) {
        console.warn("[EXECUTIVE OVERVIEW] Partner commission credit warning:", commErr);
      }

      // 4. Envoyer une notification Push au fournisseur
      await dispatchAccountNotification({
        userId: supplierId,
        supplierId,
        type: "system",
        title: "✅ Abonnement Mensuel Validé (+30 jours)",
        message: `Votre règlement de $${finalAmount.toFixed(2)} USD (Réf: ${refPiece}) est confirmé. Votre boutique est active jusqu'au ${newEndDate.toLocaleDateString("fr-FR")}.`,
        link: "/supplier/finance",
      });

      return NextResponse.json({
        success: true,
        referencePiece: refPiece,
        newEndDate: newEndDate.toISOString(),
        commissionCredited,
        message: `Abonnement de "${supplierName}" validé (+30j, $${finalAmount} USD)${
          commissionCredited ? " et commission de $5 créditée au partenaire !" : " !"
        }`,
      });
    }

    return NextResponse.json({ success: false, error: "Action non reconnue." }, { status: 400 });
  } catch (error: any) {
    console.error("[EXECUTIVE OVERVIEW POST ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
