import { enforceRateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAnyStaffPermission } from "@/server/guards";
import { sendEmail } from "@/lib/email";
import { cacheDel } from "@/lib/cache";

const VALID_RAYONS = ["immo", "mode", "connect", "saveurs"] as const;
type ValidRayon = (typeof VALID_RAYONS)[number];

const RAYON_LABELS: Record<ValidRayon, string> = {
  immo: "Rayons Immo (Immobilier & Hôtellerie)",
  mode: "Rayons Mode (Prêt-à-porter & Accessoires)",
  connect: "Rayons Connect (Technologies & Starlink)",
  saveurs: "Rayons Saveurs (Restauration & Gastronomie)",
};

function roleForPrimaryRayon(rayon: ValidRayon): string {
  switch (rayon) {
    case "immo":
      return "SUPPLIER_IMMO";
    case "mode":
      return "SUPPLIER_MODE";
    case "connect":
      return "SUPPLIER_CONNECT";
    case "saveurs":
      return "SUPPLIER_SAVEURS";
  }
}

function businessTypeForRayon(rayon: ValidRayon): string {
  switch (rayon) {
    case "immo":
      return "IMMOBILIER";
    case "saveurs":
      return "RESTAURATION";
    case "connect":
      return "CONNECT";
    case "mode":
    default:
      return "COMMERCE";
  }
}

/**
 * POST /api/admin/suppliers/approve-application
 * Permet à l'administrateur d'évaluer le projet d'un candidat fournisseur après paiement,
 * de lui attribuer officiellement son (ou ses) rayon(s) — ou de refuser sa demande —
 * et d'envoyer automatiquement une notification in-app + email au candidat.
 */
export async function POST(req: NextRequest) {
  try {
  const _rl = await enforceRateLimit(req, "api:admin_suppliers_approve-application:POST", 40, 60);
  if (_rl) return _rl;
    const guard = await requireAnyStaffPermission(req, ["suppliers.manage"]);
    if (!guard.ok) return guard.errorResponse!;

    const body = await req.json().catch(() => ({}));
    const supplierId = String(body.supplierId || "").trim();
    const action = String(body.action || "approve").toLowerCase() as "approve" | "reject";
    const adminNote = String(body.adminNote || "").trim().slice(0, 600);
    const subscriptionDays = Math.max(1, Math.min(365, Number(body.subscriptionDays) || 30));
    const subscriptionMode = body.subscriptionStatus === "TRIAL" ? "TRIAL" : "ACTIVE";

    if (!supplierId) {
      return NextResponse.json({ success: false, error: "Identifiant candidat manquant." }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(supplierId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: "Utilisateur introuvable." }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const appData = userData.supplierApplication || {};
    const companyName =
      appData.company || userData.companyName || userData.company || userData.displayName || "Votre Boutique";
    const candidateEmail = (appData.email || userData.email || "").trim();
    const candidateName = appData.name || userData.displayName || userData.name || companyName;
    const now = FieldValue.serverTimestamp();
    const nowMs = Date.now();

    if (action === "reject") {
      await userRef.set(
        {
          supplierApplicationStatus: "REJECTED",
          profileUpdateStatus: "REJECTED",
          supplierApplicationRejectionReason: adminNote || "Projet non retenu lors de l'évaluation.",
          supplierApplicationReviewedAt: now,
          supplierApplicationReviewedBy: guard.caller?.uid || "admin",
          updatedAt: now,
        },
        { merge: true }
      );

      // Notification in-app au candidat
      await adminDb.collection("inapp_notifications").add({
        userId: supplierId,
        clientId: supplierId,
        type: "supplier_application_rejected",
        title: "Décision sur votre demande fournisseur",
        message: adminNote
          ? `Votre projet "${companyName}" n'a pas été retenu pour le moment : ${adminNote}`
          : `Votre projet "${companyName}" n'a pas été retenu lors de l'évaluation. Contactez notre support pour plus de détails.`,
        link: "/dashboard/client",
        read: false,
        seen: false,
        time: nowMs,
        createdAt: now,
      });

      // Email non bloquant
      if (candidateEmail) {
        sendEmail({
          to: candidateEmail,
          subject: `Rayons.net — Retour sur votre demande fournisseur (${companyName})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F1D27;">
              <h2 style="color: #0F1D27; margin-bottom: 12px;">Bonjour ${candidateName},</h2>
              <p>Nous avons évalué votre demande d'ouverture de boutique <strong>${companyName}</strong> sur Rayons.net.</p>
              <p style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; border-radius: 8px; color: #991B1B;">
                <strong>Statut :</strong> Demande non retenue pour le moment.<br/>
                ${adminNote ? `<strong>Motif :</strong> ${adminNote}` : ""}
              </p>
              <p>Vous pouvez répondre à cet email ou contacter notre équipe d'assistance depuis votre espace client pour ajuster votre dossier.</p>
              <p style="margin-top: 24px; font-size: 12px; color: #64748B;">L'équipe Rayons.net</p>
            </div>
          `,
        }).catch((e) => console.warn("[approve-application] reject email notice:", e));
      }

      return NextResponse.json({
        success: true,
        action: "reject",
        message: `Demande de "${companyName}" refusée et candidat notifié.`,
      });
    }

    // ── APPROBATION & ATTRIBUTION OFFICIELLE DU RAYON PAR L'ADMIN ──
    const rawRayons: string[] = Array.isArray(body.assignedRayons)
      ? body.assignedRayons
      : body.rayon
      ? [String(body.rayon)]
      : [];

    const validRayons = Array.from(
      new Set(
        rawRayons
          .map((r) => String(r).toLowerCase().trim())
          .filter((r): r is ValidRayon => (VALID_RAYONS as readonly string[]).includes(r))
      )
    );

    if (validRayons.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Veuillez sélectionner au moins un rayon (Immo, Mode, Connect ou Saveurs) à attribuer.",
        },
        { status: 400 }
      );
    }

    const primaryRayon = validRayons[0];
    const targetRole = roleForPrimaryRayon(primaryRayon);
    const businessType = businessTypeForRayon(primaryRayon);
    const rayonNamesList = validRayons.map((r) => RAYON_LABELS[r]).join(", ");

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + subscriptionDays);

    // 1. Mettre à jour Firebase Auth Custom Claims pour que le client bascule immédiatement côté AuthContext
    try {
      const currentAuthUser = await adminAuth.getUser(supplierId);
      const existingClaims = currentAuthUser.customClaims || {};
      // Ne jamais écraser un Super Admin qui teste
      if (String(existingClaims.role || "").toUpperCase() !== "SUPER_ADMIN") {
        await adminAuth.setCustomUserClaims(supplierId, {
          ...existingClaims,
          role: targetRole,
        });
      }
    } catch (authErr) {
      console.warn("[approve-application] setCustomUserClaims notice:", authErr);
    }

    const preservedSuperAdmin =
      String(userData.role || "").toUpperCase() === "SUPER_ADMIN" || userData.isSuperAdmin === true;

    const pending = userData.pendingProfile || {};

    // 2. Mettre à jour users/{supplierId} & suppliers/{supplierId}
    const batch = adminDb.batch();

    batch.set(
      userRef,
      {
        ...pending,
        pendingProfile: null,
        role: preservedSuperAdmin ? userData.role : targetRole,
        accountType: preservedSuperAdmin ? userData.accountType : "SUPPLIER",
        isSupplier: true,
        rayon: primaryRayon,
        assignedRayons: validRayons,
        serviceAttached: primaryRayon,
        businessType,
        companyName,
        company: companyName,
        status: "active",
        supplierApplicationStatus: "APPROVED",
        profileUpdateStatus: "APPROVED",
        kycStatus: "VERIFIED",
        kycVerifiedAt: new Date().toISOString(),
        subscriptionStatus: subscriptionMode,
        subscriptionEndDate: endDate,
        isBlocked: false,
        isSuspended: false,
        approvedAt: now,
        approvedBy: guard.caller?.uid || "admin",
        adminApprovalNote: adminNote || null,
        updatedAt: now,
      },
      { merge: true }
    );

    const supplierRef = adminDb.collection("suppliers").doc(supplierId);
    batch.set(
      supplierRef,
      {
        email: candidateEmail,
        displayName: companyName,
        companyName,
        rayon: primaryRayon,
        assignedRayons: validRayons,
        businessType,
        status: "active",
        kycStatus: "VERIFIED",
        isBlocked: false,
        approvedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // 3. Notification in-app pour le nouveau fournisseur
    const notifRef = adminDb.collection("inapp_notifications").doc();
    batch.set(notifRef, {
      userId: supplierId,
      supplierId,
      clientId: supplierId,
      type: "supplier_approved",
      title: `🎉 Boutique approuvée — ${RAYON_LABELS[primaryRayon]}`,
      message: `Félicitations ! Votre projet "${companyName}" a été validé par l'administration Rayons.net. Votre rayon attribué est : ${rayonNamesList}. Accédez dès maintenant à votre Espace Fournisseur.${adminNote ? ` Note : ${adminNote}` : ""}`,
      link: "/supplier",
      read: false,
      seen: false,
      time: nowMs,
      createdAt: now,
    });

    // 4. Trace d'audit
    const auditRef = adminDb.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "SUPPLIER_APPLICATION_APPROVED",
      actorId: guard.caller?.uid || "admin",
      actorEmail: guard.caller?.email || "",
      targetId: supplierId,
      targetName: companyName,
      assignedRayons: validRayons,
      roleAssigned: targetRole,
      subscriptionDays,
      adminNote: adminNote || null,
      createdAt: now,
    });

    await batch.commit();
    await cacheDel("admin:suppliers:list:v1");

    // 5. Email officiel de bienvenue & attribution de rayon (non bloquant)
    if (candidateEmail) {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");
      sendEmail({
        to: candidateEmail,
        subject: `🎉 Félicitations ! Votre boutique "${companyName}" est active sur Rayons.net`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0F1D27; background: #F8FAFC;">
            <div style="background: #0F1D27; color: #FFFFFF; padding: 20px 24px; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; font-size: 20px; color: #C7D300;">Rayons.net — Espace Fournisseur Activé</h1>
            </div>
            <div style="background: #FFFFFF; padding: 24px; border-radius: 0 0 16px 16px; border: 1px solid #E2E8F0;">
              <p>Bonjour <strong>${candidateName}</strong>,</p>
              <p>Après évaluation de votre projet <strong>${companyName}</strong>, notre administration a le plaisir de vous annoncer que votre boutique est désormais <strong>officiellement approuvée et active</strong> !</p>
              <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 14px 16px; border-radius: 12px; margin: 16px 0;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #065F46;"><strong>Rayon attribué :</strong> ${rayonNamesList}</p>
                <p style="margin: 0; font-size: 13px; color: #065F46;"><strong>Validité :</strong> ${subscriptionDays} jours (${subscriptionMode === "TRIAL" ? "Essai" : "Abonnement Actif"})</p>
                ${adminNote ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #065F46;"><strong>Message de l'équipe :</strong> ${adminNote}</p>` : ""}
              </div>
              <p style="margin: 20px 0;">
                <a href="${siteUrl}/supplier" style="display: inline-block; background: #FF6600; color: #FFFFFF; text-decoration: none; font-weight: bold; padding: 12px 22px; border-radius: 10px;">
                  Accéder à mon Espace Fournisseur →
                </a>
              </p>
              <p style="font-size: 12px; color: #64748B;">Astuce : si vous étiez déjà connecté en tant que client, rafraîchissez simplement la page ou reconnectez-vous pour ouvrir votre tableau de bord vendeur.</p>
            </div>
          </div>
        `,
      }).catch((e) => console.warn("[approve-application] email notice:", e));
    }

    return NextResponse.json({
      success: true,
      action: "approve",
      supplierId,
      assignedRayons: validRayons,
      role: targetRole,
      message: `Projet "${companyName}" approuvé ! Rayon attribué : ${rayonNamesList}. Le fournisseur a été notifié.`,
    });
  } catch (error: any) {
    console.error("[APPROVE SUPPLIER APPLICATION ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur lors de l'approbation." },
      { status: 500 }
    );
  }
}
