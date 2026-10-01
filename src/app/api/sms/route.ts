import { NextResponse } from "next/server";
import { sendMobiShastraSMS } from "@/lib/sms";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

// ─── Rate Limiting (sliding window, en mémoire) ───────────────────────────────
// Max 5 SMS par IP toutes les 60 secondes
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ipWindowMap = new Map<string, { count: number; firstAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindowMap.get(ip);

  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    // Nouvelle fenêtre
    ipWindowMap.set(ip, { count: 1, firstAt: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function POST(request: Request) {
  // ─── 1. Rate limiting ──────────────────────────────────────────────────────
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Trop de requêtes. Réessayez dans 60 secondes." },
      { status: 429 }
    );
  }

  // ─── 2. Authentification Firebase obligatoire ──────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "Authentification requise." },
      { status: 401 }
    );
  }

  try {
    await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch {
    return NextResponse.json(
      { success: false, error: "Token invalide ou expiré." },
      { status: 401 }
    );
  }

  // ─── 3. Logique principale ─────────────────────────────────────────────────
  try {
    const body = await request.json();
    const { phone, message, senderId, customSenderId, supplierId, userId } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Phone number and message are required" },
        { status: 400 }
      );
    }

    // ─── Résolution du Sender ID ─────────────────────────────────────────────
    // Règle métier :
    //   • MUTAMULIS → réservé UNIQUEMENT à M. Laurent (sumaililaurent4@gmail.com)
    //   • "Rayon"   → sender ID par défaut pour toutes les autres actions
    let resolvedSenderId = customSenderId || senderId;

    const targetUid = supplierId || userId;
    if (targetUid) {
      try {
        const uDoc = await adminDb.collection("users").doc(targetUid).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          // Priorité 1 : sender ID enregistré en base pour cet utilisateur
          const storedId = uData?.senderId || uData?.customSenderId || uData?.smsSenderId;
          if (storedId) {
            resolvedSenderId = storedId;
          } else if (uData?.email === "sumaililaurent4@gmail.com") {
            // Priorité 2 : M. Laurent → MUTAMULIS
            resolvedSenderId = "MUTAMULIS";
          }
          // Tous les autres → pas de surcharge, le défaut "Rayon" s'applique ci-dessous
        }
      } catch (err) {
        console.warn("Could not lookup senderId for target:", err);
      }
    }

    // Sender ID final : "Rayon" si aucun sender spécifique n'a été résolu
    if (!resolvedSenderId) {
      resolvedSenderId = "Rayon";
    }

    const result = await sendMobiShastraSMS({
      mobileNo: phone,
      message: message,
      customSenderId: resolvedSenderId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("SMS API Route Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send SMS" },
      { status: 500 }
    );
  }
}
