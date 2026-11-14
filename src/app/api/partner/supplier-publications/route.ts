import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const partnerId = caller.uid;

    // 1. Récupérer tous les fournisseurs rattachés à ce partenaire
    const supplierMap = new Map<string, { id: string; name: string; email: string; rayon: string }>();

    // A. Via la collection referrals
    const referralsSnap = await adminDb
      .collection("referrals")
      .where("referrerId", "==", partnerId)
      .get();

    referralsSnap.forEach((doc: any) => {
      const d = doc.data();
      const sId = d.filleulId || doc.id;
      if (sId) {
        supplierMap.set(sId, {
          id: sId,
          name: d.filleulName || "Boutique",
          email: d.filleulEmail || "",
          rayon: d.rayon || "",
        });
      }
    });

    // B. Via la collection users (referredBy ou referredByPartnerId)
    const [usersSnap1, usersSnap2] = await Promise.all([
      adminDb.collection("users").where("referredBy", "==", partnerId).get(),
      adminDb.collection("users").where("referredByPartnerId", "==", partnerId).get(),
    ]);

    [...usersSnap1.docs, ...usersSnap2.docs].forEach((doc: any) => {
      const d = doc.data();
      const sId = doc.id;
      const current = supplierMap.get(sId);
      supplierMap.set(sId, {
        id: sId,
        name: d.company || d.displayName || current?.name || "Boutique",
        email: d.email || current?.email || "",
        rayon: d.rayon || (Array.isArray(d.assignedRayons) ? d.assignedRayons[0] : "") || current?.rayon || "",
      });
    });

    const supplierIds = Array.from(supplierMap.keys());
    if (supplierIds.length === 0) {
      return NextResponse.json({
        success: true,
        suppliersCount: 0,
        publications: [],
        stats: {
          totalPublications: 0,
          totalViews: 0,
          byRayon: { immo: 0, mode: 0, connect: 0, saveurs: 0 },
          bySupplier: [],
        },
      });
    }

    // 2. Récupérer les publications (produits et propriétés immobilières) de ces fournisseurs
    // Firebase 'in' queries accept up to 30 items per chunk
    const chunks: string[][] = [];
    for (let i = 0; i < supplierIds.length; i += 30) {
      chunks.push(supplierIds.slice(i, i + 30));
    }

    const publications: any[] = [];

    for (const chunk of chunks) {
      const [productsSnap, propertiesSnap] = await Promise.all([
        adminDb.collection("products").where("supplierId", "in", chunk).limit(200).get(),
        adminDb.collection("properties").where("supplierId", "in", chunk).limit(200).get(),
      ]);

      productsSnap.forEach((doc: any) => {
        const p = doc.data();
        const sup = supplierMap.get(p.supplierId);
        const images = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);
        publications.push({
          id: doc.id,
          title: p.title || p.name || "Article sans titre",
          price: Number(p.price) || 0,
          currency: p.currency || "USD",
          type: "PRODUCT",
          rayon: p.rayon || sup?.rayon || "commerce",
          supplierId: p.supplierId,
          supplierName: sup?.name || p.supplierName || "Fournisseur",
          image: images[0] || null,
          status: p.status || (p.inStock === false ? "Rupture" : "Disponible"),
          views: Number(p.views || p.viewsCount) || 0,
          createdAt: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : null,
          category: p.category || "",
        });
      });

      propertiesSnap.forEach((doc: any) => {
        const prop = doc.data();
        const sup = supplierMap.get(prop.supplierId);
        const images = Array.isArray(prop.images) ? prop.images : (prop.image ? [prop.image] : []);
        publications.push({
          id: doc.id,
          title: prop.title || prop.name || "Bien immobilier",
          price: Number(prop.price) || 0,
          currency: prop.currency || "USD",
          type: "PROPERTY",
          rayon: "immo",
          supplierId: prop.supplierId,
          supplierName: sup?.name || prop.supplierName || "Agence / Bailleur",
          image: images[0] || null,
          status: prop.status || "Disponible",
          views: Number(prop.views || prop.viewsCount) || 0,
          createdAt: prop.createdAt?.toDate ? prop.createdAt.toDate().toISOString() : null,
          category: prop.propertyType || "Immobilier",
        });
      });
    }

    // Trier par date de création descendante
    publications.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // 3. Calculer les statistiques globales
    const byRayon: Record<string, number> = { immo: 0, mode: 0, connect: 0, saveurs: 0 };
    let totalViews = 0;
    const supplierCounts: Record<string, { count: number; views: number }> = {};

    publications.forEach((pub) => {
      const r = (pub.rayon || "").toLowerCase();
      if (r.includes("immo")) byRayon.immo++;
      else if (r.includes("mode")) byRayon.mode++;
      else if (r.includes("connect")) byRayon.connect++;
      else if (r.includes("saveur") || r.includes("resto")) byRayon.saveurs++;

      totalViews += pub.views;

      if (!supplierCounts[pub.supplierId]) {
        supplierCounts[pub.supplierId] = { count: 0, views: 0 };
      }
      supplierCounts[pub.supplierId].count++;
      supplierCounts[pub.supplierId].views += pub.views;
    });

    const bySupplier = Array.from(supplierMap.values()).map((s) => ({
      supplierId: s.id,
      supplierName: s.name,
      email: s.email,
      rayon: s.rayon,
      publicationsCount: supplierCounts[s.id]?.count || 0,
      totalViews: supplierCounts[s.id]?.views || 0,
    })).sort((a, b) => b.publicationsCount - a.publicationsCount);

    return NextResponse.json({
      success: true,
      suppliersCount: supplierIds.length,
      publications,
      stats: {
        totalPublications: publications.length,
        totalViews,
        byRayon,
        bySupplier,
      },
    });
  } catch (error: any) {
    console.error("[PARTNER SUPPLIER PUBLICATIONS API ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
