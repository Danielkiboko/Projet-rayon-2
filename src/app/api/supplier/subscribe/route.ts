import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: "Identifiant fournisseur (supplierId) manquant." },
        { status: 400 }
      );
    }

    const finalAmount = Number(amount) || 50;
    const ref = referencePiece || `RAY-DEP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = FieldValue.serverTimestamp();

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

    // ─────────────────────────────────────────────────────────────
    // 1. ÉCRITURE DANS LE GRAND LIVRE COMPTABLE CENTRAL (accounting_ledger)
    // ─────────────────────────────────────────────────────────────
    const ledgerEntry = {
      entryNumber,
      date: now,
      journal: "AB",
      journalName: "Journal des Abonnements & Dépôts",
      referencePiece: ref,
      label: `Encaissement abonnement mensuel - Fournisseur ${effectiveName} (${paymentMethod})`,
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

    const ledgerRef = await adminDb.collection("accounting_ledger").add(ledgerEntry);

    // ─────────────────────────────────────────────────────────────
    // 2. ÉCRITURE DANS LES TRANSACTIONS ADMIN (transactions)
    // ─────────────────────────────────────────────────────────────
    const adminTx = {
      type: "SUBSCRIPTION",
      amount: finalAmount,
      currency: currency || "USD",
      description: `Abonnement Fournisseur - ${effectiveName} (${paymentMethod})`,
      referenceId: ref,
      status: "COMPLETED",
      supplierId,
      supplierName: effectiveName,
      createdAt: now,
    };

    const adminTxRef = await adminDb.collection("transactions").add(adminTx);

    // ─────────────────────────────────────────────────────────────
    // 3. ÉCRITURE DANS LE LIVRE DE CAISSE FOURNISSEUR (supplier_transactions)
    // ─────────────────────────────────────────────────────────────
    const supplierTx = {
      type: "EXPENSE",
      category: "Abonnement",
      amount: finalAmount,
      currency: currency || "USD",
      description: `Cotisation mensuelle Abonnement Fournisseur Rayons ($${finalAmount})`,
      referenceId: ref,
      status: "COMPLETED",
      supplierId,
      createdAt: now,
    };

    const supplierTxRef = await adminDb.collection("supplier_transactions").add(supplierTx);

    // ─────────────────────────────────────────────────────────────
    // 4. MISE À JOUR DU COMPTE UTILISATEUR (users/{supplierId})
    // ─────────────────────────────────────────────────────────────
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 30); // 30 jours renouvelables

    const userDocRef = adminDb.collection("users").doc(supplierId);
    const userDocSnap = await userDocRef.get();
    const existingUserData = userDocSnap.exists ? userDocSnap.data() : {};

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
      depositAmount: finalAmount,
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
      // Données de base si pas de companyData
      if (supplierName && !existingUserData?.company) userUpdatePayload.company = supplierName.trim();
      if (supplierEmail && !existingUserData?.email) userUpdatePayload.email = supplierEmail.trim();
      if (!existingUserData?.rayon) userUpdatePayload.rayon = primaryRayon;
      if (!existingUserData?.assignedRayons) userUpdatePayload.assignedRayons = assigned;
      if (!existingUserData?.businessType) userUpdatePayload.businessType = businessType;
    }

    await userDocRef.set(userUpdatePayload, { merge: true });

    return NextResponse.json({
      success: true,
      referenceId: ref,
      entryNumber,
      ledgerId: ledgerRef.id,
      adminTxId: adminTxRef.id,
      supplierTxId: supplierTxRef.id,
      subscriptionEndDate: nextDueDate.toISOString(),
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
