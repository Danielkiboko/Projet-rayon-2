import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES } from "@/lib/serverAuth";
import { requireAnyStaffPermission } from "@/server/guards";

function isStaffOrAdminDoc(data: any): boolean {
  if (!data) return false;
  if (data.isInternalStaff === true || data.accountType === "STAFF") return true;
  const email = String(data.email || "").toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;
  const role = String(data.role || "").toUpperCase().trim();
  return (
    ADMIN_ROLES.includes(role) ||
    role.includes("ADMIN") ||
    role.includes("FONCTIONNAIRE") ||
    role.includes("RESPONSABLE_") ||
    role.includes("GESTIONNAIRE_") ||
    role === "SUPPORT_CLIENT"
  );
}

/**
 * GET /api/admin/suppliers/list
 * Charge instantanément tous les fournisseurs et partenaires via Firebase Admin SDK (1 seule requête ultra-rapide).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["suppliers.view", "suppliers.manage", "finance.view", "products.moderate"]);
    if (!guard.ok) return guard.errorResponse!;

    const supplierRoles1 = [
      "SUPPLIER", "FOURNISSEUR", "SUB_SUPPLIER",
      "SUPPLIER_IMMO", "SUPPLIER_MODE", "SUPPLIER_CONNECT", "SUPPLIER_SAVEURS",
    ];
    const supplierRoles2 = [
      "supplier", "fournisseur", "sub_supplier",
      "supplier_immo", "supplier_mode", "supplier_connect", "supplier_saveurs",
    ];

    const [snap1, snap2, snap3, snapPartners1, snapPartners2] = await Promise.all([
      adminDb.collection("users").where("role", "in", supplierRoles1).get(),
      adminDb.collection("users").where("role", "in", supplierRoles2).get(),
      adminDb.collection("users").where("isSupplier", "==", true).get(),
      adminDb.collection("users").where("isPartner", "==", true).get(),
      adminDb.collection("users").where("role", "==", "PARTNER").get(),
    ]);

    const partnersMap: Record<string, { name: string; code: string }> = {};
    const processPartner = (docSnap: any) => {
      if (partnersMap[docSnap.id]) return;
      const pd = docSnap.data() || {};
      partnersMap[docSnap.id] = {
        name: pd.displayName || pd.name || pd.company || pd.email || "Partenaire",
        code: pd.partnerCode || pd.referralCode || "---",
      };
    };
    snapPartners1.forEach(processPartner);
    snapPartners2.forEach(processPartner);

    const partnersList = Object.entries(partnersMap)
      .map(([id, info]) => ({ id, name: info.name, code: info.code }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const suppliers: any[] = [];
    const seenIds = new Set<string>();

    const processSupplier = (docSnap: any) => {
      if (seenIds.has(docSnap.id)) return;
      seenIds.add(docSnap.id);
      const data = docSnap.data() || {};

      // Exclure le staff interne et les partenaires purs
      if (isStaffOrAdminDoc(data) || data.isPartner === true || String(data.role || "").toUpperCase() === "PARTNER") {
        return;
      }

      const partnerId =
        data.referredByPartnerId ||
        data.referredBy ||
        (data.creatorRole === "PARTNER" ? data.createdBy : null);
      const partnerInfo = partnerId ? partnersMap[partnerId] : null;

      const createdAtMs = data.createdAt?.toMillis
        ? data.createdAt.toMillis()
        : data.createdAt?.seconds
        ? data.createdAt.seconds * 1000
        : typeof data.createdAt === "string"
        ? new Date(data.createdAt).getTime() || 0
        : 0;

      const subEndIso = data.subscriptionEndDate?.toDate
        ? data.subscriptionEndDate.toDate().toISOString()
        : typeof data.subscriptionEndDate === "string"
        ? data.subscriptionEndDate
        : null;

      suppliers.push({
        id: docSnap.id,
        name: data.companyName || data.company || data.displayName || data.name || "Sans nom",
        email: data.email || "",
        rayon: data.rayon || (Array.isArray(data.assignedRayons) && data.assignedRayons[0]) || "Non assigné",
        assignedRayons: data.assignedRayons || (data.rayon ? [data.rayon] : []),
        status:
          data.status === "active" || data.status === "Disponible"
            ? "Actif"
            : data.status === "PENDING_APPROVAL"
            ? "En attente"
            : "Inactif",
        profileUpdateStatus: data.profileUpdateStatus || null,
        pendingProfile: data.pendingProfile || null,
        subscriptionStatus: data.subscriptionStatus || "TRIAL",
        subscriptionEndDate: subEndIso,
        role: data.role || "SUPPLIER",
        createdBy: data.createdBy || null,
        parentSupplierId: data.parentSupplierId || data.createdBy || null,
        referredByPartnerId: partnerId || undefined,
        partnerReferral: Boolean(data.partnerReferral || partnerId),
        partnerName: partnerInfo?.name || undefined,
        partnerCode: partnerInfo?.code || undefined,
        businessType: data.businessType || null,
        serviceAttached: data.serviceAttached || null,
        isOfficialAdminStore: Boolean(data.isOfficialAdminStore || data.isAdminSupplier),
        isAdminSupplier: Boolean(data.isAdminSupplier),
        referralCode: data.referralCode || null,
        referralCodeUsed: data.referralCodeUsed || null,
        createdAtMs,
        phone: data.phone || data.phoneNumber || data.pendingProfile?.phone || "",
        whatsappPhone: data.whatsappPhone || data.pendingProfile?.whatsappPhone || "",
        payoutPhone: data.payoutPhone || data.pendingProfile?.payoutPhone || "",
        payoutProvider: data.payoutProvider || data.pendingProfile?.payoutProvider || "MPESA",
        address: data.address || data.pendingProfile?.address || "",
        companyName: data.companyName || data.company || data.pendingProfile?.companyName || "",
        rccm: data.rccm || data.pendingProfile?.rccm || "",
        idNat: data.idNat || data.pendingProfile?.idNat || "",
        nif: data.nif || data.pendingProfile?.nif || "",
        idDocumentType: data.idDocumentType || data.pendingProfile?.idDocumentType || "",
        idDocumentNumber: data.idDocumentNumber || data.pendingProfile?.idDocumentNumber || "",
        idDocumentFrontUrl: data.idDocumentFrontUrl || data.pendingProfile?.idDocumentFrontUrl || "",
        idDocumentBackUrl: data.idDocumentBackUrl || data.pendingProfile?.idDocumentBackUrl || "",
        nationality: data.nationality || data.pendingProfile?.nationality || "Congolaise (RDC)",
        kycStatus: data.kycStatus || "",
        logoUrl: data.logoUrl || data.logo || data.pendingProfile?.logoUrl || "",
      });
    };

    snap1.forEach(processSupplier);
    snap2.forEach(processSupplier);
    snap3.forEach(processSupplier);

    suppliers.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    return NextResponse.json({
      success: true,
      suppliers,
      partnersList,
    });
  } catch (error: any) {
    console.error("[ADMIN SUPPLIERS LIST API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
