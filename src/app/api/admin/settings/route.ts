import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings, userId } = body;

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
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (userId) {
      dataToSave.updatedBy = userId;
    }

    await db.collection("settings").doc("platform").set(dataToSave, { merge: true });

    return NextResponse.json({ success: true, settings: dataToSave });
  } catch (error: any) {
    console.error("Error in /api/admin/settings:", error);
    return NextResponse.json({ success: false, error: error?.message || "Erreur serveur" }, { status: 500 });
  }
}
