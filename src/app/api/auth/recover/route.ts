import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "auth:recover", 5, 60);
    if (rateLimited) return rateLimited;

    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Numéro de téléphone requis." }, { status: 400 });
    }

    const snap = await adminDb
      .collection("users")
      .where("phone", "==", phone.trim())
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Aucun compte trouvé avec ce numéro." }, { status: 404 });
    }

    const userData = snap.docs[0].data();
    const rawEmail = String(userData.email || "");

    return NextResponse.json({
      email: maskEmail(rawEmail),
      masked: true,
    });
  } catch (error: any) {
    console.error("Recover Email Error:", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
