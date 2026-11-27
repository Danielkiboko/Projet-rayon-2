import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";
import { requireAnyStaffPermission } from "@/server/guards";
import { enforceRateLimit } from "@/lib/rateLimit";
import { paymentIntentSchema } from "@/server/schemas";

/**
 * /api/supplier/payment-intent
 * Trace persistante anti-coupure créée DÈS l'Étape 1 de `/supplier/register` (avant même la fin du processus).
 *
 * - Si la connexion coupe ou le téléphone s'éteint après paiement, la trace (Référence, Email, Téléphone,
 *   Opérateur, Montant) reste immédiatement consultable dans `/admin/finance` pour retrouver et activer le client.
 * - Dès que l'Étape 2 (`/api/supplier/subscribe`) aboutit, le statut passe automatiquement en `COMPLETED`.
 */

function sanitizeDocId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "supplier:payment-intent", 12, 60);
    if (rateLimited) return rateLimited;

    const rawBody = await req.json().catch(() => null);
    const parsed = paymentIntentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Données de paiement invalides." },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const email = body.email.toLowerCase();
    const phone = String(body.phone || "").trim().slice(0, 40);
    const paymentPhone = String(body.paymentPhone || phone || "").trim().slice(0, 40);
    const paymentMethod = body.paymentMethod;
    const operator = String(body.operator || (paymentMethod === "card" ? "VISA" : "MPESA"))
      .trim()
      .toUpperCase()
      .slice(0, 30);
    const operatorTxRef = String(body.operatorTxRef || "").trim().slice(0, 100);
    const rawRef = String(body.reference || "").trim();
    const reference =
      rawRef ||
      (operatorTxRef.length >= 4
        ? operatorTxRef
        : `RAY-DEP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
    const amount = body.amount;
    const promoCode = String(body.promoCode || "").trim().slice(0, 40);

    const caller = await getServerCaller(req);
    const docId = sanitizeDocId(reference);
    const nowMs = Date.now();

    await Promise.all([
      adminDb
        .collection("supplier_payment_intents")
        .doc(docId)
        .set(
          {
            reference,
            operatorTxRef: operatorTxRef || null,
            email,
            phone,
            paymentPhone,
            paymentMethod,
            operator,
            amount,
            currency: "USD",
            promoCode: promoCode || null,
            userId: caller?.uid || null,
            status: "INITIATED",
            createdAtMs: nowMs,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      adminDb.collection("audit_logs").add({
        action: "SUPPLIER_PAYMENT_INTENT_CREATED",
        category: "FINANCE",
        reference,
        operatorTxRef: operatorTxRef || null,
        email,
        phone: paymentPhone || phone,
        operator,
        amount,
        actorUid: caller?.uid || null,
        createdAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return NextResponse.json({ success: true, intentId: docId, reference }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/supplier/payment-intent ERROR]:", error);
    return NextResponse.json({ success: false, error: "Erreur d'enregistrement de la trace paiement." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["finance.view", "finance.cash", "subscriptions.manage"]);
    if (!guard.ok) return guard.errorResponse!;

    const snap = await adminDb
      .collection("supplier_payment_intents")
      .orderBy("createdAtMs", "desc")
      .limit(60)
      .get();

    const intents = snap.docs.map((d: any) => {
      const data = d.data() || {};
      const createdAtMs = Number(data.createdAtMs) || data.createdAt?.toMillis?.() || 0;
      return {
        id: d.id,
        reference: data.reference || d.id,
        operatorTxRef: data.operatorTxRef || null,
        email: data.email || "",
        phone: data.phone || "",
        paymentPhone: data.paymentPhone || "",
        paymentMethod: data.paymentMethod || "mobile_money",
        operator: data.operator || "MPESA",
        amount: Number(data.amount) || 50,
        currency: data.currency || "USD",
        promoCode: data.promoCode || null,
        userId: data.userId || null,
        status: data.status || "INITIATED",
        resolutionNote: data.resolutionNote || null,
        createdAtMs,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
      };
    });

    const interrupted = intents.filter((i: any) => i.status === "INITIATED");

    return NextResponse.json({
      success: true,
      intents,
      interruptedCount: interrupted.length,
    });
  } catch (error: any) {
    console.error("[GET /api/supplier/payment-intent ERROR]:", error);
    return NextResponse.json({ success: false, error: "Erreur lecture traces paiements." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["finance.cash", "subscriptions.manage"]);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;

    const body = await req.json().catch(() => ({}));
    const intentId = sanitizeDocId(String(body.intentId || "").trim());
    const action = String(body.action || "").toUpperCase(); // "RESOLVE" | "CANCEL"
    const note = String(body.note || "").trim().slice(0, 300);

    if (!intentId || !["RESOLVE", "CANCEL"].includes(action)) {
      return NextResponse.json({ success: false, error: "Paramètres invalides." }, { status: 400 });
    }

    const nextStatus = action === "RESOLVE" ? "RESOLVED" : "CANCELLED";

    await Promise.all([
      adminDb
        .collection("supplier_payment_intents")
        .doc(intentId)
        .set(
          {
            status: nextStatus,
            resolutionNote: note || (action === "RESOLVE" ? "Dossier vérifié et résolu par l'Admin." : "Tentative non payée / annulée."),
            resolvedByUid: guard.caller.uid,
            resolvedByEmail: guard.caller.email || null,
            resolvedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      adminDb.collection("audit_logs").add({
        action: `SUPPLIER_PAYMENT_INTENT_${nextStatus}`,
        category: "FINANCE",
        intentId,
        note: note || null,
        actorUid: guard.caller.uid,
        actorEmail: guard.caller.email || null,
        createdAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: action === "RESOLVE" ? "Trace marquée comme résolue." : "Trace marquée comme annulée.",
    });
  } catch (error: any) {
    console.error("[PATCH /api/supplier/payment-intent ERROR]:", error);
    return NextResponse.json({ success: false, error: "Erreur de mise à jour." }, { status: 500 });
  }
}
