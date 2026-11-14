import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminCaller } from "@/server/guards";
import { adminDb } from "@/lib/firebase-admin";
import { getAccountType, AccountType } from "@/domain/roles";
import { StaffPosition, resolveStaffPermissions } from "@/domain/permissions";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdminCaller(req);
    if (!guard.ok) return guard.errorResponse!;

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "apply" ? "apply" : "dry-run";

    const usersSnap = await adminDb.collection("users").get();

    const summary = {
      totalUsers: usersSnap.size,
      byAccountType: {
        CLIENT: 0,
        SUPPLIER: 0,
        SUB_SUPPLIER: 0,
        PARTNER: 0,
        STAFF: 0,
        DRIVER: 0,
      } as Record<AccountType, number>,
      partnersCleanedOfRayons: 0,
      staffCleanedOfRayons: 0,
      suppliersVerified: 0,
      actionsToPerform: [] as any[],
    };

    const batchSize = 400;
    let currentBatch = adminDb.batch();
    let batchCount = 0;

    for (const doc of usersSnap.docs) {
      const data = doc.data() || {};
      const targetType = getAccountType(data);
      summary.byAccountType[targetType] += 1;

      const updates: Record<string, any> = {
        accountType: targetType,
      };

      let needsUpdate = data.accountType !== targetType;

      // 1. Partenaires : AUCUN RAYON, AUCUNE BOUTIQUE
      if (targetType === "PARTNER") {
        updates.isPartner = true;
        updates.isSupplier = false;
        updates.role = "PARTNER";

        // Nettoyage impératif des champs fournisseur
        if (data.rayon || data.assignedRayons || data.serviceAttached || data.companyName) {
          updates.rayon = FieldValue.delete();
          updates.assignedRayons = FieldValue.delete();
          updates.serviceAttached = FieldValue.delete();
          updates.companyName = FieldValue.delete();
          summary.partnersCleanedOfRayons += 1;
          needsUpdate = true;
        }

        // Structure partnerProfile
        const partnerProfile = {
          partnerCode: data.partnerCode || data.referralCode || `RAY-PART${doc.id.slice(-4).toUpperCase()}`,
          referralCode: data.partnerCode || data.referralCode || `RAY-PART${doc.id.slice(-4).toUpperCase()}`,
          balance: Number(data.partnerBalance || data.referralBalance || 0),
          totalEarned: Number(data.partnerTotalEarned || data.referralTotalEarned || 0),
          recruitedSuppliersCount: Number(data.recruitedSuppliersCount || 0),
        };
        updates.partnerProfile = partnerProfile;
        updates.partnerCode = partnerProfile.partnerCode;
        updates.referralCode = partnerProfile.referralCode;
      }

      // 2. Staff / Équipe Interne : AUCUN RAYON, ORGANISÉ PAR POSTES & TÂCHES
      else if (targetType === "STAFF") {
        updates.isInternalStaff = true;
        updates.isSupplier = false;
        updates.isPartner = false;

        // Nettoyage impératif des champs fournisseur
        if (data.rayon || data.assignedRayons || data.serviceAttached) {
          updates.rayon = FieldValue.delete();
          updates.assignedRayons = FieldValue.delete();
          updates.serviceAttached = FieldValue.delete();
          summary.staffCleanedOfRayons += 1;
          needsUpdate = true;
        }

        // Déduire les postes par défaut selon l'ancien rôle
        const roleUpper = String(data.role || "").toUpperCase();
        const positions: StaffPosition[] = [];

        if (roleUpper.includes("SUPER")) {
          positions.push("SUB_ADMIN");
        } else if (roleUpper.includes("FINANCE")) {
          positions.push("RESPONSABLE_FINANCIER");
        } else if (roleUpper.includes("DB") || roleUpper.includes("TECH")) {
          positions.push("RESPONSABLE_CATALOGUE");
        } else if (roleUpper.includes("OPS")) {
          positions.push("RESPONSABLE_LOGISTIQUE");
        } else {
          positions.push("SUB_ADMIN");
        }

        const existingProfile = data.staffProfile || {};
        const staffPositions = Array.isArray(existingProfile.positions) && existingProfile.positions.length > 0 
          ? existingProfile.positions 
          : positions;

        const staffPermissions = Array.isArray(existingProfile.permissions) && existingProfile.permissions.length > 0
          ? existingProfile.permissions
          : resolveStaffPermissions(staffPositions);

        updates.staffProfile = {
          positions: staffPositions,
          permissions: staffPermissions,
          department: data.department || "Administration Centrale",
        };
      }

      // 3. Fournisseurs : LE SEUL TYPE AYANT UN RAYON
      else if (targetType === "SUPPLIER" || targetType === "SUB_SUPPLIER") {
        updates.isSupplier = true;
        updates.isPartner = false;
        summary.suppliersVerified += 1;

        // S'assurer qu'un rayon par défaut existe
        if (!data.rayon && (!Array.isArray(data.assignedRayons) || data.assignedRayons.length === 0)) {
          updates.rayon = "connect";
          updates.assignedRayons = ["connect"];
          needsUpdate = true;
        }
      }

      // 4. Clients : Particuliers sans rayon
      else if (targetType === "CLIENT") {
        updates.isSupplier = false;
        updates.isPartner = false;
        updates.isInternalStaff = false;
        if (data.assignedRayons && data.assignedRayons.length === 0) {
          updates.assignedRayons = FieldValue.delete();
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        summary.actionsToPerform.push({
          uid: doc.id,
          email: data.email || "Sans email",
          oldRole: data.role || "N/A",
          targetType,
          updatesKeys: Object.keys(updates),
        });

        if (mode === "apply") {
          currentBatch.set(doc.ref, updates, { merge: true });
          batchCount++;

          if (batchCount >= batchSize) {
            await currentBatch.commit();
            currentBatch = adminDb.batch();
            batchCount = 0;
          }
        }
      }
    }

    if (mode === "apply" && batchCount > 0) {
      await currentBatch.commit();
    }

    return NextResponse.json({
      success: true,
      mode,
      summary: {
        totalUsers: summary.totalUsers,
        byAccountType: summary.byAccountType,
        partnersCleanedOfRayons: summary.partnersCleanedOfRayons,
        staffCleanedOfRayons: summary.staffCleanedOfRayons,
        suppliersVerified: summary.suppliersVerified,
        totalAccountsToMigrate: summary.actionsToPerform.length,
        sampleActions: summary.actionsToPerform.slice(0, 20),
      },
    });
  } catch (error: any) {
    console.error("[MIGRATION ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur lors de la migration" }, { status: 500 });
  }
}

