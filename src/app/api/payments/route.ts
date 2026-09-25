import { NextResponse } from "next/server";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

  // ── Mode simulation (actif tant que l'API n'est pas branchée) ──
  console.log("[MAKUTA SIMULATION] amount:", _amount, "phone:", _phone, "currency:", _currency);
  await new Promise(r => setTimeout(r, 1500));
  return { success: true, referenceId: `SIM-MAKUTA-${Date.now()}` };
}

// ─── Helper: appel Orange Money (à activer quand API reçue) ─────────────────
async function callOrangeMoney(_amount: number, _phone: string): Promise<{ success: boolean; referenceId?: string; error?: string }> {
  // ⚠️  BRANCHER ICI quand tu reçois les credentials Orange Money :
  //
  // const OM_BASE  = process.env.ORANGE_MONEY_BASE_URL!;
  // const OM_TOKEN = process.env.ORANGE_MONEY_TOKEN!;
  //
  // const res = await fetch(`${OM_BASE}/payment/init`, { ... });
  // ...

  console.log("[ORANGE MONEY SIMULATION] amount:", _amount, "phone:", _phone);
  await new Promise(r => setTimeout(r, 1500));
  return { success: true, referenceId: `SIM-OM-${Date.now()}` };
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
export async function POST(req: Request) {
  try {
    await initFirebaseAdmin();
    const db = adminDb;
    const body: PaymentRequest = await req.json();
    const { provider, type, amount, currency, clientPhone, orderId, clientId, supplierId, planDays, planLabel } = body;

    if (!provider || !type || !amount) {
      return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 });
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

      // 3. SMS fidélité client (via /api/sms)
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
      const daysToAdd = planDays ?? 30;
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

      return NextResponse.json({ success: true, referenceId: refId, message: "Abonnement activé" });
    }

    return NextResponse.json({ success: false, error: "Type de paiement invalide" }, { status: 400 });

  } catch (error: any) {
    console.error("[PAYMENT API] Erreur :", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
