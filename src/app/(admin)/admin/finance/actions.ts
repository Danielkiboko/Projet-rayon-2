"use server";

import { adminDb } from "@/lib/firebase-admin";

function normalizeRayon(data: any): string {
  const candidates: string[] = [];
  if (Array.isArray(data.assignedRayons)) {
    candidates.push(...data.assignedRayons.map((r: any) => String(r || "")));
  }
  if (data.rayon) candidates.push(String(data.rayon));
  if (data.serviceAttached) candidates.push(String(data.serviceAttached));
  if (data.businessType) candidates.push(String(data.businessType));
  if (data.category) candidates.push(String(data.category));
  if (data.role) candidates.push(String(data.role));

  for (const raw of candidates) {
    const val = raw.toLowerCase().trim();
    if (!val) continue;
    if (val.includes("immo") || val.includes("hotel") || val.includes("hôtel")) return "immo";
    if (val.includes("saveur") || val.includes("food") || val.includes("alim") || val.includes("resto")) return "saveurs";
    if (val.includes("mode") || val.includes("fashion") || val.includes("vetement") || val.includes("vêtement")) return "mode";
    if (val.includes("connect") || val.includes("tech") || val.includes("elec") || val.includes("service")) return "connect";
  }
  return "connect";
}

export async function fetchSuppliersAction() {
  try {
    const roles = [
      "SUPPLIER", "supplier",
      "SUPPLIER_IMMO", "supplier_immo",
      "SUPPLIER_SAVEURS", "supplier_saveurs",
      "SUPPLIER_MODE", "supplier_mode",
      "SUPPLIER_CONNECT", "supplier_connect",
    ];
    const usersSnap = await adminDb.collection("users").where("role", "in", roles).get();
    const suppliers: any[] = [];
    usersSnap.forEach((doc: any) => {
      const data = doc.data() || {};
      if (data.isDeleted === true || data.deletionStatus === "DELETED") return;

      const endDate = data.subscriptionEndDate?.toDate
        ? data.subscriptionEndDate.toDate().toISOString()
        : data.subscriptionEndDate
        ? new Date(data.subscriptionEndDate).toISOString()
        : null;

      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt
        ? new Date(data.createdAt).toISOString()
        : null;

      suppliers.push({
        id: doc.id,
        displayName: data.companyName || data.company || data.displayName || data.name || "",
        company: data.companyName || data.company || "",
        email: data.email || "",
        phone: data.phone || data.phoneNumber || "",
        role: data.role || "SUPPLIER",
        rayon: normalizeRayon(data),
        assignedRayons: Array.isArray(data.assignedRayons) ? data.assignedRayons : [],
        subscriptionStatus: data.subscriptionStatus || "",
        isBlocked: Boolean(data.isBlocked || data.isSuspended),
        isOfficialAdminStore: Boolean(data.isOfficialAdminStore || data.isAdminSupplier),
        isAdminSupplier: Boolean(data.isAdminSupplier),
        depositAmount: Number(data.depositAmount) || 50,
        referredByPartnerId: data.referredByPartnerId || data.referredBy || null,
        subscriptionEndDate: endDate,
        createdAt,
      });
    });
    return suppliers;
  } catch (error) {
    console.error("Error fetching suppliers (server action):", error);
    return [];
  }
}
