import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { ensureReferralCode } from "@/lib/referrals";
import { buildReferralLink, REFERRAL_COMMISSION_USD, REFERRAL_DISCOUNT_USD } from "@/lib/referralConfig";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const supplierId = caller.parentSupplierId || caller.uid;
    const referralCode = await ensureReferralCode(supplierId);
    const referralLink = buildReferralLink(referralCode);

    // Refresh user doc
    const userSnap = await adminDb.collection("users").doc(supplierId).get();
    const userData = userSnap.data() || {};

    // Get referrals (filleuls)
    const referralsSnap = await adminDb
      .collection("referrals")
      .where("referrerId", "==", supplierId)
      .limit(100)
      .get();

    const filleuls: any[] = [];
    referralsSnap.forEach((doc: any) => {
      const d = doc.data();
      filleuls.push({
        id: doc.id,
        filleulId: d.filleulId,
        filleulName: d.filleulName,
        filleulEmail: d.filleulEmail,
        code: d.code,
        totalCommissions: Number(d.totalCommissions) || 0,
        paymentsCount: Number(d.paymentsCount) || 0,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
        lastPaymentAt: d.lastPaymentAt?.toDate ? d.lastPaymentAt.toDate().toISOString() : null,
      });
    });

    // Get commissions history
    const commissionsSnap = await adminDb
      .collection("referral_commissions")
      .where("referrerId", "==", supplierId)
      .limit(200)
      .get();

    const commissions: any[] = [];
    commissionsSnap.forEach((doc: any) => {
      const d = doc.data();
      commissions.push({
        id: doc.id,
        filleulName: d.filleulName,
        amount: Number(d.amount) || REFERRAL_COMMISSION_USD,
        currency: d.currency || "USD",
        kind: d.kind || "RENEWAL",
        status: d.status || "PENDING",
        paymentRef: d.paymentRef,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
        paidAt: d.paidAt?.toDate ? d.paidAt.toDate().toISOString() : null,
      });
    });

    // Sort commissions by date desc
    commissions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Get invitations sent
    const invitesSnap = await adminDb
      .collection("referral_invites")
      .where("referrerId", "==", supplierId)
      .limit(100)
      .get();

    const invites: any[] = [];
    invitesSnap.forEach((doc: any) => {
      const d = doc.data();
      invites.push({
        id: doc.id,
        email: d.email,
        status: d.status || "SENT",
        sentAt: d.sentAt?.toDate ? d.sentAt.toDate().toISOString() : null,
        registeredAt: d.registeredAt?.toDate ? d.registeredAt.toDate().toISOString() : null,
      });
    });

    invites.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());

    return NextResponse.json({
      success: true,
      referralCode,
      referralLink,
      commissionPerPayment: REFERRAL_COMMISSION_USD,
      filleulDiscount: REFERRAL_DISCOUNT_USD,
      stats: {
        referralCount: filleuls.length,
        referralBalance: Number(userData.referralBalance) || 0,
        referralTotalEarned: Number(userData.referralTotalEarned) || 0,
        referralPaidTotal: Number(userData.referralPaidTotal) || 0,
        pendingDiscount: Number(userData.referralDiscountPending) || 0,
        referredBy: userData.referredBy || null,
        referralCodeUsed: userData.referralCodeUsed || null,
      },
      filleuls,
      commissions,
      invites,
    });
  } catch (error: any) {
    console.error("[REFERRALS ME API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
