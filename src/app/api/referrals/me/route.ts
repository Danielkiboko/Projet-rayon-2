import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { ensureReferralCode } from "@/lib/referrals";
import { buildReferralLink, REFERRAL_COMMISSION_USD, REFERRAL_DISCOUNT_USD } from "@/lib/referralConfig";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

    // 1. Get referrals (filleuls) from both `referrals` collection AND `users` collection
    const [referralsSnap, uSnap1, uSnap2, uSnap3] = await Promise.all([
      adminDb.collection("referrals").where("referrerId", "==", supplierId).limit(150).get(),
      adminDb.collection("users").where("referredBy", "==", supplierId).limit(150).get(),
      adminDb.collection("users").where("referredByPartnerId", "==", supplierId).limit(150).get(),
      adminDb.collection("users").where("createdBy", "==", supplierId).limit(150).get(),
    ]);

    const filleulMap = new Map<string, any>();

    referralsSnap.forEach((doc: any) => {
      const d = doc.data();
      const fId = d.filleulId || doc.id;
      filleulMap.set(fId, {
        id: doc.id,
        filleulId: fId,
        filleulName: d.filleulName || "Boutique",
        filleulEmail: d.filleulEmail || null,
        phone: d.phone || null,
        rayon: d.rayon || null,
        subscriptionStatus: d.subscriptionStatus || "TRIAL",
        code: d.code || referralCode,
        totalCommissions: Number(d.totalCommissions) || 0,
        paymentsCount: Number(d.paymentsCount) || 0,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (typeof d.createdAt === "string" ? d.createdAt : null),
        lastPaymentAt: d.lastPaymentAt?.toDate ? d.lastPaymentAt.toDate().toISOString() : null,
      });
    });

    // 2. Merge & auto-backfill any suppliers found in `users` that were created/referred by this partner
    const userDocs = [...uSnap1.docs, ...uSnap2.docs, ...uSnap3.docs];
    const seenUserIds = new Set<string>();
    const missingReferralsToSync: Array<{ fId: string; payload: any }> = [];

    for (const uDoc of userDocs) {
      const fId = uDoc.id;
      if (fId === supplierId || seenUserIds.has(fId)) continue;
      seenUserIds.add(fId);

      const u = uDoc.data() || {};
      const existing = filleulMap.get(fId);
      const resolvedName = u.companyName || u.company || u.displayName || u.name || existing?.filleulName || u.email || "Boutique";
      const resolvedEmail = u.email || existing?.filleulEmail || null;
      const resolvedRayon = u.rayon || (Array.isArray(u.assignedRayons) ? u.assignedRayons[0] : null) || existing?.rayon || "connect";
      const resolvedPhone = u.phone || u.phoneNumber || existing?.phone || null;
      const resolvedSubStatus = u.subscriptionStatus || existing?.subscriptionStatus || "TRIAL";
      const resolvedCreatedAt = u.createdAt?.toDate
        ? u.createdAt.toDate().toISOString()
        : (typeof u.createdAt === "string" ? u.createdAt : existing?.createdAt || new Date().toISOString());

      if (existing) {
        filleulMap.set(fId, {
          ...existing,
          filleulName: resolvedName,
          filleulEmail: resolvedEmail,
          phone: resolvedPhone,
          rayon: resolvedRayon,
          subscriptionStatus: resolvedSubStatus,
          createdAt: existing.createdAt || resolvedCreatedAt,
        });
      } else {
        filleulMap.set(fId, {
          id: fId,
          filleulId: fId,
          filleulName: resolvedName,
          filleulEmail: resolvedEmail,
          phone: resolvedPhone,
          rayon: resolvedRayon,
          subscriptionStatus: resolvedSubStatus,
          code: u.referralCodeUsed || referralCode,
          totalCommissions: 0,
          paymentsCount: 0,
          createdAt: resolvedCreatedAt,
          lastPaymentAt: null,
        });

        missingReferralsToSync.push({
          fId,
          payload: {
            filleulId: fId,
            filleulName: resolvedName,
            filleulEmail: resolvedEmail,
            phone: resolvedPhone,
            rayon: resolvedRayon,
            referrerId: supplierId,
            referrerName: userData.displayName || userData.name || userData.email || "Partenaire",
            code: u.referralCodeUsed || referralCode,
            totalCommissions: 0,
            paymentsCount: 0,
            createdAt: u.createdAt || FieldValue.serverTimestamp(),
          },
        });
      }
    }

    // Backfill missing documents in `referrals/{fId}` asynchronously so future commission credits work
    if (missingReferralsToSync.length > 0) {
      try {
        const batch = adminDb.batch();
        for (const item of missingReferralsToSync) {
          batch.set(adminDb.collection("referrals").doc(item.fId), item.payload, { merge: true });
        }
        batch.set(
          adminDb.collection("users").doc(supplierId),
          { referralCount: filleulMap.size },
          { merge: true }
        );
        await batch.commit();
      } catch (syncErr) {
        console.warn("[REFERRALS ME] Auto-backfill warning:", syncErr);
      }
    }

    const filleuls = Array.from(filleulMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

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
        referralBalance: Number(userData.referralBalance ?? userData.partnerBalance) || 0,
        referralTotalEarned: Number(userData.referralTotalEarned ?? userData.partnerTotalEarned) || 0,
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
