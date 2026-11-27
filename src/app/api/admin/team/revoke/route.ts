import { isProtectedSuperAdminEmail } from "@/server/guards";
import { enforceRateLimit } from "@/lib/rateLimit";
import { safeApiError } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller, SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { recordAuditLog } from "@/server/auditLog";
import { purgeUserAccountCompletely } from "@/lib/purgeUserAccount";

/**
 * POST /api/admin/team/revoke
 * Supprime immédiatement et définitivement un membre Team (Firebase Auth + Firestore + tokens + push_devices).
 * Aucun résidu en tant que Client : le compte disparaît totalement et ne peut plus se connecter.
 */
export async function POST(req: NextRequest) {
  try {
  const _rl = await enforceRateLimit(req, "api:admin_team_revoke:POST", 40, 60);
  if (_rl) return _rl;
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const isSuperAdmin =
      isProtectedSuperAdminEmail(caller.email) ||
      caller.role === "SUPER_ADMIN" ||
      caller.role === "SUPERADMIN" ||
      caller.data?.isSuperAdmin === true;

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "Action réservée au Super Administrateur." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return NextResponse.json({ success: false, error: "Identifiant utilisateur manquant." }, { status: 400 });
    }

    const targetRef = adminDb.collection("users").doc(userId);
    const targetSnap = await targetRef.get();
    const targetData = targetSnap.exists ? targetSnap.data() || {} : {};
    const targetEmail = String(targetData.email || "").toLowerCase().trim();
    const targetRole = String(targetData.role || "").toUpperCase();

    if (
      isProtectedSuperAdminEmail(targetEmail) ||
      targetRole === "SUPER_ADMIN" ||
      targetRole === "SUPERADMIN" ||
      targetData.isSuperAdmin === true
    ) {
      return NextResponse.json(
        { success: false, error: "Le Super Administrateur ne peut jamais être révoqué ni supprimé." },
        { status: 403 }
      );
    }

    const purgeResult = await purgeUserAccountCompletely(userId);

    recordAuditLog({
      action: "USER_DELETED",
      caller: { uid: caller.uid, email: caller.email, role: caller.role },
      targetType: "user",
      targetId: userId,
      summary: `Compte Team supprimé définitivement et purgé (${targetEmail || userId}).`,
      metadata: purgeResult,
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      purgeResult,
      message: "Compte supprimé définitivement (Firebase Auth, Firestore, sessions et appareils purgés).",
    });
  } catch (error: any) {
    console.error("[TEAM REVOKE/DELETE ERROR]:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur lors de la suppression.") }, { status: 500 });
  }
}
