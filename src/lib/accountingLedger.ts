import { db } from "./firebase";
import {
  collection,
  serverTimestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

/**
 * Grand Livre & Journal Général des Écritures Comptables Rayons.net
 *
 * Toutes les opérations multi-collections utilisent un writeBatch() atomique
 * pour garantir la cohérence des données même en cas de coupure réseau.
 */

export type JournalCode = "VT" | "AB" | "CS" | "BQ" | "AJ" | "OD";

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
  supplierId?: string | null;
  supplierName?: string;
  adjustmentReason?: string;
  category?: string;
  status: "VALIDATED" | "DRAFT";
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
 * Centralise la logique pour éviter tout email hardcodé dans les composants.
 */
export function isOfficialAdminSupplier(supplierData: any): boolean {
  return (
    supplierData?.isOfficialAdminStore === true ||
    supplierData?.isAdminSupplier === true
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ajustement de caisse
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
    actorType,
    supplierId: supplierId || null,
    supplierName: supplierName || (actorType === "ADMIN" ? "Rayons Central Admin" : "Partenaire"),
    adjustmentReason: reason,
    category: isPositive ? "Ajustement Créditeur" : "Ajustement Débiteur",
    status: "VALIDATED",
  };

  const batch = writeBatch(db);
  batch.set(doc(collection(db, "accounting_ledger")), entry);

  if (actorType === "ADMIN") {
    batch.set(doc(collection(db, "transactions")), {
      type: isPositive ? "OTHER_INCOME" : "EXPENSE",
      amount: Math.abs(amount),
      currency,
      description: entry.label,
      referenceId: ref,
      status: "COMPLETED",
      createdAt: ts,
    });
  } else if (supplierId) {
    batch.set(doc(collection(db, "supplier_transactions")), {
      type: isPositive ? "INCOME" : "EXPENSE",
      category: `Ajustement: ${reason}`,
      amount: Math.abs(amount),
      currency,
      description: entry.label,
      referenceId: ref,
      status: "COMPLETED",
      supplierId,
      createdAt: ts,
    });
  }

  await batch.commit();
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Encaissement d'abonnement / dépôt attendu fournisseur
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
    supplierId, supplierName, amount,
    paymentMethod = "Mobile Money / Caisse",
    referencePiece, currency = "USD", currentBalance = 0,
  } = params;

  const entryNumber  = generateEntryNumber();
  const ref          = referencePiece || `RAY-DEP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const balanceAfter = currentBalance + amount;
  const ts           = serverTimestamp();

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 30);

  const entry: AccountingEntry = {
    entryNumber,
    date: ts,
    journal: "AB",
    journalName: "Journal des Abonnements & Dépôts",
    referencePiece: ref,
    label: `Encaissement abonnement mensuel - Fournisseur ${supplierName} (${paymentMethod})`,
    debit: amount,
    credit: 0,
    balanceAfter,
    currency,
    actorType: "ADMIN",
    supplierId,
    supplierName,
    category: "Abonnement Fournisseur",
    status: "VALIDATED",
  };

  const batch = writeBatch(db);

  // Grand livre central
  batch.set(doc(collection(db, "accounting_ledger")), entry);

  // Transaction admin (SUBSCRIPTION)
  batch.set(doc(collection(db, "transactions")), {
    type: "SUBSCRIPTION",
    amount,
    currency,
    description: entry.label,
    referenceId: ref,
    status: "COMPLETED",
    supplierId,
    supplierName,
    createdAt: ts,
  });

  // Cotisation côté fournisseur
  batch.set(doc(collection(db, "supplier_transactions")), {
    type: "EXPENSE",
    category: "Abonnement",
    amount,
    currency,
    description: `Cotisation mensuelle Abonnement Fournisseur Rayons ($${amount})`,
    referenceId: ref,
    status: "COMPLETED",
    supplierId,
    createdAt: ts,
  });

  // Déblocage compte fournisseur (+30 jours)
  batch.update(doc(db, "users", supplierId), {
    subscriptionStatus: "ACTIVE",
    subscriptionEndDate: nextDueDate,
    isBlocked: false,
    lastDepositPaidAt: ts,
    lastDepositAmount: amount,
  });

  await batch.commit();
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Encaissement de loyer immobilier
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
    supplierId, supplierName = "Partenaire Immo",
    tenantId, tenantName, propertyId, propertyName, unitName,
    amount, currency = "USD", reference, periodicity = "Mensuel",
    paymentMethod = "Caisse / Mobile Money",
  } = params;

  if (!amount || amount <= 0)
    throw new Error("Le montant du loyer doit être supérieur à zéro.");

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
    journalName: "Journal de Caisse (Espèces)",
    referencePiece: ref,
    label,
    debit: amount,
    credit: 0,
    currency,
    actorType: "SUPPLIER",
    supplierId,
    supplierName,
    category: "Revenu Locatif",
    status: "VALIDATED",
  };

  const batch = writeBatch(db);

  batch.set(doc(collection(db, "accounting_ledger")), entry);

  batch.set(doc(collection(db, "supplier_transactions")), {
    type: "INCOME",
    category: "Loyer",
    amount,
    currency,
    description: label,
    referenceId: ref,
    propertyId,
    tenantId,
    tenantName,
    status: "COMPLETED",
    supplierId,
    createdAt: ts,
  });

  await batch.commit();
  return entry;
}

