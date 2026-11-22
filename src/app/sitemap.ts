import type { MetadataRoute } from "next";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";

export const revalidate = 3600; // Revalider toutes les heures pour performances optimales

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/rayon/connect`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/rayon/immo`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/rayon/mode`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/rayon/saveurs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/supplier/register`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Indexer dynamiquement les produits approuvés depuis Firestore
  const productRoutes: MetadataRoute.Sitemap = [];
  try {
    await initFirebaseAdmin();
    const snap = await adminDb.collection("products").limit(500).get();
    snap.forEach((doc: any) => {
      const d = doc.data() || {};
      const status = String(d.status || "APPROVED").toUpperCase();
      if (status === "REJECTED" || status === "PENDING_APPROVAL" || status === "DRAFT" || d.isHidden === true) {
        return;
      }
      const updated =
        d.updatedAt?.toDate?.() ||
        d.createdAt?.toDate?.() ||
        now;
      productRoutes.push({
        url: `${siteUrl}/product/${encodeURIComponent(doc.id)}`,
        lastModified: updated,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    });
  } catch (err) {
    console.warn("[sitemap] Firestore products skipped (fallback static routes):", err);
  }

  return [...staticRoutes, ...productRoutes];
}
