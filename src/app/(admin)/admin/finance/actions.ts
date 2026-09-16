"use server";

import { adminDb } from "@/lib/firebase-admin";

export async function fetchSuppliersAction() {
  try {
    const roles = [
      "SUPPLIER", "supplier", 
      "SUPPLIER_IMMO", "supplier_immo", 
      "SUPPLIER_SAVEURS", "supplier_saveurs",
      "SUPPLIER_MODE", "SUPPLIER_CONNECT"
    ];
    const usersSnap = await adminDb.collection("users").where("role", "in", roles).get();
    const suppliers: any[] = [];
    usersSnap.forEach((doc: any) => {
      const data = doc.data();
      suppliers.push({
        id: doc.id,
        displayName: data.displayName || "",
        email: data.email || "",
        subscriptionStatus: data.subscriptionStatus || "",
        isOfficialAdminStore: Boolean(data.isOfficialAdminStore || data.isAdminSupplier),
        isAdminSupplier: Boolean(data.isAdminSupplier),
        depositAmount: data.depositAmount || 50,
        // We return an ISO string because Dates cannot be sent from server action to client
        subscriptionEndDate: data.subscriptionEndDate ? data.subscriptionEndDate.toDate().toISOString() : null,
      });
    });
    return suppliers;
  } catch (error) {
    console.error("Error fetching suppliers (server action):", error);
    return [];
  }
}
