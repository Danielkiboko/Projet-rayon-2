import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getServerCaller, canActForSupplier } from "@/lib/serverAuth";
import { attachReferral, creditReferralCommission } from "@/lib/referrals";
import { computeDiscountedDeposit } from "@/lib/referralConfig";

function generateEntryNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `ECR-${year}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
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

    // ── Sécurité : seul le fournisseur lui-même (ou son sous-compte) ou un admin peut enregistrer un abonnement ──
    const caller = await getServerCaller(req);
    if (!canActForSupplier(caller, supplierId)) {
      return NextResponse.json(
        { success: false, error: "Authentification requise pour enregistrer un abonnement." },
        { status: 401 }
      );
    }

    const baseAmount = Number(amount) || 50;
    const ref = referencePiece || `RAY-DEP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = FieldValue.serverTimestamp();

    // ── Idempotence : une même référence de paiement n'est comptabilisée qu'une seule fois ──
    const paymentLockRef = adminDb.collection("subscription_payments").doc(
      `${supplierId}_${ref}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 140)
    );
    const paymentLockSnap = await paymentLockRef.get();
    const isDuplicatePayment = paymentLockSnap.exists;

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

    const userDocRef = adminDb.collection("users").doc(supplierId);
    const userDocSnap = await userDocRef.get();
    const existingUserData = userDocSnap.exists ? userDocSnap.data() : {};

    // ── Réduction parrainage (-10 USD sur le mois suivant l'inscription) ──
    // La réduction est posée à l'inscription et consommée au paiement suivant.
    const { discount: referralDiscount, total: finalAmount } = computeDiscountedDeposit(
      baseAmount,
      isDuplicatePayment ? 0 : existingUserData?.referralDiscountPending
    );
    const discountLabel = referralDiscount > 0 ? ` (réduction parrainage -$${referralDiscount})` : "";

    // ─────────────────────────────────────────────────────────────
    // 1. ÉCRITURE DANS LE GRAND LIVRE COMPTABLE CENTRAL (accounting_ledger)
    // ─────────────────────────────────────────────────────────────
    const ledgerEntry = {
      entryNumber,
      date: now,
      journal: "AB",
      journalName: "Journal des Abonnements & Dépôts",
      referencePiece: ref,
      label: `Encaissement abonnement mensuel - Fournisseur ${effectiveName} (${paymentMethod})${discountLabel}`,
      debit: finalAmount, // Entrée d'argent dans la trésorerie de Rayons.net
      credit: 0,
      balanceAfter: finalAmount,
      currency: currency || "USD",
      actorType: "ADMIN",
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

    // Ne pas rétrograder le superAdmin si c'est lui qui teste
    let finalRole = targetRole;
    if (existingUserData?.role === "SUPER_ADMIN" || existingUserData?.role === "superAdmin") {
      finalRole = existingUserData.role;
    }

    const userUpdatePayload: any = {
      uid: supplierId,
      role: finalRole,
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      // Le tarif de référence reste le montant plein (la réduction parrainage est ponctuelle)
      depositAmount: baseAmount,
      subscriptionEndDate: nextDueDate,
      lastDepositPaidAt: now,
      lastDepositAmount: finalAmount,
      lastPaymentReference: ref,
      paymentMethodUsed: paymentMethod,
      isBlocked: false,
      updatedAt: now,
    };

    if (referralDiscount > 0) {
      userUpdatePayload.referralDiscountPending = Math.max(
        0,
        (Number(existingUserData?.referralDiscountPending) || 0) - referralDiscount
      );
      userUpdatePayload.referralDiscountUsedAt = now;
    }

    // Doublon (ex : même paiement renvoyé à l'étape 2 de l'inscription) : on ne touche ni à l'échéance ni aux finances
    if (isDuplicatePayment) {
      delete userUpdatePayload.subscriptionEndDate;
      delete userUpdatePayload.lastDepositPaidAt;
      delete userUpdatePayload.lastDepositAmount;
    }

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

    // ─────────────────────────────────────────────────────────────
    // ÉCRITURE ATOMIQUE VIA BATCH
    // ─────────────────────────────────────────────────────────────
    const batch = adminDb.batch();

    const ledgerRef = adminDb.collection("accounting_ledger").doc();
    const adminTxRef = adminDb.collection("transactions").doc();
    const supplierTxRef = adminDb.collection("supplier_transactions").doc();

    if (!isDuplicatePayment) {
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
    }

    batch.set(userDocRef, userUpdatePayload, { merge: true });

    await batch.commit();

    // ─────────────────────────────────────────────────────────────
    // PARRAINAGE : rattachement (1ʳᵉ souscription uniquement) + commission 5 USD au parrain
    // Les erreurs de parrainage ne doivent jamais bloquer l'abonnement.
    // ─────────────────────────────────────────────────────────────
    let referral: { attached?: boolean; reason?: string; credited?: boolean } = {};
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
      const c = await creditReferralCommission({ filleulId: supplierId, paymentRef: ref, amountPaid: finalAmount });
      referral.credited = c.credited;
    } catch (refErr) {
      console.error("[SUPPLIER SUBSCRIBE] referral processing error:", refErr);
    }

    return NextResponse.json({
      success: true,
      referenceId: ref,
      entryNumber,
      ledgerId: ledgerRef.id,
      adminTxId: adminTxRef.id,
      supplierTxId: supplierTxRef.id,
      subscriptionEndDate: nextDueDate.toISOString(),
      amountCharged: finalAmount,
      referralDiscount,
      duplicate: isDuplicatePayment,
      referral,
      message: `Abonnement de $${finalAmount} validé et enregistré dans le Grand Livre Admin et l'Espace Fournisseur.`,
    });
  } catch (error: any) {
    console.error("[SUPPLIER SUBSCRIBE API ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur serveur lors de la validation de l'abonnement." },
      { status: 500 }
    );
  }
}
