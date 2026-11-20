import { NextRequest, NextResponse } from "next/server";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";
import { requireFullAdminCaller } from "@/server/guards";

/**
 * GET /api/admin/audit-logs
 * Retourne les 50 dernières actions critiques journalisées sur la plateforme.
 * Réservé strictement à la Direction Générale (Super Admin / Sous-Admin).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireFullAdminCaller(req);
    if (!guard.ok) return guard.errorResponse!;

    await initFirebaseAdmin();
    const limitParam = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get("limit")) || 50));

    let snap;
    try {
      snap = await adminDb
        .collection("audit_logs")
        .orderBy("timestampMs", "desc")
        .limit(limitParam)
        .get();
    } catch {
      snap = await adminDb.collection("audit_logs").limit(limitParam).get();
    }

    const logs = snap.docs
      .map((doc: any) => {
        const d = doc.data() || {};
        const ts =
          typeof d.timestampMs === "number"
            ? d.timestampMs
            : d.createdAt?.toMillis?.() || 0;
        return {
          id: doc.id,
          action: d.action || "UNKNOWN",
          actorUid: d.actorUid || "",
          actorEmail: d.actorEmail || "",
          actorRole: d.actorRole || "",
          targetType: d.targetType || "",
          targetId: d.targetId || null,
          summary: d.summary || "",
          metadata: d.metadata || {},
          timestampMs: ts,
          createdAt: ts ? new Date(ts).toISOString() : null,
        };
      })
      .sort((a: any, b: any) => (b.timestampMs || 0) - (a.timestampMs || 0));

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error("[GET /api/admin/audit-logs ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
