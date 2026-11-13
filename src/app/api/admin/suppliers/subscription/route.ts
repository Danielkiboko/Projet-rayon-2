import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    const body = await req.json();
    const { 
      supplierId, 
      subscriptionStatus = "TRIAL", 
      daysToAdd = 15, 
      customExpiryDate,
      action // "REACTIVATE" or "UPDATE_SUB"
    } = body;

    if (!supplierId) {
      return NextResponse.json({ success: false, error: "Identifiant du fournisseur manquant." }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(supplierId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: "Fournisseur introuvable." }, { status: 404 });
    }

    const currentData = userDoc.data() || {};

    let targetSubStatus = subscriptionStatus;
    if (action === "REACTIVATE") {
      targetSubStatus = "TRIAL";
    }

    // Calcul de la nouvelle date d'échéance
    let newEndDate: Date;
    if (customExpiryDate) {
      newEndDate = new Date(customExpiryDate);
      newEndDate.setHours(23, 59, 59, 999);
    } else {
      let baseDate = new Date();
      if (currentData.subscriptionEndDate) {
        const existing = currentData.subscriptionEndDate.toDate 
          ? currentData.subscriptionEndDate.toDate() 
          : new Date(currentData.subscriptionEndDate);
        if (existing > baseDate && action !== "REACTIVATE") {
          baseDate = existing;
        }
      }
      newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + Number(daysToAdd || 15));
    }

    const isUnblocking = targetSubStatus === "TRIAL" || targetSubStatus === "ACTIVE";

    const updatePayload: Record<string, any> = {
      subscriptionStatus: targetSubStatus,
      subscriptionEndDate: newEndDate,
      adminCustomTrial: true,
      trialPeriodDays: Number(daysToAdd || 15),
      updatedAt: new Date(),
    };

    if (isUnblocking) {
      updatePayload.isBlocked = false;
      updatePayload.isSuspended = false;
      updatePayload.status = "active";
    } else {
      updatePayload.isBlocked = true;
      updatePayload.isSuspended = true;
      updatePayload.status = "suspended";
    }

    // 1. Mettre à jour dans la collection users
    await userRef.set(updatePayload, { merge: true });

    // 2. Mettre à jour / synchroniser dans la collection suppliers
    const supplierRef = adminDb.collection("suppliers").doc(supplierId);
    await supplierRef.set({
      subscriptionStatus: targetSubStatus,
      subscriptionEndDate: newEndDate,
      isBlocked: !isUnblocking,
      status: isUnblocking ? "active" : "suspended",
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: isUnblocking 
        ? `Fournisseur réactivé avec succès (${targetSubStatus === "TRIAL" ? "Essai" : "Abonnement Actif"}). Échéance : ${newEndDate.toLocaleDateString("fr-FR")}`
        : "Compte fournisseur suspendu.",
      newEndDate: newEndDate.toISOString(),
      subscriptionStatus: targetSubStatus,
      isBlocked: !isUnblocking,
      status: isUnblocking ? "active" : "suspended",
    });
  } catch (error: any) {
    console.error("[ADMIN UPDATE SUPPLIER SUB ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
