import { safeApiError } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { creditReferralCommission } from "@/lib/referrals";
import { getServerCaller, canActForSupplier } from "@/lib/serverAuth";
import { enforceRateLimit } from "@/lib/rateLimit";

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT GATEWAY — Structure prête à brancher
// ─────────────────────────────────────────────────────────────────────────────
// Fournisseurs supportés (à activer quand tu as l'API) :
//  - MAKUTA       : passerelle mobile money locale (RDC)
//  - ORANGE_MONEY : Orange Money DRC
//  - AIRTEL_MONEY : Airtel Money DRC
//  - MANUAL       : paiement cash/virement validé manuellement par admin
// ─────────────────────────────────────────────────────────────────────────────

type PaymentProvider = "MAKUTA" | "ORANGE_MONEY" | "AIRTEL_MONEY" | "MANUAL";
type PaymentType = "ORDER" | "SUBSCRIPTION";

interface PaymentRequest {
  provider: PaymentProvider;
  type: PaymentType;
  amount: number;
  currency: "USD" | "CDF";
  // ORDER specific
  orderId?: string;
  clientId?: string;
  clientPhone?: string;
  // SUBSCRIPTION specific
  supplierId?: string;
  planDays?: number;
  planLabel?: string;
}

// ─── Helper: appel Makuta (à activer quand API reçue) ───────────────────────
async function callMakuta(_amount: number, _phone: string, _currency: string): Promise<{ success: boolean; referenceId?: string; error?: string }> {
  // ⚠️  BRANCHER ICI quand tu reçois les credentials Makuta :
  //
  // const MAKUTA_BASE = process.env.MAKUTA_BASE_URL!;      // ex: https://api.makuta.cd
  // const MAKUTA_KEY  = process.env.MAKUTA_API_KEY!;
  //
  // const res = await fetch(`${MAKUTA_BASE}/mgep_Payment`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "Authorization": `Bearer ${MAKUTA_KEY}`,
  //   },
  //   body: JSON.stringify({
  //     amount: _amount,
  //     phone: _phone,
  //     currency: _currency,
  //     description: "Paiement Rayons.net",
  //   }),
  // });
  //
  // const data = await res.json();
  // if (!res.ok || data.status !== "SUCCESS") {
  //   return { success: false, error: data.message || "Echec Makuta" };
  // }
  // return { success: true, referenceId: data.reference };

  if (process.env.MAKUTA_API_KEY && process.env.MAKUTA_BASE_URL) {
    try {
      const res = await fetch(`${process.env.MAKUTA_BASE_URL}/mgep_Payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.MAKUTA_API_KEY}`,
        },
        body: JSON.stringify({
          amount: _amount,
          phone: _phone,
          currency: _currency,
          description: "Paiement Rayons.net",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "SUCCESS") {
        return { success: false, error: data.message || "Échec de transaction Makuta" };
      }
      return { success: true, referenceId: data.reference };
    } catch {
      return { success: false, error: "Erreur de connexion au prestataire Makuta." };
    }
  }

  // Fail-closed strict : aucune simulation de paiement n'est autorisée sans passerelle réelle configurée
  return {
    success: false,
    error: "La passerelle de paiement Makuta n'est pas encore activée. Veuillez opter pour le paiement à la livraison (Cash) ou contacter l'assistance.",
  };
}

// ─── Helper: appel Orange Money (à activer quand API reçue) ─────────────────
async function callOrangeMoney(_amount: number, _phone: string): Promise<{ success: boolean; referenceId?: string; error?: string }> {
  if (process.env.ORANGE_MONEY_TOKEN && process.env.ORANGE_MONEY_BASE_URL) {
    // Appel réel Orange Money quand configuré
  }

  // Fail-closed strict : aucune simulation autorisée
  return {
    success: false,
    error: "La passerelle Orange Money est en cours de configuration. Veuillez choisir le paiement cash ou soumettre votre preuve Mobile Money.",
  };
}

// ─── Routeur de provider ─────────────────────────────────────────────────────
async function processPayment(
  provider: PaymentProvider,
  amount: number,
  currency: string,
  phone: string
): Promise<{ success: boolean; referenceId?: string; error?: string }> {
  switch (provider) {
    case "MAKUTA":
      return callMakuta(amount, phone, currency);
    case "ORANGE_MONEY":
      return callOrangeMoney(amount, phone);
    case "AIRTEL_MONEY":
      // TODO: implémenter quand credentials reçus
      return { success: false, error: "Airtel Money non encore configuré" };
    case "MANUAL":
      // Paiement manuel : l'admin valide dans son dashboard
      return { success: true, referenceId: `MANUAL-${Date.now()}` };
    default:
      return { success: false, error: "Fournisseur de paiement inconnu" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "payments", 10, 60);
    if (rateLimited) return rateLimited;

    await initFirebaseAdmin();
    const db = adminDb;
    const body: PaymentRequest = await req.json();
    const { provider, type, amount, currency, clientPhone, orderId, clientId, supplierId, planDays, planLabel } = body;

    if (!provider || !type || !amount) {
      return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 });
    }

    const caller = await getServerCaller(req);

    if (type === "SUBSCRIPTION") {
      if (!supplierId) {
        return NextResponse.json({ success: false, error: "supplierId requis" }, { status: 400 });
      }
      if (!caller || !canActForSupplier(caller, supplierId)) {
        return NextResponse.json({ success: false, error: "Non autorisé à renouveler cet abonnement." }, { status: 403 });
      }
      if (provider === "MANUAL" && !caller.isAdmin) {
        return NextResponse.json(
          { success: false, error: "Un paiement manuel d'abonnement doit être validé par un administrateur." },
          { status: 403 }
        );
      }
    }

    const phone = clientPhone || "";
    const paymentResult = await processPayment(provider, amount, currency, phone);

    if (!paymentResult.success) {
      return NextResponse.json({ success: false, error: paymentResult.error }, { status: 402 });
    }

    const refId = paymentResult.referenceId!;
    const now = FieldValue.serverTimestamp();

    // ─── Traitement selon le type ────────────────────────────────────────────
    if (type === "ORDER" && orderId) {
      // 0. Vérification d'idempotence : La commande est-elle déjà payée ?
      const orderDocSnap = await db.collection("orders").doc(orderId).get();
      if (!orderDocSnap.exists) {
        return NextResponse.json({ success: false, error: "Commande introuvable" }, { status: 404 });
      }

      const existingOrderData = orderDocSnap.data();

      // Contrôle strict de propriété sur la commande (empêche un tiers de modifier le statut d'une autre commande)
      const orderOwnerId = existingOrderData?.clientId;
      if (!caller) {
        return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
      }
      if (!caller.isAdmin && orderOwnerId && orderOwnerId !== "GUEST" && caller.uid !== orderOwnerId) {
        return NextResponse.json({ success: false, error: "Non autorisé à payer ou modifier cette commande." }, { status: 403 });
      }

      if (existingOrderData?.status === "COMPLETED" || existingOrderData?.status === "PAID") {
        return NextResponse.json({
          success: true,
          referenceId: existingOrderData.paymentReference || "ALREADY_PAID",
          message: "Cette commande a déjà été réglée avec succès.",
        });
      }

      // Si paiement MANUAL initié par un non-admin, enregistrer en attente de validation
      if (provider === "MANUAL" && !caller?.isAdmin) {
        await db.collection("orders").doc(orderId).update({
          paymentProvider: provider,
          paymentReference: refId,
          paymentStatus: "PENDING_MANUAL_VALIDATION",
          updatedAt: now,
        });
        return NextResponse.json({
          success: true,
          referenceId: refId,
          pendingValidation: true,
          message: "Demande de paiement manuel enregistrée. Elle sera validée à la réception des fonds.",
        });
      }

      // 1. Mettre à jour la commande
      await db.collection("orders").doc(orderId).update({
        status: "COMPLETED",
        paymentProvider: provider,
        paymentReference: refId,
        paidAt: now,
        paidAmount: amount,
      });

      // 2. Enregistrer la transaction
      await db.collection("transactions").add({
        type: "ORDER_PAYMENT",
        orderId,
        clientId: clientId || null,
        amount,
        currency,
        provider,
        referenceId: refId,
        status: "COMPLETED",
        createdAt: now,
      });

      // 3. SMS fidélité client (via sendMobiShastraSMS ou /api/sms)
      if (clientPhone) {
        const smsMsg = `Merci pour votre achat chez Rayon ! Commande #${orderId.slice(0, 6).toUpperCase()} confirmée. Ref paiement : ${refId}`;
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://rayons.net"}/api/sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: clientPhone, message: smsMsg }),
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, referenceId: refId, message: "Commande payée avec succès" });
    }

    if (type === "SUBSCRIPTION" && supplierId) {
      const daysToAdd = caller?.isAdmin && planDays && planDays > 0 ? Math.min(planDays, 365) : 30;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysToAdd);

      await db.collection("users").doc(supplierId).update({
        subscriptionStatus: "ACTIVE",
        subscriptionEndDate: endDate,
        subscriptionPlan: planLabel || "MENSUEL",
        lastPaymentRef: refId,
        lastPaymentDate: now,
      });

      await db.collection("transactions").add({
        type: "SUBSCRIPTION",
        supplierId,
        amount,
        currency,
        provider,
        referenceId: refId,
        planLabel: planLabel || "MENSUEL",
        status: "COMPLETED",
        createdAt: now,
      });

      await db.collection("supplier_transactions").add({
        supplierId,
        type: "EXPENSE",
        amount,
        currency,
        description: `Abonnement Rayons.net — ${planLabel || "Mensuel"}`,
        referenceId: refId,
        status: "COMPLETED",
        createdAt: now,
      });

      // Traitement du parrainage (5 USD au parrain à vie)
      try {
        await creditReferralCommission({ filleulId: supplierId, paymentRef: refId, amountPaid: amount });
      } catch (refErr) {
        console.warn("[PAYMENT API] referral commission notice:", refErr);
      }

      return NextResponse.json({ success: true, referenceId: refId, message: "Abonnement activé" });
    }

    return NextResponse.json({ success: false, error: "Type de paiement invalide" }, { status: 400 });

  } catch (error: any) {
    console.error("[PAYMENT API] Erreur :", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur interne du serveur.") }, { status: 500 });
  }
}
