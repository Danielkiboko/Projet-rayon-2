import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const RECOVER_RATE_LIMIT_MAX = 5;
const RECOVER_WINDOW_MS = 60 * 1000;
const recoverIpMap = new Map<string, { count: number; firstAt: number }>();

function isRecoverRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = recoverIpMap.get(ip);
  if (!entry || now - entry.firstAt > RECOVER_WINDOW_MS) {
    recoverIpMap.set(ip, { count: 1, firstAt: now });
    return false;
  }
  if (entry.count >= RECOVER_RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function POST(req: Request) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    if (isRecoverRateLimited(ip)) {
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez réessayer dans une minute." },
        { status: 429 }
      );
    }

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
