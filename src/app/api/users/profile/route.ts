import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Non authentifié. Veuillez vous reconnecter." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      targetUid,
      phone,
      whatsappPhone,
      payoutPhone,
      payoutProvider,
      address,
      commune,
      bio,
      logoUrl,
      primaryColor,
      companyName,
      rccm,
      idNat,
      nif,
      idDocumentType,
      idDocumentNumber,
      idDocumentFrontUrl,
      idDocumentBackUrl,
      nationality,
      representantLegal,
      kycStatus,
      approveProfile,
    } = body;

    // Determine which user document is being updated
    const effectiveUid = targetUid && caller.isAdmin ? targetUid : caller.uid;
    if (targetUid && targetUid !== caller.uid && !caller.isAdmin) {
      return NextResponse.json(
        { error: "Accès refusé : vous ne pouvez modifier que votre propre profil." },
        { status: 403 }
      );
    }

    const userRef = adminDb.collection("users").doc(effectiveUid);
    const snap = await userRef.get();
    const existingData = snap.exists ? snap.data() || {} : {};

    // Note: displayName, name, firstName, lastName, email, role are NEVER overwritten by self-update
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updatedAt: nowIso,
    };

    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      updatePayload.phone = cleanPhone;
      updatePayload.phoneNumber = cleanPhone;
    }
    if (whatsappPhone !== undefined) {
      updatePayload.whatsappPhone = String(whatsappPhone).trim();
    }
    if (payoutPhone !== undefined) {
      updatePayload.payoutPhone = String(payoutPhone).trim();
    }
    if (payoutProvider !== undefined) {
      updatePayload.payoutProvider = String(payoutProvider).trim();
    }
    if (address !== undefined) {
      updatePayload.address = String(address).trim();
    }
    if (commune !== undefined) {
      updatePayload.commune = String(commune).trim();
    }
    if (bio !== undefined) {
      updatePayload.bio = String(bio).trim();
    }
    if (logoUrl !== undefined) {
      updatePayload.logoUrl = logoUrl;
      updatePayload.logo = logoUrl;
      updatePayload.photoURL = logoUrl;
    }
    if (primaryColor !== undefined) {
      updatePayload.primaryColor = String(primaryColor).trim();
    }
    if (companyName !== undefined) {
      updatePayload.companyName = String(companyName).trim();
    }
    if (rccm !== undefined) {
      updatePayload.rccm = String(rccm).trim();
    }
    if (idNat !== undefined) {
      updatePayload.idNat = String(idNat).trim();
    }
    if (nif !== undefined) {
      updatePayload.nif = String(nif).trim();
    }

    // Identity / KYC fields stored directly in the database
    if (idDocumentType !== undefined) {
      updatePayload.idDocumentType = String(idDocumentType).trim();
    }
    if (idDocumentNumber !== undefined) {
      updatePayload.idDocumentNumber = String(idDocumentNumber).trim();
    }
    if (idDocumentFrontUrl !== undefined) {
      updatePayload.idDocumentFrontUrl = idDocumentFrontUrl;
    }
    if (idDocumentBackUrl !== undefined) {
      updatePayload.idDocumentBackUrl = idDocumentBackUrl;
    }
    if (nationality !== undefined) {
      updatePayload.nationality = String(nationality).trim();
    }
    if (representantLegal !== undefined) {
      updatePayload.representantLegal = String(representantLegal).trim();
    }

    const isSupplierAccount =
      String(caller.role || "").toUpperCase().includes("SUPPLIER") ||
      String(caller.role || "").toUpperCase().includes("FOURNISSEUR") ||
      String(existingData.role || "").toUpperCase().includes("SUPPLIER") ||
      String(existingData.role || "").toUpperCase().includes("FOURNISSEUR");

    // If Admin is approving or updating a supplier directly
    if (caller.isAdmin && targetUid) {
      if (approveProfile) {
        const pending = existingData.pendingProfile || {};
        Object.assign(updatePayload, pending, {
          pendingProfile: null,
          profileUpdateStatus: "APPROVED",
          kycStatus: "VERIFIED",
          kycVerifiedAt: nowIso,
          kycVerifiedBy: caller.email || caller.uid,
        });
      } else if (kycStatus) {
        updatePayload.kycStatus = kycStatus;
        if (kycStatus === "VERIFIED") {
          updatePayload.profileUpdateStatus = "APPROVED";
          updatePayload.pendingProfile = null;
          updatePayload.kycVerifiedAt = nowIso;
          updatePayload.kycVerifiedBy = caller.email || caller.uid;
        }
      }
    } else if (isSupplierAccount && !caller.isAdmin) {
      // Check if legal or identity fields changed so Admin is notified in /admin/suppliers
      const hasIdentityOrLegalChange =
        (companyName !== undefined && companyName !== existingData.companyName) ||
        (rccm !== undefined && rccm !== existingData.rccm) ||
        (idNat !== undefined && idNat !== existingData.idNat) ||
        (nif !== undefined && nif !== existingData.nif) ||
        (idDocumentType !== undefined && idDocumentType !== existingData.idDocumentType) ||
        (idDocumentNumber !== undefined && idDocumentNumber !== existingData.idDocumentNumber) ||
        (idDocumentFrontUrl !== undefined && idDocumentFrontUrl !== existingData.idDocumentFrontUrl) ||
        (idDocumentBackUrl !== undefined && idDocumentBackUrl !== existingData.idDocumentBackUrl);

      if (hasIdentityOrLegalChange) {
        updatePayload.pendingProfile = {
          phone: updatePayload.phone ?? existingData.phone ?? "",
          whatsappPhone: updatePayload.whatsappPhone ?? existingData.whatsappPhone ?? "",
          payoutPhone: updatePayload.payoutPhone ?? existingData.payoutPhone ?? "",
          payoutProvider: updatePayload.payoutProvider ?? existingData.payoutProvider ?? "MPESA",
          address: updatePayload.address ?? existingData.address ?? "",
          commune: updatePayload.commune ?? existingData.commune ?? "",
          primaryColor: updatePayload.primaryColor ?? existingData.primaryColor ?? "#C7D300",
          logoUrl: updatePayload.logoUrl ?? existingData.logoUrl ?? "",
          companyName: updatePayload.companyName ?? existingData.companyName ?? "",
          rccm: updatePayload.rccm ?? existingData.rccm ?? "",
          idNat: updatePayload.idNat ?? existingData.idNat ?? "",
          nif: updatePayload.nif ?? existingData.nif ?? "",
          idDocumentType: updatePayload.idDocumentType ?? existingData.idDocumentType ?? "",
          idDocumentNumber: updatePayload.idDocumentNumber ?? existingData.idDocumentNumber ?? "",
          idDocumentFrontUrl: updatePayload.idDocumentFrontUrl ?? existingData.idDocumentFrontUrl ?? "",
          idDocumentBackUrl: updatePayload.idDocumentBackUrl ?? existingData.idDocumentBackUrl ?? "",
          nationality: updatePayload.nationality ?? existingData.nationality ?? "Congolaise (RDC)",
          submittedAt: nowIso,
        };
        updatePayload.profileUpdateStatus = "PENDING_APPROVAL";
        if (updatePayload.idDocumentNumber || updatePayload.idDocumentFrontUrl) {
          updatePayload.kycStatus = existingData.kycStatus === "VERIFIED" ? "VERIFIED" : "PENDING_REVIEW";
        }
      }
    }

    await userRef.set(updatePayload, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Profil et informations d'identité enregistrés dans la base de données.",
      updatedFields: Object.keys(updatePayload),
    });
  } catch (error: any) {
    console.error("[API /api/users/profile] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la sauvegarde du profil." },
      { status: 500 }
    );
  }
}
