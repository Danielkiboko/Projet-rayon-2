import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { cacheGetOrSet } from "@/lib/cache";

function sanitizeDoc(id: string, data: Record<string, any>) {
  // Retirer les champs internes inutiles sur les vitrines publiques et alléger la charge réseau
  const {
    purchasePrice: _pp,
    originalPurchasePrice: _opp,
    supplierEmail: _se,
    ...rest
  } = data;

  // Sérialiser les Timestamps Firestore proprement pour JSON/Redis
  const createdAtMs = data.createdAt?.toMillis
    ? data.createdAt.toMillis()
    : data.createdAt?.seconds
    ? data.createdAt.seconds * 1000
    : 0;

  return {
    id,
    ...rest,
    createdAt: createdAtMs || null,
    updatedAt: null,
  };
}

function matchesRayon(p: any, scope: string): boolean {
  if (!p) return false;
  if (p.status === "REJECTED" || p.status === "ARCHIVED_DELETION" || p.isHidden === true) {
    return false;
  }
  const cat = String(p.category || "").toLowerCase().trim();
  const ray = String(p.rayon || "").toLowerCase().trim();

  if (scope === "mode") {
    return (
      cat === "mode" || ray === "mode" || cat.includes("mode") ||
      cat.includes("vetement") || cat.includes("vêtement") || cat.includes("habit") ||
      cat.includes("chaussure") || cat.includes("accessoire") || cat.includes("pantalon") ||
      cat.includes("robe") || cat.includes("chemise") || cat.includes("costume")
    );
  }
  if (scope === "connect") {
    return (
      cat === "connect" || ray === "connect" || cat.includes("connect") ||
      cat.includes("electr") || cat.includes("électr") || cat.includes("tech") ||
      cat.includes("telecom") || cat.includes("télécom") || cat.includes("starlink") ||
      cat.includes("wifi") || cat.includes("informatique") || cat.includes("ordi") || cat.includes("phone")
    );
  }
  if (scope === "saveurs") {
    return (
      cat === "saveurs" || ray === "saveurs" || cat.includes("saveur") ||
      cat.includes("resto") || cat.includes("restaurant") || cat.includes("plat") ||
      cat.includes("cuisine") || cat.includes("ustensile") || cat.includes("repas") ||
      cat.includes("food") || cat.includes("boisson") || cat.includes("traiteur")
    );
  }
  return true;
}

/**
 * GET /api/catalog/public?scope=home|mode|connect|saveurs|immo
 * Endpoint catalogue haute performance protégé par Cache CDN (s-maxage=60s) + Cache Serveur (L1 RAM + Upstash Redis 120s).
 * Absorbe les pics de trafic sans multiplier les lectures Firestore.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawScope = (searchParams.get("scope") || "home").toLowerCase().trim();
    const scope = ["home", "mode", "connect", "saveurs", "immo"].includes(rawScope) ? rawScope : "home";
    const cacheKey = `catalog:public:v1:${scope}`;

    const { data, cacheSource } = await cacheGetOrSet(cacheKey, 300, async () => {
      if (scope === "immo") {
        const snap = await adminDb
          .collection("properties")
          .where("status", "==", "Disponible")
          .limit(40)
          .get();
        const properties = snap.docs
          .map((d: any) => sanitizeDoc(d.id, d.data() || {}))
          .filter((p: any) => !p.isHidden);
        return { scope, properties, products: [] };
      }

      if (scope === "home") {
        const [prodSnap, propSnap] = await Promise.all([
          adminDb.collection("products").limit(24).get(),
          adminDb.collection("properties").where("status", "==", "Disponible").limit(6).get(),
        ]);

        const products = prodSnap.docs
          .map((d: any) => sanitizeDoc(d.id, d.data() || {}))
          .filter((p: any) => p.status !== "REJECTED" && p.status !== "ARCHIVED_DELETION" && !p.isHidden);

        const properties = propSnap.docs
          .map((d: any) => sanitizeDoc(d.id, d.data() || {}))
          .filter((p: any) => !p.isHidden);

        return { scope, products, properties };
      }

      // Rayon produit spécifique (mode, connect, saveurs)
      const prodSnap = await adminDb.collection("products").limit(60).get();
      const products = prodSnap.docs
        .map((d: any) => sanitizeDoc(d.id, d.data() || {}))
        .filter((p: any) => matchesRayon(p, scope));

      return { scope, products, properties: [] };
    });

    return NextResponse.json(
      {
        success: true,
        ...data,
        cache: cacheSource,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600, stale-if-error=86400",
          "CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=600, stale-if-error=86400",
          "Cloudflare-CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=600, stale-if-error=86400",
          "X-Rayons-Cache": cacheSource,
        },
      }
    );
  } catch (error: any) {
    console.error("[PUBLIC CATALOG API ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur chargement catalogue" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
