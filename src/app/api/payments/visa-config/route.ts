import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { cacheGetOrSet } from "@/lib/cache";
import {
  DEFAULT_VISA_CONFIG,
  sanitizeHttpsPaymentUrl,
  VISA_CONFIG_CACHE_KEY,
  VisaPaymentConfig,
} from "@/lib/visaPayments";

/**
 * GET /api/payments/visa-config
 * Retourne la configuration publique (non sensible) du paiement par Carte Visa / Mastercard
 * configurée dynamiquement dans `/admin/finance -> Paramètres & Taux`.
 * Protégé par cache hybride L1 RAM + Redis L2 (120s) + Edge CDN.
 */
export async function GET() {
  try {
    const { data, cacheSource } = await cacheGetOrSet<VisaPaymentConfig>(
      VISA_CONFIG_CACHE_KEY,
      120,
      async () => {
        const snap = await adminDb.collection("settings").doc("platform").get();
        const d = snap.exists ? snap.data() || {} : {};
        const subscriptionUrl = sanitizeHttpsPaymentUrl(d.visaSubscriptionUrl);
        const checkoutUrl = sanitizeHttpsPaymentUrl(d.visaCheckoutUrl);

        return {
          enabled: Boolean(d.visaEnabled) && Boolean(subscriptionUrl || checkoutUrl),
          providerName: String(d.visaProviderName || DEFAULT_VISA_CONFIG.providerName).slice(0, 40),
          subscriptionUrl,
          checkoutUrl,
          autoBillingEnabled: d.visaAutoBillingEnabled !== false,
          webhookEndpoint: DEFAULT_VISA_CONFIG.webhookEndpoint,
        };
      }
    );

    return NextResponse.json(
      { success: true, config: data },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
          "X-Rayons-Cache": cacheSource,
        },
      }
    );
  } catch (error: any) {
    console.error("[GET VISA CONFIG ERROR]:", error);
    return NextResponse.json(
      { success: true, config: DEFAULT_VISA_CONFIG },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
