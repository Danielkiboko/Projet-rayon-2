/**
 * Architecture Paiement par Carte Visa / Mastercard & Prélèvement Automatique (Rayons.net)
 *
 * Conformité & Sécurité (PCI-DSS) :
 * - Aucun numéro de carte bancaire (PAN / CVC) n'est jamais saisi, transmis ni stocké sur Rayons.net.
 * - Tout paiement par carte redirige vers un lien hébergé sécurisé (HTTPS uniquement : Stripe, Flutterwave,
 *   FlexPay, Maxicash, CinetPay, PayPal...), configuré dynamiquement depuis `/admin/finance`.
 * - Les renouvellements automatiques mensuels et confirmations d'achat sont validés côté serveur
 *   via `/api/payments/visa-webhook` (signature cryptographique + verrou d'idempotence).
 */

export interface VisaPaymentConfig {
  enabled: boolean;
  providerName: string;
  subscriptionUrl: string;
  checkoutUrl: string;
  autoBillingEnabled: boolean;
  webhookEndpoint: string;
}

export const VISA_CONFIG_CACHE_KEY = "payment:visa-config:v1";

export const DEFAULT_VISA_CONFIG: VisaPaymentConfig = {
  enabled: false,
  providerName: "Stripe",
  subscriptionUrl: "",
  checkoutUrl: "",
  autoBillingEnabled: true,
  webhookEndpoint: "https://rayons.net/api/payments/visa-webhook",
};

/**
 * Valide strictement qu'une URL de paiement est en HTTPS valide (bloque javascript:, data:, http://).
 */
export function sanitizeHttpsPaymentUrl(raw: unknown): string {
  const str = String(raw || "").trim();
  if (!str) return "";
  try {
    const parsed = new URL(str);
    if (parsed.protocol !== "https:") return "";
    if (!parsed.hostname || !parsed.hostname.includes(".")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Construit le lien de paiement Visa dynamique en injectant les métadonnées de réconciliation
 * (`client_reference_id`, `prefilled_email`, `amount`, `currency`) compatibles avec Stripe Payment Links
 * et les passerelles hébergées (Flutterwave, FlexPay, Maxicash, etc.).
 */
export function buildVisaPaymentUrl(
  baseUrl: string,
  params: {
    referenceId: string;
    email?: string;
    amount?: number;
    currency?: string;
  }
): string {
  const safeBase = sanitizeHttpsPaymentUrl(baseUrl);
  if (!safeBase) return "";

  try {
    const url = new URL(safeBase);
    if (params.referenceId) {
      url.searchParams.set("client_reference_id", params.referenceId.slice(0, 120));
    }
    if (params.email && params.email.includes("@")) {
      url.searchParams.set("prefilled_email", params.email.trim().toLowerCase());
    }
    // Ne pas écraser les montants fixes sur les Stripe Payment Links (qui gèrent leur propre prix)
    const isStripeLink = url.hostname.endsWith("stripe.com");
    if (!isStripeLink && params.amount && Number.isFinite(params.amount) && params.amount > 0) {
      url.searchParams.set("amount", String(Number(params.amount.toFixed(2))));
      if (params.currency) {
        url.searchParams.set("currency", params.currency.toUpperCase());
      }
    }
    return url.toString();
  } catch {
    return safeBase;
  }
}
