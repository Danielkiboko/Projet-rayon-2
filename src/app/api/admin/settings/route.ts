import { enforceRateLimit } from "@/lib/rateLimit";
import { safeApiError } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { requireFullAdminCaller } from "@/server/guards";
import { recordAuditLog } from "@/server/auditLog";

export async function POST(req: Request) {
  try {
  const _rl = await enforceRateLimit(req, "api:admin_settings:POST", 40, 60);
  if (_rl) return _rl;
    const guard = await requireFullAdminCaller(req);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;
    const caller = guard.caller;

    const body = await req.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ success: false, error: "Paramètres manquants." }, { status: 400 });
    }

    await initFirebaseAdmin();
    const db = adminDb;

    const dataToSave: Record<string, any> = {
      monthlySubscriptionPrice: Number(settings.monthlySubscriptionPrice) || 50,
      trialDurationDays: Number(settings.trialDurationDays) || 15,
      defaultDeliveryFee: Number(settings.defaultDeliveryFee) || 0,
      adminShopName: settings.adminShopName || "Rayons Officiel",
      adminContactPhone: settings.adminContactPhone || "",
      usdToFcRate: Number(settings.usdToFcRate) || 2850,
      usdToEurRate: Number(settings.usdToEurRate) || 0.92,
      defaultLanguage: ["fr", "en", "zh"].includes(String(settings.defaultLanguage))
        ? String(settings.defaultLanguage)
        : "fr",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
    };

    await db.collection("settings").doc("platform").set(dataToSave, { merge: true });

    recordAuditLog({
      action: "SETTINGS_UPDATED",
      caller,
      targetType: "settings",
      targetId: "platform",
      summary: `Paramètres globaux mis à jour (1 USD = ${dataToSave.usdToFcRate} FC, abo ${dataToSave.monthlySubscriptionPrice}, langue ${dataToSave.defaultLanguage}).`,
      metadata: {
        usdToFcRate: dataToSave.usdToFcRate,
        usdToEurRate: dataToSave.usdToEurRate,
        monthlySubscriptionPrice: dataToSave.monthlySubscriptionPrice,
        defaultLanguage: dataToSave.defaultLanguage,
      },
    });

    return NextResponse.json({ success: true, settings: dataToSave });
  } catch (error: any) {
    console.error("Error in /api/admin/settings:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur serveur") }, { status: 500 });
  }
}
