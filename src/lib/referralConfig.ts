/**
 * Configuration du programme de parrainage fournisseurs (utilisable client + serveur).
 *
 * - Le parrain gagne REFERRAL_COMMISSION_USD à CHAQUE paiement d'abonnement de son filleul, à vie.
 * - Le filleul obtient REFERRAL_DISCOUNT_USD de réduction sur son prochain mois (1er réabonnement).
 */

export const REFERRAL_COMMISSION_USD = 5;
export const REFERRAL_DISCOUNT_USD = 10;
export const REFERRAL_INVITES_PER_DAY = 20;

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://rayons.net").replace(/\/$/, "");
}

export function buildReferralLink(code: string, baseUrl?: string): string {
  const base = (baseUrl || getAppUrl()).replace(/\/$/, "");
  return `${base}/supplier/register?ref=${encodeURIComponent(code)}`;
}

export function normalizeReferralCode(code?: string | null): string {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Montant à payer pour le prochain abonnement, en tenant compte d'une réduction de parrainage en attente. */
export function computeDiscountedDeposit(baseAmount: number, pendingDiscount?: number | null) {
  const base = Number(baseAmount) || 0;
  const discount = Math.max(0, Math.min(Number(pendingDiscount) || 0, base));
  return { base, discount, total: base - discount };
}
