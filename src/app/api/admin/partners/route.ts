import { NextRequest, NextResponse } from "next/server";
import { getServerCaller } from "@/lib/serverAuth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.isAdmin) {
      return NextResponse.json({ success: false, error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    // 1. Fetch partners from Firestore using adminDb
    const [pSnap1, pSnap2] = await Promise.all([
      adminDb.collection("users").where("role", "==", "PARTNER").get(),
      adminDb.collection("users").where("isPartner", "==", true).get(),
    ]);

    const partnersMap: Record<string, any> = {};

    const processPartner = (docSnap: any) => {
      if (partnersMap[docSnap.id]) return;
      const d = docSnap.data();
      const code = d.partnerCode || d.referralCode || "---";
      partnersMap[docSnap.id] = {
        id: docSnap.id,
        name: d.displayName || d.name || d.company || d.email || "Partenaire",
        email: d.email || "",
        phone: d.phone || d.phoneNumber || "",
        partnerCode: code,
        referralCode: code,
        balance: Number(d.partnerBalance || d.referralBalance) || 0,
        totalEarned: Number(d.partnerTotalEarned || d.referralTotalEarned) || 0,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
        suppliersCount: 0,
        suppliers: [],
      };
    };

    pSnap1.forEach(processPartner);
    pSnap2.forEach(processPartner);

    // 2. Fetch referrals relationships
    const referralsSnap = await adminDb.collection("referrals").get();
    const relationsMap: Record<string, any> = {};
    referralsSnap.forEach((docSnap: any) => {
      relationsMap[docSnap.id] = docSnap.data();
    });

    // 3. Fetch all suppliers created by partners
    const supplierRoles = [
      "SUPPLIER", "supplier", "FOURNISSEUR", "fournisseur", 
      "SUPPLIER_IMMO", "SUPPLIER_MODE", "SUPPLIER_CONNECT", "SUPPLIER_SAVEURS",
      "supplier_immo", "supplier_mode", "supplier_connect", "supplier_saveurs"
    ];
    const [sSnapRoles, sSnapFlag] = await Promise.all([
      adminDb.collection("users").where("role", "in", supplierRoles).get(),
      adminDb.collection("users").where("isSupplier", "==", true).get(),
    ]);

    const partnerSuppliersList: any[] = [];
    const seenSupplierIds = new Set<string>();

    const processSupplier = (docSnap: any) => {
      if (seenSupplierIds.has(docSnap.id)) return;
      seenSupplierIds.add(docSnap.id);

      const d = docSnap.data();
      const partnerId = d.referredByPartnerId || d.referredBy || (d.creatorRole === "PARTNER" ? d.createdBy : null);

      if (partnerId && partnersMap[partnerId]) {
        const relation = relationsMap[docSnap.id] || {};
        const supplierItem = {
          id: docSnap.id,
          name: d.company || d.companyName || d.displayName || d.name || "Boutique",
          email: d.email || "",
          phone: d.phone || d.phoneNumber || "",
          rayon: d.rayon || (Array.isArray(d.assignedRayons) && d.assignedRayons[0]) || "Non assigné",
          subscriptionStatus: d.subscriptionStatus || "TRIAL",
          subscriptionEndDate: d.subscriptionEndDate?.toDate ? d.subscriptionEndDate.toDate().toISOString() : (d.subscriptionEndDate || null),
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
          totalCommissions: Number(relation.totalCommissions || 0),
          paymentsCount: Number(relation.paymentsCount || 0),
          partnerId,
          partnerName: partnersMap[partnerId].name,
          partnerCode: partnersMap[partnerId].partnerCode,
        };

        partnerSuppliersList.push(supplierItem);
        partnersMap[partnerId].suppliers.push(supplierItem);
        partnersMap[partnerId].suppliersCount += 1;
      }
    };

    sSnapRoles.forEach(processSupplier);
    sSnapFlag.forEach(processSupplier);

    const partners = Object.values(partnersMap);

    // Compute stats
    const totalPartners = partners.length;
    const totalRecruitedSuppliers = partnerSuppliersList.length;
    const totalEarnedCommissions = partners.reduce((sum, p) => sum + (p.totalEarned || 0), 0);
    const totalPendingCommissions = partners.reduce((sum, p) => sum + (p.balance || 0), 0);

    return NextResponse.json({
      success: true,
      partners,
      partnerSuppliers: partnerSuppliersList,
      stats: {
        totalPartners,
        totalRecruitedSuppliers,
        totalEarnedCommissions,
        totalPendingCommissions,
      },
    });
  } catch (error: any) {
    console.error("[ADMIN PARTNERS API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
