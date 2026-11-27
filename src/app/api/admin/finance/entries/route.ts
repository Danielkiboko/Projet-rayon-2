import { enforceRateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAnyStaffPermission, isProtectedSuperAdminEmail } from "@/server/guards";
import { SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";

/**
 * POST /api/admin/finance/entries
 * Route serveur sécurisée & immuable pour enregistrer des écritures comptables manuelles
 * et des ajustements de caisse dans la comptabilité Plateforme Admin (`PLATFORM_ADMIN`).
 *
 * Sécurité :
 * - Aucun client navigateur ne peut écrire directement dans `accounting_ledger` ni `transactions`.
 * - Les ajustements de caisse et sorties de caisse exigent le statut Super Admin / Directeur Général
 *   (principe anti-fraude).
 * - Toute opération génère une entrée atomique dans `accounting_ledger`, `transactions` et `audit_logs`.
 */
export async function POST(req: NextRequest) {
  try {
  const _rl = await enforceRateLimit(req, "api:admin_finance_entries:POST", 40, 60);
  if (_rl) return _rl;
    const guard = await requireAnyStaffPermission(req, ["finance.cash", "finance.view"]);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;
    const caller = guard.caller;

    const body = await req.json();
    const {
      kind,
      amount,
      reason = "",
      label = "",
      referencePiece = "",
      currency = "USD",
      accountingScope = "PLATFORM_ADMIN",
    } = body as {
      kind: "ADJUSTMENT" | "EXPENSE" | "OTHER_INCOME";
      amount: number;
      reason?: string;
      label: string;
      referencePiece?: string;
      currency?: string;
      accountingScope?: "PLATFORM_ADMIN" | "ADMIN_IMMO";
    };

    const allowedKinds = ["ADJUSTMENT", "EXPENSE", "OTHER_INCOME"];
    if (!allowedKinds.includes(kind)) {
      return NextResponse.json(
        { success: false, error: "Type d'écriture comptable non reconnu." },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0 || Math.abs(numericAmount) > 1_000_000) {
      return NextResponse.json(
        { success: false, error: "Montant invalide (doit être non nul et inférieur à 1 000 000 USD)." },
        { status: 400 }
      );
    }

    const cleanLabel = String(label || "").trim();
    const cleanReason = String(reason || "").trim();
    const cleanRef = String(referencePiece || "").trim();

    if (cleanLabel.length < 3 || cleanLabel.length > 240) {
      return NextResponse.json(
        { success: false, error: "Un libellé comptable précis (3 à 240 caractères) est obligatoire." },
        { status: 400 }
      );
    }

    if (kind === "ADJUSTMENT" && cleanReason.length < 3) {
      return NextResponse.json(
        { success: false, error: "Un motif d'ajustement est obligatoire." },
        { status: 400 }
      );
    }

    // Contrôle anti-fraude : les ajustements de caisse et sorties (prélèvements / dépenses) sont réservés au Super Admin / DG
    const callerEmail = String(caller.email || "").toLowerCase().trim();
    const callerRole = String(caller.role || "").toUpperCase().trim();
    const isSuper =
      Boolean((caller as any).isSuperAdmin) ||
      callerRole === "SUPER_ADMIN" ||
      isProtectedSuperAdminEmail(callerEmail);

    const isOutflow = kind === "EXPENSE" || (kind === "ADJUSTMENT" && numericAmount < 0);
    if ((kind === "ADJUSTMENT" || isOutflow) && !isSuper) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sécurité anti-fraude : seuls le Directeur Général (Super Admin) peut effectuer des ajustements ou sorties de caisse.",
        },
        { status: 403 }
      );
    }

    const signedAmount =
      kind === "EXPENSE"
        ? -Math.abs(numericAmount)
        : kind === "OTHER_INCOME"
        ? Math.abs(numericAmount)
        : numericAmount;

    const isPositive = signedAmount > 0;
    const absAmount = Math.abs(signedAmount);
    const year = new Date().getFullYear();
    const entryNumber = `ECR-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
    const finalRef =
      cleanRef ||
      `${kind === "ADJUSTMENT" ? "AJUST" : kind === "EXPENSE" ? "DEP" : "REC"}-${year}-${Math.floor(
        10000 + Math.random() * 90000
      )}`;

    const journal = kind === "ADJUSTMENT" ? "AJ" : "CS";
    const journalName =
      kind === "ADJUSTMENT"
        ? "Journal des Ajustements de Caisse"
        : "Journal de Caisse Plateforme";

    const fullLabel =
      kind === "ADJUSTMENT"
        ? `Ajustement de caisse [${cleanReason}] — ${cleanLabel}`
        : cleanLabel;

    const safeScope = accountingScope === "ADMIN_IMMO" ? "ADMIN_IMMO" : "PLATFORM_ADMIN";
    const now = FieldValue.serverTimestamp();

    // Anti-doublon si l'utilisateur fournit explicitement un numéro de pièce justificative
    const refLockId = cleanRef
      ? `entry_${cleanRef.toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 80)}`
      : null;

    await adminDb.runTransaction(async (tx: any) => {
      if (refLockId) {
        const lockRef = adminDb.collection("subscription_payments").doc(refLockId);
        const lockSnap = await tx.get(lockRef);
        if (lockSnap.exists) {
          throw new Error("DUPLICATE_REFERENCE");
        }
        tx.set(lockRef, {
          kind,
          referencePiece: finalRef,
          amount: absAmount,
          signedAmount,
          accountingScope: safeScope,
          recordedBy: callerEmail || caller.uid,
          recordedByUid: caller.uid,
          createdAt: now,
        });
      }

      const ledgerRef = adminDb.collection("accounting_ledger").doc();
      tx.set(ledgerRef, {
        entryNumber,
        date: now,
        createdAt: now,
        journal,
        journalName,
        referencePiece: finalRef,
        label: fullLabel,
        debit: isPositive ? absAmount : 0,
        credit: !isPositive ? absAmount : 0,
        currency: String(currency || "USD").toUpperCase().slice(0, 6),
        actorType: "ADMIN",
        accountingScope: safeScope,
        supplierId: null,
        supplierName: "Rayons.net Plateforme",
        adjustmentReason: cleanReason || null,
        category:
          kind === "ADJUSTMENT"
            ? isPositive
              ? "Ajustement Créditeur"
              : "Ajustement Débiteur"
            : kind === "EXPENSE"
            ? "Dépense Plateforme"
            : "Recette Plateforme",
        status: "VALIDATED",
        recordedBy: callerEmail || caller.uid,
        recordedByUid: caller.uid,
      });

      const txRef = adminDb.collection("transactions").doc();
      tx.set(txRef, {
        type: isPositive ? "OTHER_INCOME" : "EXPENSE",
        category:
          kind === "ADJUSTMENT"
            ? `Ajustement: ${cleanReason}`
            : kind === "EXPENSE"
            ? "Dépense Plateforme"
            : "Recette Plateforme",
        amount: absAmount,
        currency: String(currency || "USD").toUpperCase().slice(0, 6),
        description: fullLabel,
        referenceId: finalRef,
        accountingScope: safeScope,
        status: "COMPLETED",
        recordedBy: callerEmail || caller.uid,
        recordedByUid: caller.uid,
        createdAt: now,
      });

      const auditRef = adminDb.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: kind === "ADJUSTMENT" ? "FINANCE_CASH_ADJUSTMENT" : "FINANCE_MANUAL_ENTRY",
        category: "FINANCE",
        actorUid: caller.uid,
        actorEmail: callerEmail || null,
        actorRole: callerRole || null,
        entryNumber,
        referencePiece: finalRef,
        amount: signedAmount,
        currency: String(currency || "USD").toUpperCase().slice(0, 6),
        label: fullLabel,
        reason: cleanReason || null,
        accountingScope: safeScope,
        createdAt: now,
      });
    });

    return NextResponse.json({
      success: true,
      entryNumber,
      referencePiece: finalRef,
      message:
        kind === "ADJUSTMENT"
          ? `Ajustement de caisse (${isPositive ? "+" : "-"}$${absAmount.toFixed(2)}) enregistré et audité (${entryNumber}).`
          : `Écriture comptable (${isPositive ? "+" : "-"}$${absAmount.toFixed(2)}) enregistrée dans le Grand Livre (${entryNumber}).`,
    });
  } catch (error: any) {
    if (error?.message === "DUPLICATE_REFERENCE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cette référence de pièce justificative a déjà été enregistrée. Doublon bloqué par sécurité.",
        },
        { status: 409 }
      );
    }
    console.error("[ADMIN FINANCE ENTRIES ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur serveur lors de l'enregistrement comptable." },
      { status: 500 }
    );
  }
}
