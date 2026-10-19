import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { payoutReferrerCommissions } from "@/lib/referrals";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    // Get all referral relationships
    const referralsSnap = await adminDb.collection("referrals").get();
    const relations: any[] = [];
    referralsSnap.forEach((doc: any) => relations.push({ id: doc.id, ...doc.data() }));

    // Get all commissions
    const commissionsSnap = await adminDb.collection("referral_commissions").get();
    const commissions: any[] = [];
    let totalEarned = 0;
    let totalPending = 0;
    let totalPaid = 0;

    commissionsSnap.forEach((doc: any) => {
      const d = doc.data();
      const amount = Number(d.amount) || 0;
      totalEarned += amount;
      if (d.status === "PAID") totalPaid += amount;
      else totalPending += amount;

      commissions.push({
        id: doc.id,
        referrerId: d.referrerId,
        referrerName: d.referrerName,
        filleulId: d.filleulId,
        filleulName: d.filleulName,
        amount,
        status: d.status || "PENDING",
        kind: d.kind,
        paymentRef: d.paymentRef,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
        paidAt: d.paidAt?.toDate ? d.paidAt.toDate().toISOString() : null,
      });
    });

    commissions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Get all referrers (users with referralCode or referralBalance > 0)
    const usersSnap = await adminDb.collection("users").get();
    const referrers: any[] = [];

    usersSnap.forEach((doc: any) => {
      const u = doc.data();
      const hasCode = !!u.referralCode;
      const balance = Number(u.referralBalance) || 0;
      const count = Number(u.referralCount) || 0;
      const total = Number(u.referralTotalEarned) || 0;
      const paid = Number(u.referralPaidTotal) || 0;

      if (hasCode || balance > 0 || count > 0) {
        referrers.push({
          id: doc.id,
          name: u.company || u.displayName || u.name || u.email || "Fournisseur",
          email: u.email || "",
          phone: u.phone || "",
          code: u.referralCode,
          referralCount: count,
          referralBalance: balance,
          referralTotalEarned: total,
          referralPaidTotal: paid,
          role: u.role,
        });
      }
    });

    referrers.sort((a, b) => (b.referralBalance || 0) - (a.referralBalance || 0));

    return NextResponse.json({
      success: true,
      stats: {
        totalReferrers: referrers.length,
        totalFilleuls: relations.length,
        totalCommissionsCount: commissions.length,
        totalEarned,
        totalPending,
        totalPaid,
      },
      referrers,
      commissions: commissions.slice(0, 100),
      relations: relations.slice(0, 100),
    });
  } catch (error: any) {
    console.error("[ADMIN REFERRALS GET ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    const body = await req.json();
    const { action, referrerId, paymentMethod } = body;

    if (action === "PAYOUT") {
      if (!referrerId) {
        return NextResponse.json({ success: false, error: "Identifiant du parrain manquant." }, { status: 400 });
      }

      const result = await payoutReferrerCommissions({
        referrerId,
        adminUid: caller.uid,
        paymentMethod: paymentMethod || "Caisse centrale / Mobile Money",
      });

      return NextResponse.json({
        success: true,
        message: `Commissions de $${result.paidAmount.toFixed(2)} versées avec succès (${result.count} commission(s)).`,
        ...result,
      });
    }

    return NextResponse.json({ success: false, error: "Action inconnue." }, { status: 400 });
  } catch (error: any) {
    console.error("[ADMIN REFERRALS POST ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
