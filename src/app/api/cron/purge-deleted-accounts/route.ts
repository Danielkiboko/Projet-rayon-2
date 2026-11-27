import { safeApiError } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";
import { purgeUserAccountCompletely } from "@/lib/purgeUserAccount";
import { recordAuditLog } from "@/server/auditLog";

const CRON_SECRET = process.env.CRON_SECRET;

async function executePurge(request: Request) {
  const authHeader = request.headers.get("authorization");
  const hasValidCronSecret =
    Boolean(CRON_SECRET && CRON_SECRET !== "REMPLACEZ_PAR_VOTRE_SECRET") &&
    authHeader === `Bearer ${CRON_SECRET}`;

  if (!hasValidCronSecret) {
    const caller = await getServerCaller(request);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const nowMs = Date.now();
  const pendingSnap = await adminDb
    .collection("users")
    .where("status", "==", "PENDING_DELETION")
    .limit(50)
    .get();

  const purged: Array<{ uid: string; email: string; details: any }> = [];
  const waiting: Array<{ uid: string; scheduledDeletionAt: string }> = [];

  for (const docSnap of pendingSnap.docs) {
    const data = docSnap.data() || {};
    const rawDate = data.scheduledDeletionAt;
    const scheduledMs = rawDate?.toMillis
      ? rawDate.toMillis()
      : rawDate?.seconds
      ? rawDate.seconds * 1000
      : rawDate
      ? new Date(rawDate).getTime()
      : 0;

    if (scheduledMs > 0 && scheduledMs <= nowMs) {
      try {
        const details = await purgeUserAccountCompletely(docSnap.id);
        purged.push({ uid: docSnap.id, email: data.email || "", details });
        recordAuditLog({
          action: "USER_DELETED",
          caller: { uid: "cron", email: "system@rayons.net", role: "SYSTEM" },
          targetType: "supplier",
          targetId: docSnap.id,
          summary: `Purge automatique 15j terminée pour ${data.email || docSnap.id}.`,
          metadata: details,
        });
      } catch (err) {
        console.error(`[purge-deleted-accounts] Failed for ${docSnap.id}:`, err);
      }
    } else if (scheduledMs > nowMs) {
      waiting.push({
        uid: docSnap.id,
        scheduledDeletionAt: new Date(scheduledMs).toISOString(),
      });
    }
  }

  return NextResponse.json({
    success: true,
    checked: pendingSnap.size,
    purgedCount: purged.length,
    waitingCount: waiting.length,
    purged,
    waiting,
  });
}

export async function GET(request: Request) {
  try {
    return await executePurge(request);
  } catch (error: any) {
    console.error("[CRON PURGE DELETED ACCOUNTS ERROR]:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur serveur") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await executePurge(request);
  } catch (error: any) {
    console.error("[CRON PURGE DELETED ACCOUNTS ERROR]:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur serveur") }, { status: 500 });
  }
}
