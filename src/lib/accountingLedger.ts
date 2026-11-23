import { db, auth } from "./firebase";
import {
  collection,
  serverTimestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

/**
 * Grand Livre & Journal Général des Écritures Comptables Rayons.net
 *
 * ARCHITECTURE CLOISONNÉE (3 périmètres étanches) :
 * 1. `PLATFORM_ADMIN` (`accounting_ledger` + `transactions`) :
 *    - Exclusivement la comptabilité de la plateforme Rayons.net (abonnements, commissions, dépenses internes).
 *    - ÉCRITURE SERVEUR UNIQUEMENT via `/api/admin/finance/entries` et `/api/admin/executive-overview` (immuable & audité).
 * 2. `SUPPLIER_PRIVATE` (`supplier_ledger` + `supplier_transactions`) :
 *    - Exclusivement la comptabilité privée de chaque fournisseur / agence immo (loyers, hôtels, ventes, ajustements).
 *    - Jamais mélangé dans le Grand Livre central Admin (`accounting_ledger`).
 * 3. `ADMIN_IMMO` (optionnel, séparé) :
 *    - Réservé à une éventuelle agence immobilière officielle exploitée par l'Admin, isolé de la trésorerie SaaS.
 */

export type JournalCode = "VT" | "AB" | "CS" | "BQ" | "AJ" | "OD";
export type AccountingScope = "PLATFORM_ADMIN" | "SUPPLIER_PRIVATE" | "ADMIN_IMMO";

export interface AccountingEntry {
  id?: string;
  entryNumber: string;
  date: any;
  journal: JournalCode;
  journalName: string;
  referencePiece: string;
  label: string;
  debit: number;
  credit: number;
  balanceAfter?: number;
  currency: string;
  actorType: "ADMIN" | "SUPPLIER";
  accountingScope?: AccountingScope;
  supplierId?: string | null;
  supplierName?: string;
  adjustmentReason?: string;
  category?: string;
  status: "VALIDATED" | "DRAFT";
  recordedBy?: string;
}

export const ADJUSTMENT_REASONS = [
  "Écart physique d'inventaire",
  "Régularisation de taux de change",
  "Frais bancaires / télécom imprévus",
  "Apport exceptionnel de fonds",
  "Prélèvement personnel de caisse",
  "Remboursement litige client",
  "Autre régularisation",
] as const;

export function generateEntryNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `ECR-${year}-${rand}`;
}

export function getJournalName(code: JournalCode): string {
  switch (code) {
    case "VT": return "Journal des Ventes";
    case "AB": return "Journal des Abonnements & Dépôts";
    case "CS": return "Journal de Caisse (Espèces)";
    case "BQ": return "Journal de Banque / Mobile Money";
    case "AJ": return "Journal des Ajustements de Caisse";
    case "OD": return "Opérations Diverses";
    default:   return "Journal Général";
  }
}

/**
 * Détermine si un fournisseur est une boutique officielle Admin (exempté d'abonnement).
 */
export function isOfficialAdminSupplier(supplierData: any): boolean {
  return (
    supplierData?.isOfficialAdminStore === true ||
    supplierData?.isAdminSupplier === true
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ajustement de caisse (Admin -> API serveur sécurisée | Fournisseur -> supplier_ledger privé)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordCashAdjustment(params: {
  amount: number;
  reason: string;
  label: string;
  referencePiece?: string;
  currency?: string;
  actorType: "ADMIN" | "SUPPLIER";
  supplierId?: string;
  supplierName?: string;
  currentBalance: number;
}): Promise<AccountingEntry> {
  const {
    amount, reason, label, referencePiece,
    currency = "USD", actorType, supplierId, supplierName, currentBalance,
  } = params;

  if (amount === 0 || isNaN(amount))
    throw new Error("Le montant de l'ajustement doit être différent de zéro.");
  if (!reason.trim())
    throw new Error("Le motif d'ajustement est obligatoire.");
  if (!label.trim())
    throw new Error("Le libellé comptable de l'ajustement est obligatoire.");

  // Côté ADMIN : passage obligatoire par la route serveur sécurisée & auditée
  if (actorType === "ADMIN") {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }
    const res = await fetch("/api/admin/finance/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kind: "ADJUSTMENT",
        amount,
        reason,
        label,
        referencePiece,
        currency,
        accountingScope: "PLATFORM_ADMIN",
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Erreur lors de l'enregistrement sécurisé de l'ajustement.");
    }
    const isPositive = amount > 0;
    return {
      entryNumber: json.entryNumber || generateEntryNumber(),
      date: new Date(),
      journal: "AJ",
      journalName: "Journal des Ajustements de Caisse",
      referencePiece: json.referencePiece || referencePiece || "",
      label: `Ajustement de caisse [${reason}] — ${label}`,
      debit: isPositive ? Math.abs(amount) : 0,
      credit: !isPositive ? Math.abs(amount) : 0,
      balanceAfter: currentBalance + amount,
      currency,
      actorType: "ADMIN",
      accountingScope: "PLATFORM_ADMIN",
      supplierId: null,
      supplierName: "Rayons.net Plateforme",
      adjustmentReason: reason,
      category: isPositive ? "Ajustement Créditeur" : "Ajustement Débiteur",
      status: "VALIDATED",
    };
  }

  // Côté FOURNISSEUR : strictement isolé dans `supplier_ledger` + `supplier_transactions` (JAMAIS `accounting_ledger`)
  if (!supplierId) {
    throw new Error("Identifiant fournisseur manquant pour l'ajustement de caisse privé.");
  }

  const isPositive  = amount > 0;
  const entryNumber = generateEntryNumber();
  const ref         = referencePiece || `AJUST-${Math.floor(1000 + Math.random() * 9000)}`;
  const newBalance  = currentBalance + amount;
  const ts          = serverTimestamp();

  const entry: AccountingEntry = {
    entryNumber,
    date: ts,
    journal: "AJ",
    journalName: "Journal des Ajustements de Caisse",
    referencePiece: ref,
    label: `Ajustement de caisse [${reason}] - ${label}`,
    debit: isPositive ? Math.abs(amount) : 0,
    credit: !isPositive ? Math.abs(amount) : 0,
    balanceAfter: newBalance,
    currency,
    actorType: "SUPPLIER",
    accountingScope: "SUPPLIER_PRIVATE",
    supplierId,
    supplierName: supplierName || "Partenaire",
    adjustmentReason: reason,
    category: isPositive ? "Ajustement Créditeur" : "Ajustement Débiteur",
    status: "VALIDATED",
  };

  const batch = writeBatch(db);
  batch.set(doc(collection(db, "supplier_ledger")), entry);
  batch.set(doc(collection(db, "supplier_transactions")), {
    type: isPositive ? "INCOME" : "EXPENSE",
    category: `Ajustement: ${reason}`,
    amount: Math.abs(amount),
    currency,
    description: entry.label,
    referenceId: ref,
    status: "COMPLETED",
    supplierId,
    accountingScope: "SUPPLIER_PRIVATE",
    createdAt: ts,
  });

  await batch.commit();
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Encaissement d'abonnement fournisseur (STRICTEMENT via API serveur sécurisée)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordSubscriptionDeposit(params: {
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod?: string;
  referencePiece?: string;
  currency?: string;
  currentBalance?: number;
}): Promise<AccountingEntry> {
  const {
    supplierId,
    supplierName,
    amount,
    paymentMethod = "Mobile Money / Caisse Centrale",
    referencePiece,
    currency = "USD",
    currentBalance = 0,
  } = params;

  const cleanRef = String(referencePiece || "").trim();
  if (!cleanRef) {
    throw new Error("Une référence de preuve de paiement (Mobile Money ou Reçu Caisse) est obligatoire.");
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentification requise pour enregistrer un encaissement d'abonnement.");
  }

  const res = await fetch("/api/admin/executive-overview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "RECORD_SUBSCRIPTION_PAYMENT",
      supplierId,
      amountPaid: amount,
      paymentMethod,
      referencePiece: cleanRef,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Erreur lors de l'encaissement sécurisé de l'abonnement.");
  }

  return {
    entryNumber: json.entryNumber || generateEntryNumber(),
    date: new Date(),
    journal: "AB",
    journalName: "Journal des Abonnements & Dépôts",
    referencePiece: json.referencePiece || cleanRef,
    label: `Encaissement abonnement mensuel — ${supplierName} (${paymentMethod})`,
    debit: amount,
    credit: 0,
    balanceAfter: currentBalance + amount,
    currency,
    actorType: "ADMIN",
    accountingScope: "PLATFORM_ADMIN",
    supplierId,
    supplierName,
    category: "Abonnement Fournisseur",
    status: "VALIDATED",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Encaissement de loyer immobilier (STRICTEMENT PRIVÉ au fournisseur Immo -> `supplier_ledger`)
//    Ne touche JAMAIS au Grand Livre central de l'Admin (`accounting_ledger`) !
// ─────────────────────────────────────────────────────────────────────────────

export async function recordRentPayment(params: {
  supplierId: string;
  supplierName?: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitName?: string;
  amount: number;
  currency?: string;
  reference?: string;
  periodicity?: string;
  paymentMethod?: string;
}): Promise<AccountingEntry> {
  const {
    supplierId, supplierName = "Agence Immobilière",
    tenantId, tenantName, propertyId, propertyName, unitName,
    amount, currency = "USD", reference, periodicity = "Mensuel",
    paymentMethod = "Caisse / Mobile Money",
  } = params;

  if (!amount || amount <= 0)
    throw new Error("Le montant du loyer doit être supérieur à zéro.");
  if (!supplierId)
    throw new Error("Identifiant agence immobilière manquant.");

  const entryNumber = generateEntryNumber();
  const year        = new Date().getFullYear();
  const month       = new Date().toLocaleString("fr-FR", { month: "long" });
  const ref         = reference || `LOYER-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
  const unitLabel   = unitName ? ` — Unité: ${unitName}` : "";
  const label       = `Encaissement loyer [${periodicity}] — ${propertyName}${unitLabel} — Locataire: ${tenantName} (${month} ${year}) — ${paymentMethod}`;
  const ts          = serverTimestamp();

  const entry: AccountingEntry = {
    entryNumber,
    date: ts,
    journal: "CS",
    journalName: "Journal Locatif Privé (Fournisseur Immo)",
    referencePiece: ref,
    label,
    debit: amount,
    credit: 0,
    currency,
    actorType: "SUPPLIER",
    accountingScope: "SUPPLIER_PRIVATE",
    supplierId,
    supplierName,
    category: "Revenu Locatif",
    status: "VALIDATED",
  };

  const batch = writeBatch(db);

  // Cloisonnement strict : écriture uniquement dans le livre privé du fournisseur (`supplier_ledger` + `supplier_transactions`)
  batch.set(doc(collection(db, "supplier_ledger")), entry);

  batch.set(doc(collection(db, "supplier_transactions")), {
    type: "INCOME",
    category: "Loyer",
    branch: "habitation",
    amount,
    currency,
    description: label,
    referenceId: ref,
    propertyId,
    tenantId,
    tenantName,
    status: "COMPLETED",
    supplierId,
    accountingScope: "SUPPLIER_PRIVATE",
    createdAt: ts,
  });

  await batch.commit();
  return entry;
}
