import { FieldValue } from "firebase-admin/firestore";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";
import type { ServerCaller } from "@/lib/serverAuth";

export type AuditAction =
  | "SETTINGS_UPDATED"
  | "FINANCIAL_PROPOSAL_CREATED"
  | "FINANCIAL_PROPOSAL_APPROVED"
  | "FINANCIAL_PROPOSAL_REJECTED"
  | "COMMISSION_CREDITED"
  | "REFERRAL_PAYOUT"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_PAYMENT_RECORDED"
  | "SUBSCRIPTION_REQUEST_APPROVED"
  | "SUBSCRIPTION_REQUEST_REJECTED"
  | "USER_ROLE_PROMOTED"
  | "USER_ROLE_REVOKED"
  | "USER_DELETED"
  | "BROADCAST_SENT"
  | "PUSH_CAMPAIGN_SENT";

export interface AuditLogInput {
  action: AuditAction;
  caller: Pick<ServerCaller, "uid" | "email" | "role"> | { uid: string; email: string; role: string };
  targetType: "user" | "supplier" | "partner" | "settings" | "commission" | "broadcast" | "campaign";
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown> | object;
}

/**
 * Enregistre de manière asynchrone et non bloquante (0ms de latence ajoutée à la réponse HTTP)
 * une entrée immuable dans la collection Firestore `audit_logs` (écriture Admin SDK uniquement).
 */
export function recordAuditLog(entry: AuditLogInput): void {
  void (async () => {
    try {
      await initFirebaseAdmin();
      await adminDb.collection("audit_logs").add({
        action: entry.action,
        actorUid: entry.caller.uid || "unknown",
        actorEmail: entry.caller.email || "",
        actorRole: entry.caller.role || "ADMIN",
        targetType: entry.targetType,
        targetId: entry.targetId || null,
        summary: String(entry.summary || "").slice(0, 400),
        metadata: entry.metadata || {},
        createdAt: FieldValue.serverTimestamp(),
        timestampMs: Date.now(),
      });
    } catch (err) {
      console.warn("[auditLog] Failed to persist audit entry:", err);
    }
  })();
}
