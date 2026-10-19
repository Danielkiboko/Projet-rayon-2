import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { creditReferralCommission } from "@/lib/referrals";

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const body = await req.json();
    const { filleulId, paymentRef, amountPaid } = body;

    if (!filleulId || !paymentRef) {
      return NextResponse.json(
        { success: false, error: "Identifiants filleulId et paymentRef requis." },
        { status: 400 }
      );
    }

    // Must be admin or the user themselves / parent supplier
    const allowed = caller.isAdmin || caller.uid === filleulId || caller.parentSupplierId === filleulId;
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 403 });
    }

    const result = await creditReferralCommission({
      filleulId,
      paymentRef,
      amountPaid: Number(amountPaid) || 50,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[REFERRALS CREDIT API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
