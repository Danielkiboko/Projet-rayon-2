import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { cacheDel } from "@/lib/cache";
import { creditReferralCommission } from "@/lib/referrals";
import { dispatchAccountNotification } from "@/lib/pushNotifications";

/**
 * POST /api/payments/visa-webhook
 * Webhook serveur sécurisé pour les paiements par Carte Visa / Mastercard & prélèvements automatiques mensuels.
 *
 * Compatibilité multi-passerelles :
 * 1. Stripe (`stripe-signature` vérifié en HMAC-SHA256 avec `STRIPE_WEBHOOK_SECRET`)
 *    - `checkout.session.completed` (1er paiement abonnement ou commande client)
 *    - `invoice.paid` (prélèvement mensuel automatique récurrent)
 * 2. Passerelles Afrique / Génériques (Flutterwave, FlexPay, Maxicash, CinetPay...)
 *    - En-tête `x-webhook-secret` ou `verif-hash` vérifié en temps constant avec `VISA_WEBHOOK_SECRET`
 *
 * Garanties d'architecture Rayons.net :
 * - Fail-closed : refuse toute requête non signée si aucun secret n'est configuré en prod.
 * - Idempotence absolue via `subscription_payments/visa_{eventId}` dans une transaction Firestore atomique.
 * - Cloisonnement comptable strict (`accountingScope: "PLATFORM_ADMIN"` sur `accounting_ledger` + `transactions`).
 * - Trace immuable dans `audit_logs` + crédit automatique de la commission partenaire ($5).
 */

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyStripeSignature(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  // Anti-replay : tolérance de 5 minutes
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  return timingSafeEqualStr(expected, v1);
}

interface NormalizedVisaEvent {
  eventId: string;
  provider: string;
  kind: "SUBSCRIPTION" | "ORDER" | "IGNORE";
  referenceId: string;
  supplierId?: string;
  orderId?: string;
  customerEmail?: string;
  amountUSD: number;
  isRecurringRenewal: boolean;
}

function normalizeWebhookPayload(payload: any, providerHint: string): NormalizedVisaEvent | null {
  if (!payload || typeof payload !== "object") return null;

  // ── Format Stripe (`checkout.session.completed` / `invoice.paid`) ──
  if (typeof payload.type === "string" && payload.data?.object) {
    const obj = payload.data.object;
    const eventId = String(payload.id || obj.id || "");
    if (!eventId) return null;

    if (payload.type === "checkout.session.completed") {
      if (obj.payment_status && obj.payment_status !== "paid") {
        return { eventId, provider: "Stripe", kind: "IGNORE", referenceId: eventId, amountUSD: 0, isRecurringRenewal: false };
      }
      const clientRef = String(obj.client_reference_id || obj.metadata?.referenceId || "").trim();
      const amountUSD = Number(obj.amount_total || 0) / 100;
      const customerEmail = String(obj.customer_details?.email || obj.customer_email || "").trim().toLowerCase();

      if (clientRef.startsWith("ord_") || obj.metadata?.orderId) {
        return {
          eventId,
          provider: "Stripe",
          kind: "ORDER",
          referenceId: String(obj.payment_intent || obj.id || eventId),
          orderId: obj.metadata?.orderId || clientRef.replace(/^ord_/, ""),
          customerEmail,
          amountUSD,
          isRecurringRenewal: false,
        };
      }

      return {
        eventId,
        provider: "Stripe",
        kind: "SUBSCRIPTION",
        referenceId: String(obj.subscription || obj.payment_intent || obj.id || eventId),
        supplierId: obj.metadata?.supplierId || (clientRef.startsWith("sub_") ? clientRef.replace(/^sub_/, "") : undefined),
        customerEmail,
        amountUSD: amountUSD > 0 ? amountUSD : 50,
        isRecurringRenewal: obj.mode === "subscription",
      };
    }

    if (payload.type === "invoice.paid") {
      const amountUSD = Number(obj.amount_paid || 0) / 100;
      const customerEmail = String(obj.customer_email || "").trim().toLowerCase();
      return {
        eventId,
        provider: "Stripe",
        kind: "SUBSCRIPTION",
        referenceId: String(obj.number || obj.id || eventId),
        supplierId: obj.subscription_details?.metadata?.supplierId || obj.metadata?.supplierId,
        customerEmail,
        amountUSD: amountUSD > 0 ? amountUSD : 50,
        isRecurringRenewal: true,
      };
    }

    return { eventId, provider: "Stripe", kind: "IGNORE", referenceId: eventId, amountUSD: 0, isRecurringRenewal: false };
  }

  // ── Format Générique / Passerelles Afrique (Flutterwave, FlexPay, Maxicash, CinetPay) ──
  const statusUpper = String(payload.status || payload.data?.status || "").toUpperCase();
  if (statusUpper && !["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(statusUpper)) {
    return {
      eventId: String(payload.eventId || payload.reference || Date.now()),
      provider: providerHint,
      kind: "IGNORE",
      referenceId: String(payload.reference || ""),
      amountUSD: 0,
      isRecurringRenewal: false,
    };
  }

  const ref = String(
    payload.referenceId ||
      payload.reference ||
      payload.tx_ref ||
      payload.data?.tx_ref ||
      payload.transaction_id ||
      ""
  ).trim();
  if (!ref) return null;

  const clientRef = String(payload.client_reference_id || payload.meta?.referenceId || ref).trim();
  const amountUSD = Number(payload.amount || payload.data?.amount || 0);
  const customerEmail = String(payload.email || payload.data?.customer?.email || "").trim().toLowerCase();
  const isOrder = payload.kind === "ORDER" || clientRef.startsWith("ord_") || Boolean(payload.orderId);

  return {
    eventId: String(payload.eventId || payload.id || ref),
    provider: String(payload.provider || providerHint),
    kind: isOrder ? "ORDER" : "SUBSCRIPTION",
    referenceId: ref,
    supplierId: payload.supplierId || (clientRef.startsWith("sub_") ? clientRef.replace(/^sub_/, "") : undefined),
    orderId: payload.orderId || (clientRef.startsWith("ord_") ? clientRef.replace(/^ord_/, "") : undefined),
    customerEmail,
    amountUSD: amountUSD > 0 ? amountUSD : 50,
    isRecurringRenewal: Boolean(payload.isRecurringRenewal),
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const stripeSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    const genericSecret = (process.env.VISA_WEBHOOK_SECRET || "").trim();

    if (!stripeSecret && !genericSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Webhook Visa non encore armé : configurez STRIPE_WEBHOOK_SECRET ou VISA_WEBHOOK_SECRET dans les variables d'environnement.",
        },
        { status: 503 }
      );
    }

    const stripeSig = req.headers.get("stripe-signature");
    const genericSig =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("verif-hash") ||
      req.headers.get("x-rayons-webhook-secret") ||
      "";

    let verifiedProvider = "";
    if (stripeSecret && stripeSig && verifyStripeSignature(rawBody, stripeSig, stripeSecret)) {
      verifiedProvider = "Stripe";
    } else if (genericSecret && genericSig && timingSafeEqualStr(genericSig.trim(), genericSecret)) {
      verifiedProvider = "Visa Gateway";
    } else {
      return NextResponse.json({ success: false, error: "Signature webhook invalide." }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Payload JSON invalide." }, { status: 400 });
    }

    const event = normalizeWebhookPayload(payload, verifiedProvider);
    if (!event) {
      return NextResponse.json({ success: false, error: "Événement webhook non exploitable." }, { status: 400 });
    }
    if (event.kind === "IGNORE") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const lockId = `visa_${event.eventId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 90)}`;
    const lockRef = adminDb.collection("subscription_payments").doc(lockId);

    // ── CAS 1 : COMMANDE CLIENT PAYÉE PAR CARTE VISA ──
    if (event.kind === "ORDER" && event.orderId) {
      const orderRef = adminDb.collection("orders").doc(event.orderId);
      let duplicate = false;

      await adminDb.runTransaction(async (tx: any) => {
        const [lockSnap, orderSnap] = await Promise.all([tx.get(lockRef), tx.get(orderRef)]);
        if (lockSnap.exists) {
          duplicate = true;
          return;
        }
        if (!orderSnap.exists) {
          throw new Error("ORDER_NOT_FOUND");
        }

        const now = FieldValue.serverTimestamp();
        tx.set(lockRef, {
          kind: "ORDER",
          orderId: event.orderId,
          provider: event.provider,
          referencePiece: event.referenceId,
          amount: event.amountUSD,
          createdAt: now,
        });

        tx.set(
          orderRef,
          {
            paymentStatus: "PAID",
            paymentMethod: "CARD_VISA",
            paymentProvider: event.provider,
            paymentReference: event.referenceId,
            paidAmount: event.amountUSD,
            remainingBalance: 0,
            paidAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        tx.set(adminDb.collection("audit_logs").doc(), {
          action: "VISA_WEBHOOK_ORDER_PAID",
          category: "FINANCE",
          orderId: event.orderId,
          provider: event.provider,
          referencePiece: event.referenceId,
          amount: event.amountUSD,
          createdAt: now,
        });
      });

      return NextResponse.json({ success: true, duplicate, kind: "ORDER", orderId: event.orderId });
    }

    // ── CAS 2 : ABONNEMENT FOURNISSEUR (1ER PAIEMENT OU PRÉLÈVEMENT AUTOMATIQUE MENSUEL) ──
    let resolvedSupplierId = event.supplierId || "";
    if (!resolvedSupplierId && event.customerEmail) {
      const matchSnap = await adminDb
        .collection("users")
        .where("email", "==", event.customerEmail)
        .limit(1)
        .get();
      if (!matchSnap.empty) {
        resolvedSupplierId = matchSnap.docs[0].id;
      }
    }

    if (!resolvedSupplierId) {
      return NextResponse.json(
        { success: false, error: "Fournisseur introuvable pour ce paiement Visa (supplierId/email manquant)." },
        { status: 404 }
      );
    }

    const userRef = adminDb.collection("users").doc(resolvedSupplierId);
    const supplierRef = adminDb.collection("suppliers").doc(resolvedSupplierId);
    const entryNumber = `ECR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    let duplicate = false;
    let supplierName = "Fournisseur";
    let newEndDate = new Date();

    await adminDb.runTransaction(async (tx: any) => {
      const [lockSnap, userSnap] = await Promise.all([tx.get(lockRef), tx.get(userRef)]);
      if (lockSnap.exists) {
        duplicate = true;
        return;
      }
      if (!userSnap.exists) {
        throw new Error("SUPPLIER_NOT_FOUND");
      }

      const sData = userSnap.data() || {};
      supplierName = sData.companyName || sData.company || sData.displayName || sData.name || "Fournisseur";

      let baseDate = new Date();
      if (sData.subscriptionEndDate) {
        const existingEnd = sData.subscriptionEndDate.toDate
          ? sData.subscriptionEndDate.toDate()
          : new Date(sData.subscriptionEndDate);
        if (existingEnd > baseDate) baseDate = existingEnd;
      }
      newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + 30);

      const now = FieldValue.serverTimestamp();
      const renewalTag = event.isRecurringRenewal ? "Prélèvement auto Visa" : "Paiement Carte Visa";

      // 1. Verrou d'idempotence anti-doublon
      tx.set(lockRef, {
        kind: "SUBSCRIPTION",
        supplierId: resolvedSupplierId,
        supplierName,
        provider: event.provider,
        referencePiece: event.referenceId,
        amount: event.amountUSD,
        isRecurringRenewal: event.isRecurringRenewal,
        entryNumber,
        createdAt: now,
      });

      // 2. Prolongation +30 jours sur users/{id} et suppliers/{id}
      tx.set(
        userRef,
        {
          subscriptionStatus: "ACTIVE",
          subscriptionEndDate: newEndDate,
          isBlocked: false,
          isSuspended: false,
          status: "active",
          autoRenewVisa: event.isRecurringRenewal,
          lastSubscriptionPaidAt: now,
          lastDepositPaidAt: now,
          lastDepositAmount: event.amountUSD,
          lastPaymentMethod: `Carte Visa (${event.provider})`,
        },
        { merge: true }
      );
      tx.set(
        supplierRef,
        {
          subscriptionStatus: "ACTIVE",
          subscriptionEndDate: newEndDate,
          isBlocked: false,
          status: "active",
          autoRenewVisa: event.isRecurringRenewal,
          updatedAt: now,
        },
        { merge: true }
      );

      // 3. Transaction Plateforme Admin (PLATFORM_ADMIN)
      tx.set(adminDb.collection("transactions").doc(), {
        type: "SUBSCRIPTION",
        category: "Abonnement Mensuel Boutique (Visa)",
        amount: event.amountUSD,
        currency: "USD",
        description: `${renewalTag} (${event.provider}) — ${supplierName}`,
        referenceId: event.referenceId,
        supplierId: resolvedSupplierId,
        supplierName,
        accountingScope: "PLATFORM_ADMIN",
        status: "COMPLETED",
        recordedBy: `webhook:${event.provider.toLowerCase()}`,
        createdAt: now,
      });

      // 4. Grand Livre Plateforme Admin (immuable, PLATFORM_ADMIN)
      tx.set(adminDb.collection("accounting_ledger").doc(), {
        entryNumber,
        date: now,
        createdAt: now,
        journal: "BQ",
        journalName: "Journal de Banque / Carte Visa",
        referencePiece: event.referenceId,
        label: `${renewalTag} (${event.provider}) — ${supplierName}`,
        debit: event.amountUSD,
        credit: 0,
        currency: "USD",
        actorType: "ADMIN",
        accountingScope: "PLATFORM_ADMIN",
        supplierId: resolvedSupplierId,
        supplierName,
        category: "Abonnement Fournisseur",
        status: "VALIDATED",
        recordedBy: `webhook:${event.provider.toLowerCase()}`,
      });

      // 5. Dépense dans le livre privé du fournisseur (SUPPLIER_PRIVATE)
      tx.set(adminDb.collection("supplier_transactions").doc(), {
        type: "EXPENSE",
        category: "Abonnement Plateforme",
        amount: event.amountUSD,
        currency: "USD",
        description: `${renewalTag} Rayons.net (${event.provider}) — Réf: ${event.referenceId}`,
        referenceId: event.referenceId,
        supplierId: resolvedSupplierId,
        accountingScope: "SUPPLIER_PRIVATE",
        status: "COMPLETED",
        createdAt: now,
      });

      // 6. Trace immuable dans audit_logs
      tx.set(adminDb.collection("audit_logs").doc(), {
        action: event.isRecurringRenewal ? "VISA_AUTO_RENEWAL_SUBSCRIPTION" : "VISA_WEBHOOK_SUBSCRIPTION_PAID",
        category: "FINANCE",
        provider: event.provider,
        supplierId: resolvedSupplierId,
        supplierName,
        amount: event.amountUSD,
        referencePiece: event.referenceId,
        entryNumber,
        newEndDate: newEndDate.toISOString(),
        createdAt: now,
      });
    });

    if (!duplicate) {
      await cacheDel("admin:suppliers:list:v1", "admin:executive-overview:v1");
      try {
        await creditReferralCommission({
          filleulId: resolvedSupplierId,
          paymentRef: event.referenceId,
          amountPaid: event.amountUSD,
        });
      } catch (commErr) {
        console.warn("[VISA WEBHOOK] Partner commission credit notice:", commErr);
      }
      await dispatchAccountNotification({
        userId: resolvedSupplierId,
        supplierId: resolvedSupplierId,
        type: "system",
        title: event.isRecurringRenewal
          ? "✅ Renouvellement Automatique Visa Confirmé (+30j)"
          : "✅ Paiement Carte Visa Confirmé (+30j)",
        message: `Votre règlement de $${event.amountUSD.toFixed(2)} USD via ${event.provider} (Réf: ${event.referenceId}) est confirmé. Boutique active jusqu'au ${newEndDate.toLocaleDateString("fr-FR")}.`,
        link: "/supplier/finance",
      });
    }

    return NextResponse.json({
      success: true,
      duplicate,
      kind: "SUBSCRIPTION",
      supplierId: resolvedSupplierId,
      entryNumber,
      newEndDate: newEndDate.toISOString(),
    });
  } catch (error: any) {
    if (error?.message === "ORDER_NOT_FOUND" || error?.message === "SUPPLIER_NOT_FOUND") {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    console.error("[VISA WEBHOOK ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur serveur webhook Visa" },
      { status: 500 }
    );
  }
}
