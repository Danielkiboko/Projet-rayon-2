import { NextRequest, NextResponse } from "next/server";
import { resolveReferralCode } from "@/lib/referrals";
import { REFERRAL_DISCOUNT_USD } from "@/lib/referralConfig";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ valid: false, error: "Code manquant" }, { status: 400 });
    }

    const resolved = await resolveReferralCode(code);
    if (!resolved) {
      return NextResponse.json({
        valid: false,
        error: "Code promo ou de parrainage introuvable ou expiré.",
      });
    }

    return NextResponse.json({
      valid: true,
      code: resolved.code,
      ownerName: resolved.ownerName,
      discount: REFERRAL_DISCOUNT_USD,
      message: `Code valide ! Parrainé par ${resolved.ownerName}. Vous bénéficierez de $${REFERRAL_DISCOUNT_USD} de réduction sur votre prochain abonnement.`,
    });
  } catch (error: any) {
    console.error("[REFERRAL VALIDATE ERROR]:", error);
    return NextResponse.json({ valid: false, error: "Erreur lors de la validation du code" }, { status: 500 });
  }
}
