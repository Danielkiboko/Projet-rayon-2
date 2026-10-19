/**
 * Programme de parrainage fournisseurs — logique serveur (Firebase Admin SDK uniquement).
 *
 * Collections :
 *  - referral_codes/{CODE}              → { ownerId, createdAt }
 *  - referral_invites/{id}              → { referrerId, email, status: SENT | REGISTERED, sentAt }
 *  - referrals/{filleulId}              → relation parrain ↔ filleul + compteurs
 *  - referral_commissions/{paymentKey}  → 1 doc par paiement (idempotent), status PENDING | PAID
 *
 * Champs sur users :
 *  - parrain : referralCode, referralCount, referralBalance, referralTotalEarned, referralPaidTotal
 *  - filleul : referredBy, referralCodeUsed, referredAt, referralDiscountPending
 */
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { sendEmail } from "./email";
import {
  REFERRAL_COMMISSION_USD,
  REFERRAL_DISCOUNT_USD,
  normalizeReferralCode,
} from "./referralConfig";
import { commissionEmail, newReferralEmail, payoutEmail } from "./referralEmails";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  return `RAY-${s}`;
}

const displayNameOf = (d: any, fallback = "Partenaire") =>
  (d?.company || d?.displayName || d?.name || d?.email || fallback).toString();

const safeDocId = (s: string) => String(s).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 140);

function isExcludedAccount(d: any) {
  const role = String(d?.role || "").toUpperCase();
  return (
    d?.isOfficialAdminStore === true ||
    d?.isAdminSupplier === true ||
    ["ADMIN", "SUPER_ADMIN", "SUPERADMIN", "SUB_ADMIN"].includes(role)
  );
}

/** Notification in-app (cloche du dashboard fournisseur). */
export async function pushSupplierNotification(supplierId: string, title: string, message: string, link = "/supplier/referrals") {
  try {
    await adminDb.collection("inapp_notifications").add({
      userId: supplierId,
      clientId: supplierId,
      supplierId,
      type: "system",
      title,
      message,
      link,
      read: false,
      time: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("[REFERRAL] in-app notification failed:", e);
  }
}

async function safeSendEmail(to: string | undefined, mail: { subject: string; html: string }) {
  if (!to) return;
  try {
    await sendEmail({ to, subject: mail.subject, html: mail.html });
  } catch (e) {
    console.warn("[REFERRAL] email failed:", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Code de parrainage
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureReferralCode(userId: string): Promise<string> {
  const userRef = adminDb.collection("users").doc(userId);
  const snap = await userRef.get();
  const existing = snap.data()?.referralCode;
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode();
    const codeRef = adminDb.collection("referral_codes").doc(code);
    const created = await adminDb.runTransaction(async (tx: any) => {
      const [codeSnap, uSnap] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);
      if (uSnap.data()?.referralCode) return uSnap.data().referralCode as string;
      if (codeSnap.exists) return null;
      tx.set(codeRef, { ownerId: userId, createdAt: FieldValue.serverTimestamp() });
      tx.set(userRef, { referralCode: code }, { merge: true });
      return code;
    });
    if (created) return created;
  }
  throw new Error("Impossible de générer un code de parrainage unique.");
}

export async function resolveReferralCode(rawCode: string) {
  const code = normalizeReferralCode(rawCode);
  if (!code || code.length < 4 || code.length > 40) return null;
  const codeSnap = await adminDb.collection("referral_codes").doc(code).get();
  if (!codeSnap.exists) return null;
  const ownerId = codeSnap.data()?.ownerId as string;
  const ownerSnap = await adminDb.collection("users").doc(ownerId).get();
  if (!ownerSnap.exists) return null;
  const owner = ownerSnap.data() || {};
  return { code, ownerId, ownerName: displayNameOf(owner), ownerEmail: owner.email as string | undefined };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rattachement filleul → parrain (une seule fois, à vie)
// ─────────────────────────────────────────────────────────────────────────────

export async function attachReferral(params: {
  filleulId: string;
  code: string;
  filleulName?: string;
  filleulEmail?: string;
}): Promise<{ attached: boolean; reason?: string; referrerId?: string }> {
  const { filleulId } = params;
  const resolved = await resolveReferralCode(params.code);
  if (!resolved) return { attached: false, reason: "INVALID_CODE" };
  if (resolved.ownerId === filleulId) return { attached: false, reason: "SELF_REFERRAL" };

  const filleulRef = adminDb.collection("users").doc(filleulId);
  const referrerRef = adminDb.collection("users").doc(resolved.ownerId);
  const relationRef = adminDb.collection("referrals").doc(filleulId);
  const filleulEmail = (params.filleulEmail || "").toLowerCase().trim();

  const result = await adminDb.runTransaction(async (tx: any) => {
    const [fSnap, relSnap] = await Promise.all([tx.get(filleulRef), tx.get(relationRef)]);
    const f = fSnap.exists ? fSnap.data() : {};
    if (f?.referredBy || relSnap.exists) return { attached: false, reason: "ALREADY_REFERRED" };
    if (isExcludedAccount(f)) return { attached: false, reason: "EXCLUDED_ACCOUNT" };
    // Un parrain ne peut pas devenir le filleul de son propre filleul
    if (f?.referralCount > 0) {
      const reverse = await tx.get(adminDb.collection("referrals").doc(resolved.ownerId));
      if (reverse.exists && reverse.data()?.referrerId === filleulId) return { attached: false, reason: "CIRCULAR" };
    }

    const filleulName = params.filleulName || displayNameOf(f, filleulEmail || "Nouveau partenaire");

    tx.set(filleulRef, {
      referredBy: resolved.ownerId,
      referralCodeUsed: resolved.code,
      referredAt: FieldValue.serverTimestamp(),
      referralDiscountPending: REFERRAL_DISCOUNT_USD,
    }, { merge: true });

    tx.set(relationRef, {
      filleulId,
      filleulName,
      filleulEmail: filleulEmail || f?.email || null,
      referrerId: resolved.ownerId,
      referrerName: resolved.ownerName,
      code: resolved.code,
      totalCommissions: 0,
      paymentsCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(referrerRef, { referralCount: FieldValue.increment(1) }, { merge: true });
    return { attached: true, filleulName };
  });

  if (!result.attached) return { attached: false, reason: result.reason };

  // Marquer les invitations correspondantes comme inscrites
  if (filleulEmail) {
    try {
      const invites = await adminDb.collection("referral_invites")
        .where("referrerId", "==", resolved.ownerId)
        .where("email", "==", filleulEmail)
        .get();
      const batch = adminDb.batch();
      invites.forEach((d: any) => batch.update(d.ref, {
        status: "REGISTERED", filleulId, registeredAt: FieldValue.serverTimestamp(),
      }));
      if (!invites.empty) await batch.commit();
    } catch (e) {
      console.warn("[REFERRAL] invite update failed:", e);
    }
  }

  const filleulName = (result as any).filleulName as string;
  await Promise.all([
    safeSendEmail(resolved.ownerEmail, newReferralEmail({ referrerName: resolved.ownerName, filleulName })),
    pushSupplierNotification(
      resolved.ownerId,
      "🎉 Nouveau filleul inscrit",
      `${filleulName} s'est abonné avec votre code ${resolved.code}. Vous gagnez ${REFERRAL_COMMISSION_USD} USD à chacun de ses paiements d'abonnement.`
    ),
  ]);

  return { attached: true, referrerId: resolved.ownerId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission : 5 USD par paiement d'abonnement du filleul (idempotent)
// ─────────────────────────────────────────────────────────────────────────────

export async function creditReferralCommission(params: {
  filleulId: string;
  paymentRef: string;
  amountPaid?: number;
}): Promise<{ credited: boolean; reason?: string }> {
  const { filleulId, paymentRef } = params;
  if (!filleulId || !paymentRef) return { credited: false, reason: "MISSING_PARAMS" };

  const relationRef = adminDb.collection("referrals").doc(filleulId);
  const commissionRef = adminDb.collection("referral_commissions").doc(safeDocId(`${filleulId}_${paymentRef}`));

  const outcome = await adminDb.runTransaction(async (tx: any) => {
    const [relSnap, comSnap] = await Promise.all([tx.get(relationRef), tx.get(commissionRef)]);
    if (!relSnap.exists) return { credited: false, reason: "NO_REFERRER" };
    if (comSnap.exists) return { credited: false, reason: "ALREADY_CREDITED" };

    const rel = relSnap.data();
    const referrerRef = adminDb.collection("users").doc(rel.referrerId);
    const refSnap = await tx.get(referrerRef);
    if (!refSnap.exists) return { credited: false, reason: "REFERRER_NOT_FOUND" };
    const referrer = refSnap.data();

    const isSignup = (rel.paymentsCount || 0) === 0;
    const amount = REFERRAL_COMMISSION_USD;

    tx.set(commissionRef, {
      referrerId: rel.referrerId,
      referrerName: rel.referrerName || displayNameOf(referrer),
      filleulId,
      filleulName: rel.filleulName || "Filleul",
      paymentRef,
      amountPaidByFilleul: Number(params.amountPaid) || null,
      amount,
      currency: "USD",
      kind: isSignup ? "SIGNUP" : "RENEWAL",
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(relationRef, {
      totalCommissions: FieldValue.increment(amount),
      paymentsCount: FieldValue.increment(1),
      lastPaymentAt: FieldValue.serverTimestamp(),
    });

    tx.set(referrerRef, {
      referralBalance: FieldValue.increment(amount),
      referralTotalEarned: FieldValue.increment(amount),
    }, { merge: true });

    return {
      credited: true,
      isSignup,
      amount,
      referrerId: rel.referrerId as string,
      referrerName: displayNameOf(referrer),
      referrerEmail: referrer.email as string | undefined,
      newBalance: (Number(referrer.referralBalance) || 0) + amount,
      filleulName: (rel.filleulName || "Votre filleul") as string,
    };
  });

  if (!outcome.credited) return { credited: false, reason: outcome.reason };

  const o = outcome as any;
  await Promise.all([
    safeSendEmail(o.referrerEmail, commissionEmail({
      referrerName: o.referrerName, filleulName: o.filleulName, amount: o.amount, balance: o.newBalance, isSignup: o.isSignup,
    })),
    pushSupplierNotification(
      o.referrerId,
      `💰 +${o.amount} USD de commission`,
      `${o.filleulName} vient de ${o.isSignup ? "souscrire" : "renouveler"} son abonnement. Solde parrainage : ${o.newBalance.toFixed(2)} USD.`
    ),
  ]);

  return { credited: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Versement des commissions par l'admin
// ─────────────────────────────────────────────────────────────────────────────

export async function payoutReferrerCommissions(params: {
  referrerId: string;
  adminUid: string;
  paymentMethod?: string;
}): Promise<{ paidAmount: number; count: number }> {
  const { referrerId, adminUid, paymentMethod = "Caisse / Mobile Money" } = params;
  const referrerRef = adminDb.collection("users").doc(referrerId);
  const pendingQuery = adminDb.collection("referral_commissions")
    .where("referrerId", "==", referrerId)
    .where("status", "==", "PENDING");

  const ref = `COM-PAR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const result = await adminDb.runTransaction(async (tx: any) => {
    const [pendingSnap, refSnap] = await Promise.all([tx.get(pendingQuery), tx.get(referrerRef)]);
    if (pendingSnap.empty) return { paidAmount: 0, count: 0, referrer: refSnap.data() };

    let total = 0;
    pendingSnap.forEach((d: any) => {
      total += Number(d.data().amount) || 0;
      tx.update(d.ref, { status: "PAID", paidAt: FieldValue.serverTimestamp(), paidBy: adminUid, payoutRef: ref });
    });

    const referrer = refSnap.data() || {};
    const name = displayNameOf(referrer);
    const now = FieldValue.serverTimestamp();

    tx.set(referrerRef, {
      referralBalance: FieldValue.increment(-total),
      referralPaidTotal: FieldValue.increment(total),
    }, { merge: true });

    // Sortie de caisse côté admin
    tx.set(adminDb.collection("transactions").doc(), {
      type: "EXPENSE",
      category: "Commission parrainage",
      amount: total,
      currency: "USD",
      description: `Versement commissions parrainage - ${name} (${pendingSnap.size} paiement(s))`,
      referenceId: ref,
      status: "COMPLETED",
      supplierId: referrerId,
      supplierName: name,
      createdAt: now,
    });

    tx.set(adminDb.collection("accounting_ledger").doc(), {
      entryNumber: `ECR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      date: now,
      journal: "OD",
      journalName: "Journal des Commissions de Parrainage",
      referencePiece: ref,
      label: `Versement commissions parrainage - ${name} (${paymentMethod})`,
      debit: 0,
      credit: total,
      balanceAfter: 0,
      currency: "USD",
      actorType: "ADMIN",
      supplierId: referrerId,
      supplierName: name,
      category: "Commission parrainage",
      status: "VALIDATED",
    });

    // Entrée dans le livre de caisse du parrain
    tx.set(adminDb.collection("supplier_transactions").doc(), {
      type: "INCOME",
      category: "Commission parrainage",
      amount: total,
      currency: "USD",
      description: `Commissions de parrainage versées par Rayons.net (${pendingSnap.size} paiement(s))`,
      referenceId: ref,
      status: "COMPLETED",
      supplierId: referrerId,
      createdAt: now,
    });

    return { paidAmount: total, count: pendingSnap.size, referrer };
  });

  if (result.paidAmount > 0) {
    const name = displayNameOf(result.referrer);
    await Promise.all([
      safeSendEmail(result.referrer?.email, payoutEmail({ referrerName: name, amount: result.paidAmount })),
      pushSupplierNotification(
        referrerId,
        "💸 Commissions versées",
        `Rayons.net vous a versé ${result.paidAmount.toFixed(2)} USD de commissions de parrainage.`
      ),
    ]);
  }

  return { paidAmount: result.paidAmount, count: result.count };
}
