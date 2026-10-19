import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { ensureReferralCode } from "@/lib/referrals";
import { buildReferralLink, REFERRAL_INVITES_PER_DAY } from "@/lib/referralConfig";
import { inviteEmail } from "@/lib/referralEmails";
import { sendEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const supplierId = caller.parentSupplierId || caller.uid;
    const body = await req.json();
    const { emails, personalMessage } = body;

    let targetEmails: string[] = [];
    if (Array.isArray(emails)) {
      targetEmails = emails.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes("@"));
    } else if (typeof emails === "string") {
      targetEmails = emails
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"));
    }

    if (targetEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: "Veuillez renseigner au moins une adresse email valide." },
        { status: 400 }
      );
    }

    // Rate-limiting check for today
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentInvitesSnap = await adminDb
      .collection("referral_invites")
      .where("referrerId", "==", supplierId)
      .where("sentAt", ">=", oneDayAgo)
      .get();

    if (recentInvitesSnap.size + targetEmails.length > REFERRAL_INVITES_PER_DAY) {
      const remaining = Math.max(0, REFERRAL_INVITES_PER_DAY - recentInvitesSnap.size);
      return NextResponse.json(
        {
          success: false,
          error: `Limite d'envoi atteinte. Vous pouvez encore envoyer ${remaining} invitation(s) aujourd'hui (max ${REFERRAL_INVITES_PER_DAY}/jour).`,
        },
        { status: 429 }
      );
    }

    const code = await ensureReferralCode(supplierId);
    const link = buildReferralLink(code);

    const userSnap = await adminDb.collection("users").doc(supplierId).get();
    const uData = userSnap.data() || {};
    const referrerName = (uData.company || uData.displayName || uData.name || caller.email || "Un partenaire").trim();

    let sentCount = 0;
    let failedCount = 0;

    for (const email of targetEmails) {
      // Don't invite oneself
      if (email === (caller.email || "").toLowerCase() || email === (uData.email || "").toLowerCase()) {
        continue;
      }

      try {
        const mailContent = inviteEmail({
          referrerName,
          code,
          link,
          personalMessage: personalMessage ? String(personalMessage).trim() : undefined,
        });

        await sendEmail({
          to: email,
          subject: mailContent.subject,
          html: mailContent.html,
        });

        await adminDb.collection("referral_invites").add({
          referrerId: supplierId,
          referrerName,
          email,
          code,
          status: "SENT",
          sentAt: FieldValue.serverTimestamp(),
        });

        sentCount++;
      } catch (err) {
        console.error(`[INVITE EMAIL ERROR] ${email}:`, err);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      message: `${sentCount} invitation(s) envoyée(s) avec succès avec votre code ${code} !`,
    });
  } catch (error: any) {
    console.error("[REFERRALS INVITE API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
