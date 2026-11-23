import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getServerCaller, SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { sendEmail } from "@/lib/email";
import { recordAuditLog } from "@/server/auditLog";

const GRACE_PERIOD_DAYS = 15;

/**
 * POST /api/supplier/delete-account
 * Permet à un fournisseur de demander lui-même la suppression de son compte.
 * - action: "request" (défaut) -> masque immédiatement la boutique et ses articles,
 *   et planifie l'effacement définitif de toutes les données centrales dans 15 jours.
 * - action: "cancel" -> annule la demande pendant les 15 jours et restaure la boutique.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    if (SUPER_ADMIN_EMAILS.includes(caller.email) || caller.role === "SUPER_ADMIN" || caller.role === "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Le compte Super Administrateur ne peut pas être supprimé depuis cette interface." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "request").toLowerCase();
    const reason = String(body.reason || "").trim().slice(0, 500);

    const uid = caller.uid;
    const userRef = adminDb.collection("users").doc(uid);
    const supplierRef = adminDb.collection("suppliers").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const companyName = userData.companyName || userData.company || userData.displayName || caller.email || "Fournisseur";
    const now = FieldValue.serverTimestamp();

    // ── ANNULATION DANS LE DÉLAI DE GRÂCE DE 15 JOURS ──
    if (action === "cancel") {
      if (userData.status !== "PENDING_DELETION") {
        return NextResponse.json(
          { success: false, error: "Aucune demande de suppression n'est en cours sur ce compte." },
          { status: 400 }
        );
      }

      const batch = adminDb.batch();
      batch.set(
        userRef,
        {
          status: "active",
          isBlocked: false,
          isHidden: false,
          deletionRequestedAt: FieldValue.delete(),
          scheduledDeletionAt: FieldValue.delete(),
          deletionReason: FieldValue.delete(),
          deletionCancelledAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
      batch.set(
        supplierRef,
        {
          status: "active",
          isBlocked: false,
          isHidden: false,
          scheduledDeletionAt: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );

      // Restaurer les produits/biens qui avaient été masqués par la demande de suppression
      const [prodsSnap, propsSnap] = await Promise.all([
        adminDb.collection("products").where("supplierId", "==", uid).where("status", "==", "ARCHIVED_DELETION").limit(150).get().catch(() => null),
        adminDb.collection("properties").where("supplierId", "==", uid).where("status", "==", "ARCHIVED_DELETION").limit(150).get().catch(() => null),
      ]);

      prodsSnap?.forEach((d: any) => batch.update(d.ref, { status: "Disponible", isHidden: false, updatedAt: now }));
      propsSnap?.forEach((d: any) => batch.update(d.ref, { status: "Disponible", isHidden: false, updatedAt: now }));

      await batch.commit();

      return NextResponse.json({
        success: true,
        action: "cancel",
        message: "Votre demande de suppression a été annulée. Votre boutique et vos articles sont de nouveau actifs.",
      });
    }

    // ── DEMANDE DE SUPPRESSION AVEC DÉLAI DE GRÂCE DE 15 JOURS ──
    const scheduledDeletionAt = new Date();
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + GRACE_PERIOD_DAYS);
    const formattedDate = scheduledDeletionAt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const batch = adminDb.batch();
    batch.set(
      userRef,
      {
        status: "PENDING_DELETION",
        isBlocked: true,
        isHidden: true,
        deletionRequestedAt: now,
        scheduledDeletionAt,
        deletionGraceDays: GRACE_PERIOD_DAYS,
        deletionReason: reason || null,
        updatedAt: now,
      },
      { merge: true }
    );
    batch.set(
      supplierRef,
      {
        status: "PENDING_DELETION",
        isBlocked: true,
        isHidden: true,
        deletionRequestedAt: now,
        scheduledDeletionAt,
        updatedAt: now,
      },
      { merge: true }
    );

    // Masquer immédiatement les produits & biens immobiliers du fournisseur sur la marketplace
    const [prodsSnap, propsSnap] = await Promise.all([
      adminDb.collection("products").where("supplierId", "==", uid).limit(150).get().catch(() => null),
      adminDb.collection("properties").where("supplierId", "==", uid).limit(150).get().catch(() => null),
    ]);

    prodsSnap?.forEach((d: any) => {
      batch.update(d.ref, { status: "ARCHIVED_DELETION", isHidden: true, updatedAt: now });
    });
    propsSnap?.forEach((d: any) => {
      batch.update(d.ref, { status: "ARCHIVED_DELETION", isHidden: true, updatedAt: now });
    });

    await batch.commit();

    // Notifier les admins
    try {
      const adminsSnap = await adminDb
        .collection("users")
        .where("role", "in", ["SUPER_ADMIN", "superAdmin", "ADMIN", "SUB_ADMIN"])
        .limit(8)
        .get();
      const nowMs = Date.now();
      await Promise.allSettled(
        adminsSnap.docs.map((aDoc: any) =>
          adminDb.collection("inapp_notifications").add({
            userId: aDoc.id,
            type: "supplier_deletion_request",
            title: `🗑️ Auto-suppression demandée : ${companyName}`,
            message: `${companyName} a demandé la suppression de son compte. Effacement définitif programmé le ${formattedDate} (15 jours).${reason ? ` Motif : ${reason}` : ""}`,
            link: "/admin/suppliers",
            read: false,
            seen: false,
            time: nowMs,
            createdAt: now,
          })
        )
      );
    } catch (notifErr) {
      console.warn("[supplier/delete-account] admin notif warning:", notifErr);
    }

    // Email de confirmation au fournisseur (non bloquant)
    if (caller.email) {
      sendEmail({
        to: caller.email,
        subject: `Rayons.net — Suppression de votre compte programmée (${formattedDate})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F1D27;">
            <h2 style="margin-bottom: 12px;">Demande de suppression enregistrée</h2>
            <p>Bonjour <strong>${companyName}</strong>,</p>
            <p>Nous confirmons la prise en compte de votre demande de suppression de compte fournisseur sur <strong>Rayons.net</strong>.</p>
            <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0;"><strong>Boutique & articles :</strong> désactivés et masqués immédiatement.</p>
              <p style="margin: 0;"><strong>Effacement définitif de la base de données centrale :</strong> le <strong>${formattedDate}</strong> (délai de grâce de ${GRACE_PERIOD_DAYS} jours).</p>
            </div>
            <p>Si vous changez d'avis avant cette date, il vous suffit de vous reconnecter à votre espace Paramètres pour annuler la suppression.</p>
            <p style="margin-top: 24px; font-size: 12px; color: #64748B;">L'équipe Rayons.net</p>
          </div>
        `,
      }).catch((e) => console.warn("[supplier/delete-account] email warning:", e));
    }

    // Révoquer les anciens tokens des autres appareils (l'utilisateur peut toujours se reconnecter dans les 15j pour annuler)
    await adminAuth.revokeRefreshTokens(uid).catch(() => {});

    recordAuditLog({
      action: "USER_DELETED",
      caller: { uid: caller.uid, email: caller.email, role: caller.role },
      targetType: "supplier",
      targetId: uid,
      summary: `Auto-suppression fournisseur demandée (${companyName}) — purge définitive prévue le ${formattedDate} (15 jours).`,
      metadata: { scheduledDeletionAt: scheduledDeletionAt.toISOString(), reason: reason || null },
    });

    return NextResponse.json({
      success: true,
      action: "request",
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      graceDays: GRACE_PERIOD_DAYS,
      message: `Votre demande de suppression est enregistrée. Vos données seront définitivement effacées le ${formattedDate} (15 jours).`,
    });
  } catch (error: any) {
    console.error("[SUPPLIER DELETE ACCOUNT ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur lors de la demande de suppression." },
      { status: 500 }
    );
  }
}
