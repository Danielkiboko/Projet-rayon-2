import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

export async function POST(req: Request) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Accès réservé aux administrateurs." },
        { status: 403 }
      );
    }

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

    return NextResponse.json({ success: true, settings: dataToSave });
  } catch (error: any) {
    console.error("Error in /api/admin/settings:", error);
    return NextResponse.json({ success: false, error: error?.message || "Erreur serveur" }, { status: 500 });
  }
}
