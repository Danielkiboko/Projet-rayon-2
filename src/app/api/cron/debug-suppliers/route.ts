import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Endpoint de diagnostic — accessible seulement en dev ou avec le secret
// Usage: GET /api/cron/debug-suppliers?secret=VOTRE_SECRET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report: any = {
    suppliers_collection: [],
    users_with_supplier_role: [],
    total_suppliers_detected: 0,
    suppliers_with_email: 0,
    suppliers_without_email: [],
  };

  // 1. Collection "suppliers"
  try {
    const snap = await adminDb.collection("suppliers").get();
    snap.forEach((doc: any) => {
      const d = doc.data();
      report.suppliers_collection.push({
        id: doc.id,
        email: d.email || "⚠️ PAS D'EMAIL",
        phone: d.phone || "—",
        company: d.company || d.companyName || d.agencyName || d.displayName || d.name || "—",
        role: d.role || "—",
        rayon: d.rayon || d.rayons || "—",
      });
    });
  } catch (err: any) {
    report.suppliers_collection_error = err.message;
  }

  // 2. Collection "users" avec role supplier
  try {
    const snap = await adminDb.collection("users").get();
    snap.forEach((doc: any) => {
      const d = doc.data();
      const role  = (d.role  || "").toString().toLowerCase();
      const roles = Array.isArray(d.roles) ? d.roles.map((r: any) => r.toString().toLowerCase()) : [];
      const isSupplier = role.includes("supplier") || roles.some((r: string) => r.includes("supplier"));

      if (isSupplier) {
        report.users_with_supplier_role.push({
          id: doc.id,
          email: d.email || "⚠️ PAS D'EMAIL",
          displayName: d.displayName || d.name || "—",
          role: d.role || "—",
          rayon: d.rayon || d.rayons || "—",
        });
      }
    });
  } catch (err: any) {
    report.users_error = err.message;
  }

  // Merge comme dans le vrai cron
  const suppliersMap = new Map<string, any>();
  report.suppliers_collection.forEach((s: any) => suppliersMap.set(s.id, s));
  report.users_with_supplier_role.forEach((u: any) => {
    const existing = suppliersMap.get(u.id) || {};
    suppliersMap.set(u.id, { ...existing, ...u });
  });

  const all = Array.from(suppliersMap.values());
  report.total_suppliers_detected = all.length;
  report.suppliers_with_email = all.filter((s: any) => s.email && s.email.includes("@")).length;
  report.suppliers_without_email = all
    .filter((s: any) => !s.email || !s.email.includes("@"))
    .map((s: any) => ({ id: s.id, company: s.company || s.displayName }));

  report.final_list = all;

  return NextResponse.json(report, { status: 200 });
}
