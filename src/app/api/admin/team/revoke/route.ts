import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getServerCaller, SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { recordAuditLog } from "@/server/auditLog";

/**
 * POST /api/admin/team/revoke
 * Révoque COMPLÈTEMENT tous les accès internes Team/Admin d'un collaborateur :
 * 1. Nettoie tous les champs Firestore (role, accountType, isInternalStaff, isAdmin, staffProfile, department, roleTitle)
 * 2. Réinitialise les Custom Claims Firebase Auth ({ role: "CLIENT" })
 * 3. Révoque immédiatement tous les refresh tokens actifs (déconnexion forcée des droits admin)
 * Optionnellement, si deleteAccount === true, supprime définitivement le compte Auth + Firestore.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const isSuperAdmin =
      SUPER_ADMIN_EMAILS.includes(caller.email) ||
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
    const deleteAccount = Boolean(body.deleteAccount);

    if (!userId) {
      return NextResponse.json({ success: false, error: "Identifiant utilisateur manquant." }, { status: 400 });
    }

    const targetRef = adminDb.collection("users").doc(userId);
    const targetSnap = await targetRef.get();
    const targetData = targetSnap.exists ? targetSnap.data() || {} : {};
    const targetEmail = String(targetData.email || "").toLowerCase().trim();
    const targetRole = String(targetData.role || "").toUpperCase();

    if (
      SUPER_ADMIN_EMAILS.includes(targetEmail) ||
      targetRole === "SUPER_ADMIN" ||
      targetRole === "SUPERADMIN" ||
      targetData.isSuperAdmin === true
    ) {
      return NextResponse.json(
        { success: false, error: "Le Super Administrateur ne peut jamais être révoqué ni supprimé." },
        { status: 403 }
      );
    }

    if (deleteAccount) {
      await Promise.all([
        adminAuth.deleteUser(userId).catch((e: any) => {
          if (e?.code !== "auth/user-not-found") console.warn("[team/revoke] deleteUser notice:", e?.message);
        }),
        targetRef.delete().catch((e: any) => console.warn("[team/revoke] doc delete notice:", e?.message)),
      ]);
    } else {
      await Promise.all([
        adminAuth.setCustomUserClaims(userId, { role: "CLIENT" }).catch((e: any) => {
          if (e?.code !== "auth/user-not-found") console.warn("[team/revoke] claims notice:", e?.message);
        }),
        adminAuth.revokeRefreshTokens(userId).catch((e: any) => {
          if (e?.code !== "auth/user-not-found") console.warn("[team/revoke] revokeTokens notice:", e?.message);
        }),
        targetRef.set(
          {
            role: "CLIENT",
            accountType: "CLIENT",
            isInternalStaff: false,
            isAdmin: false,
            isSuperAdmin: false,
            staffProfile: FieldValue.delete(),
            department: FieldValue.delete(),
            roleTitle: FieldValue.delete(),
            revokedAt: FieldValue.serverTimestamp(),
            revokedBy: caller.uid,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      ]);
    }

    recordAuditLog({
      action: deleteAccount ? "USER_DELETED" : "USER_ROLE_REVOKED",
      caller: { uid: caller.uid, email: caller.email, role: caller.role },
      targetType: "user",
      targetId: userId,
      summary: deleteAccount
        ? `Compte Team supprimé définitivement (${targetEmail || userId}).`
        : `Accès Team/Admin intégralement révoqués + tokens invalidés (${targetEmail || userId}).`,
    });

    return NextResponse.json({
      success: true,
      deleteAccount,
      message: deleteAccount
        ? "Compte supprimé définitivement (Auth + Firestore)."
        : "Tous les accès Team/Admin ont été révoqués et la session invalidée.",
    });
  } catch (error: any) {
    console.error("[TEAM REVOKE ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur lors de la révocation." },
      { status: 500 }
    );
  }
}
