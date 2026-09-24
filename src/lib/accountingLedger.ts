import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";

/**
 * Grand Livre & Journal Général des Écritures Comptables Rayons.net
 * Modèle économique : 
 * - L'Admin gagne : Abonnements mensuels Fournisseurs + Ventes directes de ses propres produits.
 * - Les Fournisseurs gagnent : Ventes nettes de leurs produits / loyers / nuitées d'hôtel.
 * - Module d'Ajustement de Caisse : avec motif obligatoire, libellé et impact sur le solde.
 */

export type JournalCode = "VT" | "AB" | "CS" | "BQ" | "AJ" | "OD";

export interface AccountingEntry {
  id?: string;
  entryNumber: string; // Ex: ECR-2026-00421
  date: any;
  journal: JournalCode;
  journalName: string; // Ex: "Journal des Ventes", "Abonnements", "Caisse", "Ajustements"
  referencePiece: string; // Ex: RAY-FAC-2026-0012, AJUST-009, RAY-DEP-001
  label: string; // Libellé formel
  debit: number;
  credit: number;
  balanceAfter?: number;
  currency: string;
  actorType: "ADMIN" | "SUPPLIER";
  supplierId?: string | null;
  supplierName?: string;
  adjustmentReason?: string; // Si journal === "AJ"
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
  "Autre régularisation"
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
    default: return "Journal Général";
  }
}

/**
 * Enregistrer un ajustement de caisse formel
 */
export async function recordCashAdjustment(params: {
  amount: number; // positif pour apport/entrée, négatif pour sortie/dépense
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
    amount,
    reason,
    label,
    referencePiece,
    currency = "USD",
    actorType,
    supplierId,
    supplierName,
    currentBalance
  } = params;

  if (amount === 0 || isNaN(amount)) {
    throw new Error("Le montant de l'ajustement doit être différent de zéro.");
  }
  if (!reason.trim()) {
    throw new Error("Le motif d'ajustement est obligatoire.");
  }
  if (!label.trim()) {
    throw new Error("Le libellé comptable de l'ajustement est obligatoire.");
  }

  const isPositive = amount > 0;
  const entryNumber = generateEntryNumber();
  const ref = referencePiece || `AJUST-${Math.floor(1000 + Math.random() * 9000)}`;
  const newBalance = currentBalance + amount;

  const entry: AccountingEntry = {
    entryNumber,
    date: serverTimestamp(),
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
    status: "VALIDATED"
  };

  await addDoc(collection(db, "accounting_ledger"), entry);

  // Enregistrer également dans les transactions pour compatibilité immédiate
  if (actorType === "ADMIN") {
    await addDoc(collection(db, "transactions"), {
      type: isPositive ? "OTHER_INCOME" : "EXPENSE",
      amount: Math.abs(amount),
      currency,
      description: entry.label,
      referenceId: ref,
      status: "COMPLETED",
      createdAt: serverTimestamp()
    });
  } else if (supplierId) {
    await addDoc(collection(db, "supplier_transactions"), {
      type: isPositive ? "INCOME" : "EXPENSE",
      category: `Ajustement: ${reason}`,
      amount: Math.abs(amount),
      currency,
      description: entry.label,
      referenceId: ref,
      status: "COMPLETED",
      supplierId,
      createdAt: serverTimestamp()
    });
  }

  return entry;
}

/**
 * Enregistrer un encaissement d'abonnement / dépôt attendu fournisseur
 */
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
    paymentMethod = "Mobile Money / Caisse",
    referencePiece,
    currency = "USD",
    currentBalance = 0
  } = params;

  const entryNumber = generateEntryNumber();
  const ref = referencePiece || `RAY-DEP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const balanceAfter = currentBalance + amount;

  const entry: AccountingEntry = {
    entryNumber,
    date: serverTimestamp(),
    journal: "AB",
    journalName: "Journal des Abonnements & Dépôts",
    referencePiece: ref,
    label: `Encaissement abonnement mensuel - Fournisseur ${supplierName} (${paymentMethod})`,
    debit: amount, // Entrée d'argent dans la caisse/banque de l'admin
    credit: 0,
    balanceAfter,
    currency,
    actorType: "ADMIN",
    supplierId,
    supplierName,
    category: "Abonnement Fournisseur",
    status: "VALIDATED"
  };

  // Sauvegarder dans le grand livre central
  await addDoc(collection(db, "accounting_ledger"), entry);

  // Mettre à jour les transactions admin
  await addDoc(collection(db, "transactions"), {
    type: "SUBSCRIPTION",
    amount,
    currency,
    description: entry.label,
    referenceId: ref,
    status: "COMPLETED",
    supplierId,
    createdAt: serverTimestamp()
  });

  // Mettre à jour l'échéance du fournisseur (+30 jours) et débloquer son compte
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 30);

  await updateDoc(doc(db, "users", supplierId), {
    subscriptionStatus: "ACTIVE",
    subscriptionEndDate: nextDueDate,
    isBlocked: false,
    lastDepositPaidAt: serverTimestamp(),
    lastDepositAmount: amount
  });

  return entry;
}

/**
 * Enregistrer un encaissement de loyer immobilier (module Immo)
 * Alimente le grand livre comptable ET les transactions du fournisseur.
 */
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
    supplierId,
    supplierName = "Partenaire Immo",
    tenantId,
    tenantName,
    propertyId,
    propertyName,
    unitName,
    amount,
    currency = "USD",
    reference,
    periodicity = "Mensuel",
    paymentMethod = "Caisse / Mobile Money"
  } = params;

  if (!amount || amount <= 0) {
    throw new Error("Le montant du loyer doit être supérieur à zéro.");
  }

  const entryNumber = generateEntryNumber();
  const year = new Date().getFullYear();
  const month = new Date().toLocaleString("fr-FR", { month: "long" });
  const ref = reference || `LOYER-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
  const unitLabel = unitName ? ` — Unité: ${unitName}` : "";
  const label = `Encaissement loyer [${periodicity}] — ${propertyName}${unitLabel} — Locataire: ${tenantName} (${month} ${year}) — ${paymentMethod}`;

  const entry: AccountingEntry = {
    entryNumber,
    date: serverTimestamp(),
    journal: "CS",
    journalName: "Journal de Caisse (Espèces)",
    referencePiece: ref,
    label,
    debit: amount,   // Entrée d'argent (encaissement loyer)
    credit: 0,
    currency,
    actorType: "SUPPLIER",
    supplierId,
    supplierName,
    category: "Revenu Locatif",
    status: "VALIDATED"
  };

  // 1. Grand livre central
  await addDoc(collection(db, "accounting_ledger"), entry);

  // 2. Transactions fournisseur (tableau Finance du fournisseur)
  await addDoc(collection(db, "supplier_transactions"), {
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
    createdAt: serverTimestamp()
  });

  return entry;
}
