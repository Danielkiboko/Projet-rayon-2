import { enforceRateLimit } from "@/lib/rateLimit";
import { safeApiError } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";
import { getServerCaller, canActForSupplier, SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { requireAnyStaffPermission } from "@/server/guards";
import { hasStaffPermission } from "@/domain/permissions";
import { isSuperAdmin } from "@/domain/roles";
import { creditReferralCommission } from "@/lib/referrals";
import { computeDiscountedDeposit } from "@/lib/referralConfig";
import { dispatchAccountNotification } from "@/lib/pushNotifications";
import { recordAuditLog } from "@/server/auditLog";

const VALID_OPERATORS = ["MPESA", "AIRTEL_MONEY", "ORANGE_MONEY", "AFRIMONEY", "CASH_OFFICE"] as const;
type MobileMoneyOperator = (typeof VALID_OPERATORS)[number];

const OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  MPESA: "M-Pesa (Vodacom)",
  AIRTEL_MONEY: "Airtel Money",
  ORANGE_MONEY: "Orange Money",
  AFRIMONEY: "Afrimoney",
  CASH_OFFICE: "Caisse / Bureau Rayons",
};

function generateEntryNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `ECR-${year}-${rand}`;
}

/**
 * GET /api/payments/mobile-money
 * - Admin Finance : liste toutes les demandes (en attente en priorité)
 * - Fournisseur : liste ses propres demandes de paiement d'abonnement
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    await initFirebaseAdmin();
    const subject = { ...(caller.data || {}), email: caller.email, role: caller.role };
    const isFinanceAdmin =
      isSuperAdmin(subject) ||
      hasStaffPermission(subject, "finance.view") ||
      hasStaffPermission(subject, "finance.cash") ||
      hasStaffPermission(subject, "subscriptions.manage");

    const scope = req.nextUrl.searchParams.get("scope");
    let snap;

    if (isFinanceAdmin && scope !== "mine") {
      snap = await adminDb.collection("subscription_payment_requests").limit(120).get();
    } else {
      const targetSupplierId = caller.parentSupplierId || caller.uid;
      snap = await adminDb
        .collection("subscription_payment_requests")
        .where("supplierId", "==", targetSupplierId)
        .limit(30)
        .get();
    }

    const requests = snap.docs
      .map((doc: any) => {
        const d = doc.data() || {};
        const createdMs =
          typeof d.createdAtMs === "number" ? d.createdAtMs : d.createdAt?.toMillis?.() || 0;
        return {
          id: doc.id,
          supplierId: d.supplierId || "",
          supplierName: d.supplierName || "Fournisseur",
          supplierEmail: d.supplierEmail || "",
          operator: d.operator || "MPESA",
          operatorLabel: OPERATOR_LABELS[d.operator as MobileMoneyOperator] || d.operator || "Mobile Money",
          senderPhone: d.senderPhone || "",
          transactionRef: d.transactionRef || "",
          baseAmount: Number(d.baseAmount) || 50,
          discountAmount: Number(d.discountAmount) || 0,
          finalAmount: Number(d.finalAmount) || 50,
          currency: d.currency || "USD",
          note: d.note || "",
          status: d.status || "PENDING_VERIFICATION",
          rejectionReason: d.rejectionReason || null,
          reviewedByEmail: d.reviewedByEmail || null,
          reviewedAt: d.reviewedAt?.toDate ? d.reviewedAt.toDate().toISOString() : null,
          createdAtMs: createdMs,
          createdAt: createdMs ? new Date(createdMs).toISOString() : null,
        };
      })
      .sort((a: any, b: any) => {
        if (a.status === "PENDING_VERIFICATION" && b.status !== "PENDING_VERIFICATION") return -1;
        if (b.status === "PENDING_VERIFICATION" && a.status !== "PENDING_VERIFICATION") return 1;
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      });

    const pendingCount = requests.filter((r: any) => r.status === "PENDING_VERIFICATION").length;

    return NextResponse.json({ success: true, requests, pendingCount });
  } catch (error: any) {
    console.error("[GET /api/payments/mobile-money ERROR]:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur serveur") }, { status: 500 });
  }
}

/**
 * POST /api/payments/mobile-money
 * Un fournisseur soumet une preuve de paiement Mobile Money (M-Pesa / Airtel / Orange / Afrimoney / Caisse)
 * pour vérification et validation 1 clic par la Direction Financière.
 */
export async function POST(req: NextRequest) {
  try {
  const _rl = await enforceRateLimit(req, "api:payments_mobile-money:POST", 20, 60);
  if (_rl) return _rl;
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const body = await req.json();
    const supplierId = String(body.supplierId || caller.parentSupplierId || caller.uid).trim();
    if (!canActForSupplier(caller, supplierId)) {
      return NextResponse.json({ success: false, error: "Non autorisé pour ce compte fournisseur." }, { status: 403 });
    }

    const operatorRaw = String(body.operator || "MPESA").toUpperCase().trim() as MobileMoneyOperator;
    if (!VALID_OPERATORS.includes(operatorRaw)) {
      return NextResponse.json({ success: false, error: "Opérateur Mobile Money non reconnu." }, { status: 400 });
    }

    const senderPhone = String(body.senderPhone || "").trim();
    const transactionRef = String(body.transactionRef || "").trim().toUpperCase();
    const note = String(body.note || "").trim().slice(0, 300);

    if (operatorRaw !== "CASH_OFFICE" && senderPhone.length < 7) {
      return NextResponse.json(
        { success: false, error: "Veuillez saisir le numéro Mobile Money ayant effectué le transfert." },
        { status: 400 }
      );
    }

    if (transactionRef.length < 4 || transactionRef.length > 80) {
      return NextResponse.json(
        { success: false, error: "Veuillez indiquer la référence / ID de transaction SMS (min. 4 caractères)." },
        { status: 400 }
      );
    }

    await initFirebaseAdmin();

    // Anti-doublon strict sur la référence de transaction SMS
    const dupSnap = await adminDb
      .collection("subscription_payment_requests")
      .where("transactionRef", "==", transactionRef)
      .limit(1)
      .get();

    if (!dupSnap.empty) {
      const existing = dupSnap.docs[0].data() || {};
      if (existing.status !== "REJECTED") {
        return NextResponse.json(
          { success: false, error: "Cette référence de transaction a déjà été soumise ou validée." },
          { status: 409 }
        );
      }
    }

    // Récupérer les infos fournisseur + tarif officiel plateforme
    const [userSnap, settingsSnap] = await Promise.all([
      adminDb.collection("users").doc(supplierId).get(),
      adminDb.collection("settings").doc("platform").get(),
    ]);

    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: "Compte fournisseur introuvable." }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const platformData = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const officialMonthlyFee = Number(platformData.monthlySubscriptionPrice) > 0 && Number(platformData.monthlySubscriptionPrice) < 1000
      ? Number(platformData.monthlySubscriptionPrice)
      : Number(userData.depositAmount) || 50;

    const discounted = computeDiscountedDeposit(
      officialMonthlyFee,
      Number(userData.referralDiscountPending) || 0
    );

    const supplierName = String(
      userData.company || userData.companyName || userData.displayName || userData.name || userData.email || "Fournisseur"
    ).trim();

    const docRef = await adminDb.collection("subscription_payment_requests").add({
      supplierId,
      supplierName,
      supplierEmail: userData.email || caller.email || "",
      operator: operatorRaw,
      operatorLabel: OPERATOR_LABELS[operatorRaw],
      senderPhone,
      transactionRef,
      baseAmount: officialMonthlyFee,
      discountAmount: discounted.discount,
      finalAmount: discounted.total,
      currency: "USD",
      note,
      status: "PENDING_VERIFICATION",
      submittedByUid: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });

    // Notifier automatiquement la Direction & le Responsable Financier (dans leur langue préférée)
    try {
      const staffSnap = await adminDb.collection("users").where("isInternalStaff", "==", true).limit(30).get();
      const financeUids = new Set<string>();
      staffSnap.forEach((sDoc: any) => {
        const sd = sDoc.data() || {};
        if (
          isSuperAdmin(sd) ||
          hasStaffPermission(sd, "finance.cash") ||
          hasStaffPermission(sd, "subscriptions.manage")
        ) {
          financeUids.add(sDoc.id);
        }
      });

      // Inclure aussi les comptes Super Admin bootstrap par email si le flag isInternalStaff n'était pas posé
      if (SUPER_ADMIN_EMAILS.length > 0) {
        const superSnap = await adminDb
          .collection("users")
          .where("email", "in", SUPER_ADMIN_EMAILS.slice(0, 10))
          .get();
        superSnap.forEach((d: any) => financeUids.add(d.id));
      }

      if (financeUids.size > 0) {
        await Promise.allSettled(
          Array.from(financeUids).map((uid) =>
            dispatchAccountNotification({
              userId: uid,
              type: "SUBSCRIPTION_PAYMENT_PROOF",
              title: `💳 Paiement Mobile Money à valider ($${discounted.total})`,
              message: `${supplierName} a soumis une preuve ${OPERATOR_LABELS[operatorRaw]} (Réf: ${transactionRef}, Tél: ${senderPhone || "Caisse"}). Validez en 1 clic dans Finances.`,
              link: "/admin/finance",
              tag: `mm-proof-${docRef.id}`,
            })
          )
        );
      }
    } catch (notifErr) {
      console.warn("[mobile-money POST] finance notification warning:", notifErr);
    }

    return NextResponse.json({
      success: true,
      requestId: docRef.id,
      amount: discounted.total,
      message: `Votre preuve ${OPERATOR_LABELS[operatorRaw]} (Réf: ${transactionRef}) a été transmise à la caisse Rayons.net. Votre abonnement sera activé dès vérification.`,
    });
  } catch (error: any) {
    console.error("[POST /api/payments/mobile-money ERROR]:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur serveur") }, { status: 500 });
  }
}

/**
 * PATCH /api/payments/mobile-money
 * Validation ou rejet en 1 clic par la Direction Financière (Super Admin / Sub Admin / Responsable Financier).
 * Lors de l'approbation : active +30 jours, écrit dans le Grand Livre, crédite la commission Partenaire ($5)
 * et notifie le fournisseur dans sa langue préférée.
 */
export async function PATCH(req: NextRequest) {
  try {
  const _rl = await enforceRateLimit(req, "api:payments_mobile-money:PATCH", 20, 60);
  if (_rl) return _rl;
    const guard = await requireAnyStaffPermission(req, ["finance.cash", "subscriptions.manage"]);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;
    const caller = guard.caller;

    const body = await req.json();
    const { requestId, action, rejectionReason } = body || {};

    if (!requestId || !["APPROVE", "REJECT"].includes(String(action))) {
      return NextResponse.json(
        { success: false, error: "Paramètres requestId et action (APPROVE | REJECT) requis." },
        { status: 400 }
      );
    }

    await initFirebaseAdmin();
    const reqRef = adminDb.collection("subscription_payment_requests").doc(String(requestId));
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      return NextResponse.json({ success: false, error: "Demande de paiement introuvable." }, { status: 404 });
    }

    const reqData = reqSnap.data() || {};
    if (reqData.status !== "PENDING_VERIFICATION") {
      return NextResponse.json(
        { success: false, error: `Cette demande a déjà été traitée (${reqData.status}).` },
        { status: 409 }
      );
    }

    const supplierId = String(reqData.supplierId);
    const supplierName = String(reqData.supplierName || "Fournisseur");
    const finalAmount = Number(reqData.finalAmount) || 50;
    const baseAmount = Number(reqData.baseAmount) || finalAmount;
    const discountAmount = Number(reqData.discountAmount) || 0;
    const operatorLabel = String(reqData.operatorLabel || reqData.operator || "Mobile Money");
    const transactionRef = String(reqData.transactionRef || `MM-${Date.now().toString().slice(-6)}`);

    // ── REJET ────────────────────────────────────────────────────────────────
    if (action === "REJECT") {
      const reason = String(rejectionReason || "Référence Mobile Money introuvable ou montant non reçu.").trim().slice(0, 300);
      await reqRef.update({
        status: "REJECTED",
        rejectionReason: reason,
        reviewedByUid: caller.uid,
        reviewedByEmail: caller.email,
        reviewedAt: FieldValue.serverTimestamp(),
      });

      await dispatchAccountNotification({
        userId: supplierId,
        supplierId,
        type: "SUBSCRIPTION_REJECTED",
        title: "⚠️ Preuve de paiement Mobile Money non validée",
        message: `Votre paiement ${operatorLabel} (Réf: ${transactionRef}) n'a pas pu être confirmé. Motif : ${reason}. Veuillez vérifier et soumettre à nouveau.`,
        link: "/supplier/finance",
        tag: `mm-reject-${requestId}`,
      });

      recordAuditLog({
        action: "SUBSCRIPTION_REQUEST_REJECTED",
        caller,
        targetType: "supplier",
        targetId: supplierId,
        summary: `Rejet preuve Mobile Money ${operatorLabel} (Réf: ${transactionRef}) de ${supplierName}. Motif: ${reason}`,
        metadata: { requestId, transactionRef, reason },
      });

      return NextResponse.json({
        success: true,
        status: "REJECTED",
        message: `Preuve de paiement rejetée et fournisseur notifié.`,
      });
    }

    // ── APPROBATION & ACTIVATION AUTOMATIQUE (+30 JOURS + GRAND LIVRE + $5 PARTENAIRE) ──
    const userRef = adminDb.collection("users").doc(supplierId);
    const userSnap = await userRef.get();
    const existingUser = userSnap.exists ? userSnap.data() || {} : {};

    // Prolonger à partir de la date d'échéance actuelle si encore active, sinon dès aujourd'hui
    let baseDate = new Date();
    if (existingUser.subscriptionEndDate) {
      const existingEnd = existingUser.subscriptionEndDate.toDate
        ? existingUser.subscriptionEndDate.toDate()
        : new Date(existingUser.subscriptionEndDate);
      if (!isNaN(existingEnd.getTime()) && existingEnd > baseDate) {
        baseDate = existingEnd;
      }
    }
    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + 30);

    const entryNumber = generateEntryNumber();
    const now = FieldValue.serverTimestamp();
    const discountLabel = discountAmount > 0 ? ` (réduction parrainage -$${discountAmount})` : "";

    const batch = adminDb.batch();

    // 1. Marquer la demande comme approuvée
    batch.update(reqRef, {
      status: "APPROVED",
      entryNumber,
      reviewedByUid: caller.uid,
      reviewedByEmail: caller.email,
      reviewedAt: now,
    });

    // 2. Activer le fournisseur dans users & suppliers
    const userUpdate: Record<string, any> = {
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      subscriptionEndDate: newEndDate,
      lastDepositPaidAt: now,
      lastDepositAmount: finalAmount,
      lastPaymentReference: transactionRef,
      paymentMethodUsed: operatorLabel,
      isBlocked: false,
      isSuspended: false,
      updatedAt: now,
    };
    if (discountAmount > 0) {
      userUpdate.referralDiscountPending = Math.max(
        0,
        (Number(existingUser.referralDiscountPending) || 0) - discountAmount
      );
      userUpdate.referralDiscountUsedAt = now;
    }
    batch.set(userRef, userUpdate, { merge: true });

    batch.set(
      adminDb.collection("suppliers").doc(supplierId),
      {
        status: "active",
        subscriptionStatus: "ACTIVE",
        subscriptionEndDate: newEndDate,
        isBlocked: false,
        updatedAt: now,
      },
      { merge: true }
    );

    // 3. Grand Livre Comptable Central (accounting_ledger — PLATFORM_ADMIN)
    batch.set(adminDb.collection("accounting_ledger").doc(), {
      entryNumber,
      date: now,
      createdAt: now,
      journal: "AB",
      journalName: "Journal des Abonnements & Dépôts",
      referencePiece: transactionRef,
      label: `Abonnement mensuel ${operatorLabel} - ${supplierName}${discountLabel}`,
      debit: finalAmount,
      credit: 0,
      balanceAfter: finalAmount,
      currency: "USD",
      actorType: "ADMIN",
      accountingScope: "PLATFORM_ADMIN",
      supplierId,
      supplierName,
      category: "Abonnement Fournisseur",
      status: "VALIDATED",
      validatedBy: caller.uid,
    });

    // 4. Transactions Admin (transactions — PLATFORM_ADMIN)
    batch.set(adminDb.collection("transactions").doc(), {
      type: "SUBSCRIPTION",
      amount: finalAmount,
      currency: "USD",
      description: `Abonnement Fournisseur (${operatorLabel}) - ${supplierName}${discountLabel}`,
      referenceId: transactionRef,
      status: "COMPLETED",
      accountingScope: "PLATFORM_ADMIN",
      supplierId,
      supplierName,
      createdAt: now,
    });

    // 5. Livre de caisse Fournisseur (supplier_transactions)
    batch.set(adminDb.collection("supplier_transactions").doc(), {
      type: "EXPENSE",
      category: "Abonnement",
      amount: finalAmount,
      currency: "USD",
      description: `Abonnement mensuel Rayons.net via ${operatorLabel} ($${finalAmount})${discountLabel}`,
      referenceId: transactionRef,
      status: "COMPLETED",
      supplierId,
      createdAt: now,
    });

    await batch.commit();

    // 6. Créditer automatiquement la commission Partenaire ($5)
    let referralCredited = false;
    try {
      const refResult = await creditReferralCommission({
        filleulId: supplierId,
        paymentRef: transactionRef,
        amountPaid: finalAmount,
      });
      referralCredited = Boolean(refResult?.credited);
    } catch (refErr) {
      console.warn("[mobile-money PATCH] referral commission warning:", refErr);
    }

    // 7. Notifier le fournisseur (traduit automatiquement dans sa langue préférée FR/EN/ZH)
    await dispatchAccountNotification({
      userId: supplierId,
      supplierId,
      type: "SUBSCRIPTION_ACTIVATED",
      title: "✅ Abonnement activé pour 30 jours !",
      message: `Votre paiement ${operatorLabel} de $${finalAmount} USD (Réf: ${transactionRef}) a été validé. Votre boutique est active jusqu'au ${newEndDate.toLocaleDateString("fr-FR")}.`,
      link: "/supplier/finance",
      tag: `mm-approve-${requestId}`,
    });

    // 8. Journal d'audit serveur immuable
    recordAuditLog({
      action: "SUBSCRIPTION_REQUEST_APPROVED",
      caller,
      targetType: "supplier",
      targetId: supplierId,
      summary: `Paiement ${operatorLabel} de $${finalAmount} USD (Réf: ${transactionRef}) validé pour ${supplierName} — actif jusqu'au ${newEndDate.toISOString().slice(0, 10)}${referralCredited ? " (+5$ commission partenaire)" : ""}.`,
      metadata: {
        requestId,
        operator: reqData.operator,
        transactionRef,
        baseAmount,
        discountAmount,
        finalAmount,
        entryNumber,
        referralCredited,
      },
    });

    return NextResponse.json({
      success: true,
      status: "APPROVED",
      entryNumber,
      referralCredited,
      subscriptionEndDate: newEndDate.toISOString(),
      message: `Paiement ${operatorLabel} de $${finalAmount} validé ! ${supplierName} est actif jusqu'au ${newEndDate.toLocaleDateString("fr-FR")}${referralCredited ? " (commission partenaire créditée)" : ""}.`,
    });
  } catch (error: any) {
    console.error("[PATCH /api/payments/mobile-money ERROR]:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur serveur") }, { status: 500 });
  }
}
