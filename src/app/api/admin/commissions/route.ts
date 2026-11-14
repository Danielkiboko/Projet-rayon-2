import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getServerCaller } from "@/lib/serverAuth";

function generateEntryNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `COM-${year}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer tous les partenaires enregistrés
    const partnersSnap = await adminDb
      .collection("users")
      .where("accountType", "==", "PARTNER")
      .get();

    const partners = partnersSnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        displayName: d.displayName || d.name || "Partenaire",
        email: d.email || "",
        phone: d.phone || "",
        referralCode: d.partnerCode || d.referralCode || "---",
        balance: Number(d.referralBalance || d.partnerBalance || 0),
        totalEarned: Number(d.referralTotalEarned || d.partnerTotalEarned || 0),
        referralCount: Number(d.referralCount || 0),
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
      };
    });

    return NextResponse.json({ success: true, partners });
  } catch (error: any) {
    console.error("[GET ADMIN COMMISSIONS ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : {};
    const adminName = callerData?.displayName || callerData?.name || "Administration Rayons";

    const body = await req.json();
    const { action, partnerId, amount, reason } = body;

    if (action === "CREDIT_COMMISSION") {
      const numAmount = Number(amount);
      if (!partnerId || isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { success: false, error: "Partenaire et montant valide requis." },
          { status: 400 }
        );
      }

      const partnerRef = adminDb.collection("users").doc(partnerId);
      const partnerSnap = await partnerRef.get();
      if (!partnerSnap.exists) {
        return NextResponse.json({ success: false, error: "Partenaire introuvable." }, { status: 404 });
      }

      const partnerData = partnerSnap.data() || {};
      const partnerName = partnerData.displayName || partnerData.name || partnerData.company || "Partenaire";
      const entryNumber = generateEntryNumber();
      const refPiece = `ADJ-COM-${Date.now().toString().slice(-6)}`;

      // 1. Transaction Firestore pour créditer le compte du partenaire
      const updatedBalance = (Number(partnerData.referralBalance) || 0) + numAmount;
      const updatedTotal = (Number(partnerData.referralTotalEarned) || 0) + numAmount;

      await partnerRef.update({
        referralBalance: FieldValue.increment(numAmount),
        referralTotalEarned: FieldValue.increment(numAmount),
        partnerBalance: FieldValue.increment(numAmount),
        partnerTotalEarned: FieldValue.increment(numAmount),
      });

      // 2. Écriture dans le grand livre comptable (accounting_ledger)
      await adminDb.collection("accounting_ledger").add({
        entryNumber,
        date: FieldValue.serverTimestamp(),
        journal: "OD",
        journalName: "Journal des Opérations Diverses (Commissions Partenaires)",
        referencePiece: refPiece,
        label: `Attribution commission directe partenaire ${partnerName} - ${reason || "Ajustement ou prime d'apporteur d'affaires"}`,
        debit: 0,
        credit: numAmount, // Sortie / Dette envers le partenaire
        balanceAfter: updatedBalance,
        currency: "USD",
        actorType: "ADMIN",
        actorUid: caller.uid,
        actorName: adminName,
        partnerId,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 3. Enregistrement dans referral_commissions
      await adminDb.collection("referral_commissions").add({
        referrerId: partnerId,
        referrerName: partnerName,
        amount: numAmount,
        currency: "USD",
        kind: "ADMIN_BONUS",
        reason: reason || "Commission directe accordée par l'administration",
        status: "PENDING", // En attente de retrait par le partenaire
        paymentRef: refPiece,
        creditedBy: caller.uid,
        creditedByName: adminName,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 4. Notification in-app pour le partenaire
      await adminDb.collection("inapp_notifications").add({
        userId: partnerId,
        type: "COMMISSION_CREDITED",
        title: `💰 +${numAmount} $ USD crédités sur votre compte`,
        message: `L'administration centrale Rayons.net vous a crédité une commission directe de ${numAmount} $ USD (${reason || "Bonus partenaire"}). Votre nouveau solde est de ${updatedBalance.toFixed(2)} $ USD.`,
        link: "/partner",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: `Commission de ${numAmount} $ USD créditée avec succès sur le compte de ${partnerName}.`,
        newBalance: updatedBalance,
      });
    }

    return NextResponse.json({ success: false, error: "Action non reconnue" }, { status: 400 });
  } catch (error: any) {
    console.error("[POST ADMIN COMMISSIONS ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
