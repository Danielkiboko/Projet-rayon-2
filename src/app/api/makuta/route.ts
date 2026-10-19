import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { creditReferralCommission } from "@/lib/referrals";

export async function POST(req: Request) {
  try {
    const { supplierId } = await req.json();

    if (!supplierId) {
      return NextResponse.json({ success: false, error: "Missing supplierId" }, { status: 400 });
    }

    // TODO: Intégration API Makuta Réelle
    // const response = await fetch("MAKUTA_URL/mgep_Payment", { ... });
    // const result = await response.json();
    
    // Pour l'instant, on simule un succès immédiat après 2 secondes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await initFirebaseAdmin();
    const db = adminDb;
    const userRef = db.collection("users").doc(supplierId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      // Calculer la nouvelle date de fin (+30 jours)
      const now = new Date();
      const newEndDate = new Date(now.setDate(now.getDate() + 30));

      await userRef.update({
        subscriptionStatus: "ACTIVE",
        subscriptionEndDate: newEndDate
      });

      const refId = `MAKUTA-${Math.floor(Math.random() * 1000000)}`;
      
      const transactionsRef = db.collection("transactions");
      await transactionsRef.add({
        type: "SUBSCRIPTION",
        amount: 20,
        description: `Paiement Abonnement - ${userDoc.data()?.displayName || userDoc.data()?.email || 'Fournisseur'}`,
        referenceId: refId,
        status: "COMPLETED",
        supplierId: supplierId,
        createdAt: FieldValue.serverTimestamp()
      });

      const supplierTransactionsRef = db.collection("supplier_transactions");
      await supplierTransactionsRef.add({
        supplierId: supplierId,
        type: "EXPENSE",
        amount: 20,
        currency: "USD",
        description: "Paiement Abonnement Plateforme",
        referenceId: refId,
        status: "COMPLETED",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: supplierId
      });

      // Traitement du parrainage
      try {
        await creditReferralCommission({ filleulId: supplierId, paymentRef: refId, amountPaid: 20 });
      } catch (refErr) {
        console.warn("[MAKUTA API] referral commission notice:", refErr);
      }

      return NextResponse.json({ success: true, message: "Paiement réussi" });
    } else {
      return NextResponse.json({ success: false, error: "Utilisateur non trouvé" }, { status: 404 });
    }

  } catch (error: any) {
    console.error("Erreur API Makuta :", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
