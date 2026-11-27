import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getServerCaller, canActForSupplier } from "@/lib/serverAuth";
import { attachReferral, creditReferralCommission } from "@/lib/referrals";
import { computeDiscountedDeposit } from "@/lib/referralConfig";
import { cacheDel } from "@/lib/cache";
import { enforceRateLimit } from "@/lib/rateLimit";

function generateEntryNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `ECR-${year}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "supplier:subscribe", 5, 60);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const {
      mode,
      supplierId,
      supplierName,
      supplierEmail,
      amount = 50,
      currency = "USD",
      paymentMethod = "Mobile Money / Caisse",
      referencePiece,
      businessType = "COMMERCE",
      companyData,
      referralCode,
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: "Identifiant fournisseur (supplierId) manquant." },
        { status: 400 }
      );
    }

    const caller = await getServerCaller(req);
    if (!caller || !canActForSupplier(caller, supplierId)) {
      return NextResponse.json(
        { success: false, error: "Authentification requise pour enregistrer une demande ou un abonnement." },
        { status: 401 }
      );
    }

    // Mode "application" = un client/candidat paie et soumet son projet pour évaluation admin.
    // Il ne reçoit JAMAIS de rayon ni de rôle fournisseur automatiquement : seul l'admin attribue le rayon.
    const isApplicationMode = mode === "application" || (!caller.isAdmin && !body.isRenewal);

    // Fail-closed strict : tout renouvellement non-admin passe obligatoirement par preuve Mobile Money validée ou webhook Visa signé
    if (!isApplicationMode && !caller.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pour sécuriser votre compte, veuillez soumettre votre référence Mobile Money (M-Pesa, Airtel Money, Orange Money) depuis votre Espace Finances ou utiliser le paiement Carte Visa.",
        },
        { status: 403 }
      );
    }

    // Tarif officiel depuis settings/platform (un non-admin ne peut pas imposer un montant inférieur)
    let officialPrice = 50;
    try {
      const platformSnap = await adminDb.collection("settings").doc("platform").get();
      if (platformSnap.exists) {
        const pPrice = Number(platformSnap.data()?.monthlySubscriptionPrice);
        if (pPrice > 0) officialPrice = pPrice;
      }
    } catch {
      // fallback 50
    }

    const requestedAmount = Number(amount) || officialPrice;
    const baseAmount = caller.isAdmin ? Math.max(1, requestedAmount) : Math.max(officialPrice, requestedAmount);
    const ref = referencePiece || `RAY-DEP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = FieldValue.serverTimestamp();

    const userDocRef = adminDb.collection("users").doc(supplierId);
    const userDocSnap = await userDocRef.get();
    const existingUserData = userDocSnap.exists ? userDocSnap.data() : {};

    // ── Idempotence & anti-abus : une même référence ou un double appel non-admin en moins de 24h n'est comptabilisé qu'une seule fois ──
    const paymentLockRef = adminDb.collection("subscription_payments").doc(
      `${supplierId}_${ref}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 140)
    );
    const paymentLockSnap = await paymentLockRef.get();
    let isDuplicatePayment = paymentLockSnap.exists;

    if (!isDuplicatePayment && !caller.isAdmin && existingUserData?.lastDepositPaidAt) {
      const lastPaidDate = existingUserData.lastDepositPaidAt?.toDate
        ? existingUserData.lastDepositPaidAt.toDate()
        : new Date(existingUserData.lastDepositPaidAt);
      if (!isNaN(lastPaidDate.getTime()) && Date.now() - lastPaidDate.getTime() < 24 * 60 * 60 * 1000) {
        isDuplicatePayment = true;
      }
    }

    const assigned = businessType === "IMMOBILIER"
      ? ["immo"]
      : businessType === "RESTAURATION"
        ? ["saveurs"]
        : businessType === "CONNECT"
          ? ["connect"]
          : ["mode"];

    const primaryRayon = assigned[0];
    const targetRole = businessType === "IMMOBILIER"
      ? "SUPPLIER_IMMO"
      : (businessType === "RESTAURATION" ? "SUPPLIER_SAVEURS" : "SUPPLIER");

    const effectiveName = (companyData?.company || supplierName || "Boutique Partenaire").trim();
    const entryNumber = generateEntryNumber();

    // Clôturer automatiquement la trace anti-coupure (`supplier_payment_intents`) si le client avait initié le paiement à l'Étape 1
    const intentDocId = String(ref).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
    adminDb
      .collection("supplier_payment_intents")
      .doc(intentDocId)
      .set(
        {
          status: "COMPLETED",
          supplierId,
          supplierName: effectiveName,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});

    // ── Réduction immédiate code promo / parrainage (-10 USD direct) ──
    const hasPromo = Boolean(referralCode || existingUserData?.referralCodeUsed || existingUserData?.referralDiscountPending);
    let referralDiscount = 0;
    let finalAmount = baseAmount;

    if (hasPromo && !isDuplicatePayment) {
      referralDiscount = 10;
      // Si le montant de base transmis était 50, on applique la réduction immédiate à 40
      if (baseAmount >= 50) {
        finalAmount = 40;
      } else {
        finalAmount = baseAmount;
      }
    } else {
      const discounted = computeDiscountedDeposit(
        baseAmount,
        isDuplicatePayment ? 0 : existingUserData?.referralDiscountPending
      );
      referralDiscount = discounted.discount;
      finalAmount = discounted.total;
    }
    const discountLabel = referralDiscount > 0 ? ` (réduction immédiate code promo -$${referralDiscount})` : "";

    // ─────────────────────────────────────────────────────────────
    // 1. ÉCRITURE DANS LE GRAND LIVRE COMPTABLE CENTRAL (accounting_ledger)
    // ─────────────────────────────────────────────────────────────
    const ledgerEntry = {
      entryNumber,
      date: now,
      createdAt: now,
      journal: "AB",
      journalName: "Journal des Abonnements & Dépôts",
      referencePiece: ref,
      label: `Encaissement abonnement mensuel - Fournisseur ${effectiveName} (${paymentMethod})${discountLabel}`,
      debit: finalAmount, // Entrée d'argent dans la trésorerie de Rayons.net
      credit: 0,
      balanceAfter: finalAmount,
      currency: currency || "USD",
      actorType: "ADMIN",
      accountingScope: "PLATFORM_ADMIN",
      supplierId,
      supplierName: effectiveName,
      category: "Abonnement Fournisseur",
      status: "VALIDATED",
    };

    // ─────────────────────────────────────────────────────────────
    // 2. TRANSACTIONS ADMIN (transactions)
    // ─────────────────────────────────────────────────────────────
    const adminTx = {
      type: "SUBSCRIPTION",
      amount: finalAmount,
      currency: currency || "USD",
      description: `Abonnement Fournisseur - ${effectiveName} (${paymentMethod})${discountLabel}`,
      referenceId: ref,
      status: "COMPLETED",
      accountingScope: "PLATFORM_ADMIN",
      supplierId,
      supplierName: effectiveName,
      createdAt: now,
    };

    // ─────────────────────────────────────────────────────────────
    // 3. LIVRE DE CAISSE FOURNISSEUR (supplier_transactions)
    // ─────────────────────────────────────────────────────────────
    const supplierTx = {
      type: "EXPENSE",
      category: "Abonnement",
      amount: finalAmount,
      currency: currency || "USD",
      description: `Cotisation mensuelle Abonnement Fournisseur Rayons ($${finalAmount})${discountLabel}`,
      referenceId: ref,
      status: "COMPLETED",
      supplierId,
      createdAt: now,
    };

    // ─────────────────────────────────────────────────────────────
    // 4. COMPTE UTILISATEUR (users/{supplierId})
    // ─────────────────────────────────────────────────────────────
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 30); // 30 jours renouvelables

    const projectDesc = String(companyData?.projectDescription || companyData?.description || "").trim();

    let userUpdatePayload: any;

    if (isApplicationMode) {
      // CANDIDATURE FOURNISSEUR : l'utilisateur NE PEUT PAS se donner un rayon ni activer son compte vendeur.
      // Son projet et son paiement sont mis en attente d'évaluation par l'administration.
      const preservedRole = existingUserData?.role || "CLIENT";
      userUpdatePayload = {
        uid: supplierId,
        role: preservedRole,
        status: existingUserData?.status || "active",
        supplierApplicationStatus: "PENDING_APPROVAL",
        profileUpdateStatus: "PENDING_APPROVAL",
        isSupplierApplication: true,
        rayon: existingUserData?.rayon || null,
        assignedRayons: Array.isArray(existingUserData?.assignedRayons) ? existingUserData.assignedRayons : [],
        depositAmount: baseAmount,
        lastDepositPaidAt: now,
        lastDepositAmount: finalAmount,
        lastPaymentReference: ref,
        paymentMethodUsed: paymentMethod,
        supplierApplication: {
          name: (companyData?.name || existingUserData?.displayName || "").trim(),
          company: effectiveName,
          email: (companyData?.email || supplierEmail || existingUserData?.email || "").trim(),
          phone: (companyData?.phone || existingUserData?.phone || "").trim(),
          commune: (companyData?.commune || "").trim(),
          address: (companyData?.address || "").trim(),
          projectDescription: projectDesc,
          paymentRef: ref,
          amountPaid: finalAmount,
          baseAmount,
          referralDiscount,
          paymentMethod,
          referralCode: referralCode || null,
          submittedAt: new Date().toISOString(),
        },
        companyName: effectiveName,
        company: effectiveName,
        ...(companyData?.name ? { name: companyData.name.trim(), displayName: companyData.name.trim() } : {}),
        ...(companyData?.email ? { email: companyData.email.trim() } : (supplierEmail && !existingUserData?.email ? { email: supplierEmail.trim() } : {})),
        ...(companyData?.phone ? { phone: companyData.phone.trim() } : {}),
        ...(companyData?.commune ? { commune: companyData.commune.trim() } : {}),
        ...(companyData?.address ? { address: companyData.address.trim() } : {}),
        ...(projectDesc ? { description: projectDesc } : {}),
        updatedAt: now,
      };
    } else {
      // ACTIVATION / RENOUVELLEMENT DIRECT (réservé admin)
      let finalRole = targetRole;
      if (existingUserData?.role === "SUPER_ADMIN" || existingUserData?.role === "superAdmin") {
        finalRole = existingUserData.role;
      }

      userUpdatePayload = {
        uid: supplierId,
        role: finalRole,
        status: "active",
        subscriptionStatus: "ACTIVE",
        depositAmount: baseAmount,
        subscriptionEndDate: nextDueDate,
        lastDepositPaidAt: now,
        lastDepositAmount: finalAmount,
        lastPaymentReference: ref,
        paymentMethodUsed: paymentMethod,
        isBlocked: false,
        updatedAt: now,
      };

      if (companyData) {
        if (companyData.name) {
          userUpdatePayload.name = companyData.name.trim();
          userUpdatePayload.displayName = companyData.name.trim();
        }
        if (companyData.company) userUpdatePayload.company = companyData.company.trim();
        if (companyData.email) userUpdatePayload.email = companyData.email.trim();
        if (companyData.phone) userUpdatePayload.phone = companyData.phone.trim();
        if (companyData.businessType) userUpdatePayload.businessType = companyData.businessType;
        userUpdatePayload.rayon = companyData.rayon || primaryRayon;
        userUpdatePayload.assignedRayons = companyData.assignedRayons || assigned;
        if (companyData.commune) userUpdatePayload.commune = companyData.commune.trim();
        if (companyData.address) userUpdatePayload.address = companyData.address.trim();
        if (companyData.description) userUpdatePayload.description = companyData.description.trim();
      } else {
        if (supplierName && !existingUserData?.company) userUpdatePayload.company = supplierName.trim();
        if (supplierEmail && !existingUserData?.email) userUpdatePayload.email = supplierEmail.trim();
        if (!existingUserData?.rayon) userUpdatePayload.rayon = primaryRayon;
        if (!existingUserData?.assignedRayons) userUpdatePayload.assignedRayons = assigned;
        if (!existingUserData?.businessType) userUpdatePayload.businessType = businessType;
      }
    }

    if (referralDiscount > 0) {
      userUpdatePayload.referralDiscountPending = Math.max(
        0,
        (Number(existingUserData?.referralDiscountPending) || 0) - referralDiscount
      );
      userUpdatePayload.referralDiscountUsedAt = now;
    }

    // Doublon (ex : même paiement renvoyé) : on ne touche ni à l'échéance ni aux finances
    if (isDuplicatePayment) {
      delete userUpdatePayload.subscriptionEndDate;
      delete userUpdatePayload.lastDepositPaidAt;
      delete userUpdatePayload.lastDepositAmount;
    }

    // ─────────────────────────────────────────────────────────────
    // ÉCRITURE ATOMIQUE VIA BATCH
    // Sécurité anti-fraude : une candidature soumise par un non-admin NE crédite JAMAIS
    // `accounting_ledger` ni `transactions` tant que l'Admin n'a pas vérifié le paiement.
    // Elle crée une preuve en attente (`subscription_payment_requests` = PENDING_VERIFICATION).
    // ─────────────────────────────────────────────────────────────
    const batch = adminDb.batch();
    const shouldWriteLedgerDirectly = caller.isAdmin;
    let ledgerId: string | null = null;
    let adminTxId: string | null = null;
    let supplierTxId: string | null = null;

    if (!isDuplicatePayment) {
      if (shouldWriteLedgerDirectly) {
        const ledgerRef = adminDb.collection("accounting_ledger").doc();
        const adminTxRef = adminDb.collection("transactions").doc();
        const supplierTxRef = adminDb.collection("supplier_transactions").doc();
        ledgerId = ledgerRef.id;
        adminTxId = adminTxRef.id;
        supplierTxId = supplierTxRef.id;

        batch.set(ledgerRef, ledgerEntry);
        batch.set(adminTxRef, adminTx);
        batch.set(supplierTxRef, supplierTx);
        batch.set(paymentLockRef, {
          supplierId,
          referenceId: ref,
          baseAmount,
          amount: finalAmount,
          referralDiscount,
          paymentMethod,
          recordedBy: caller?.uid || null,
          createdAt: now,
        });
      } else {
        // Preuve en attente de validation Admin dans `/admin/finance` (zéro pollution comptable)
        const pendingReqRef = adminDb.collection("subscription_payment_requests").doc();
        batch.set(pendingReqRef, {
          supplierId,
          supplierName: effectiveName,
          supplierEmail: supplierEmail || existingUserData?.email || "",
          operator: "MANUAL_APPLICATION",
          operatorLabel: paymentMethod || "Mobile Money / Candidature",
          senderPhone: companyData?.phone || existingUserData?.phone || "",
          transactionRef: ref,
          baseAmount,
          discountAmount: referralDiscount,
          finalAmount,
          note: `Candidature fournisseur (${effectiveName}) — en attente de vérification financière.`,
          status: "PENDING_VERIFICATION",
          createdAt: now,
        });
        userUpdatePayload.paymentVerificationStatus = "PENDING_VERIFICATION";
      }
    }

    batch.set(userDocRef, userUpdatePayload, { merge: true });

    await batch.commit();
    await cacheDel("admin:suppliers:list:v1");

    // Notifications temps réel (admin + candidat) lors d'une candidature fournisseur
    if (isApplicationMode) {
      try {
        const nowMs = Date.now();
        // 1. Notifier le client que son dossier est en évaluation
        await adminDb.collection("inapp_notifications").add({
          userId: supplierId,
          clientId: supplierId,
          type: "supplier_application",
          title: "📋 Projet fournisseur reçu pour évaluation",
          message: `Votre paiement ($${finalAmount} USD, réf. ${ref}) et le projet "${effectiveName}" ont bien été reçus. L'administration va vous attribuer votre rayon officiel.`,
          link: "/dashboard/client",
          read: false,
          seen: false,
          time: nowMs,
          createdAt: now,
        });

        // 2. Notifier les administrateurs habilités (limité à 10)
        const adminsSnap = await adminDb
          .collection("users")
          .where("role", "in", ["SUPER_ADMIN", "superAdmin", "ADMIN", "GESTIONNAIRE_ADMIN"])
          .limit(10)
          .get();

        const notifWrites = adminsSnap.docs.map((aDoc: any) =>
          adminDb.collection("inapp_notifications").add({
            userId: aDoc.id,
            type: "supplier_application",
            title: `🏪 Nouveau projet fournisseur : ${effectiveName}`,
            message: `${effectiveName} a payé $${finalAmount} USD et attend l'évaluation de son projet pour l'attribution de son rayon.`,
            link: "/admin/suppliers",
            read: false,
            seen: false,
            time: nowMs,
            createdAt: now,
          })
        );
        await Promise.allSettled(notifWrites);
      } catch (notifErr) {
        console.warn("[SUPPLIER SUBSCRIBE] notification warning:", notifErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PARRAINAGE : rattachement (1ʳᵉ souscription uniquement) + commission 5 USD au parrain
    // Les erreurs de parrainage ne doivent jamais bloquer l'abonnement.
    // ─────────────────────────────────────────────────────────────
    const referral: { attached?: boolean; reason?: string; credited?: boolean } = {};
    try {
      const isFirstSubscription = !existingUserData?.lastDepositPaidAt || isDuplicatePayment;
      if (referralCode && isFirstSubscription && !existingUserData?.referredBy) {
        const r = await attachReferral({
          filleulId: supplierId,
          code: referralCode,
          filleulName: effectiveName,
          filleulEmail: companyData?.email || supplierEmail || existingUserData?.email,
        });
        referral.attached = r.attached;
        referral.reason = r.reason;
      }
      if (!isDuplicatePayment && shouldWriteLedgerDirectly) {
        const c = await creditReferralCommission({ filleulId: supplierId, paymentRef: ref, amountPaid: finalAmount });
        referral.credited = c.credited;
      }
    } catch (refErr) {
      console.error("[SUPPLIER SUBSCRIBE] referral processing error:", refErr);
    }

    return NextResponse.json({
      success: true,
      referenceId: ref,
      entryNumber,
      ledgerId,
      adminTxId,
      supplierTxId,
      pendingVerification: !shouldWriteLedgerDirectly,
      subscriptionEndDate: nextDueDate.toISOString(),
      amountCharged: finalAmount,
      referralDiscount,
      duplicate: isDuplicatePayment,
      referral,
      message: shouldWriteLedgerDirectly
        ? `Abonnement de $${finalAmount} validé et enregistré dans le Grand Livre Admin et l'Espace Fournisseur.`
        : `Candidature enregistrée ! Votre preuve de paiement ($${finalAmount}, réf. ${ref}) est transmise à la direction financière pour vérification.`,
    });
  } catch (error: any) {
    console.error("[SUPPLIER SUBSCRIBE API ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur serveur lors de la validation de l'abonnement." },
      { status: 500 }
    );
  }
}
