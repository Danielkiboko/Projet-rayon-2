import { safeApiError } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import { sendMobiShastraSMS } from "@/lib/sms";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  // ─── 1. Rate limiting distribué Redis (max 5 SMS / IP / 60s) ──────────────
  const rateLimited = await enforceRateLimit(request, "api:sms", 5, 60);
  if (rateLimited) return rateLimited;

  // ─── 2. Authentification Firebase & Autorisation Rôle obligatoires ─────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "Authentification requise." },
      { status: 401 }
    );
  }

  let callerUid = "";
  let callerRole = "";
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    callerUid = decoded.uid;
    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    const callerData = callerSnap.exists ? callerSnap.data() || {} : {};
    callerRole = String(callerData.role || decoded.role || "").toUpperCase();
    const allowedSmsRoles = [
      "SUPER_ADMIN", "SUPERADMIN", "ADMIN", "SUB_ADMIN", "STAFF",
      "GESTIONNAIRE_ADMIN", "RESPONSABLE_FINANCIER", "RESPONSABLE_CATALOGUE",
      "RESPONSABLE_LOGISTIQUE", "SUPPORT_CLIENT",
      "ADMIN_FINANCE", "ADMIN_DB", "ADMIN_OPS", "SUPPLIER", "SUPPLIER_IMMO",
      "SUPPLIER_SAVEURS", "SUPPLIER_MODE", "SUPPLIER_CONNECT", "SUB_SUPPLIER",
      "FOURNISSEUR", "PARTNER", "DRIVER", "LIVREUR"
    ];
    if (!allowedSmsRoles.includes(callerRole) && !callerData.isSupplier && !callerData.isAdmin && !callerData.isInternalStaff) {
      return NextResponse.json(
        { success: false, error: "Accès refusé : privilèges insuffisants pour envoyer des SMS." },
        { status: 403 }
      );
    }
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
    return NextResponse.json({ success: false, error: safeApiError(error, "Failed to send SMS") }, { status: 500 });
  }
}
