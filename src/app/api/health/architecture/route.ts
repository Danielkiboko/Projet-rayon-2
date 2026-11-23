import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { pingRedis, isRedisConfigured } from "@/lib/cache";

/**
 * GET /api/health/architecture
 * Diagnostic en temps réel des briques de l'architecture Rayons.net :
 * CDN, Backend instance, Cache Redis L2 / L1 RAM, et Base de données Firestore.
 */
export async function GET() {
  const t0 = Date.now();

  const [redisStatus, firestoreStatus] = await Promise.all([
    pingRedis(),
    (async () => {
      const f0 = Date.now();
      try {
        await Promise.race([
          adminDb.collection("settings").doc("platform").get(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 4000)),
        ]);
        return { ok: true, latencyMs: Date.now() - f0 };
      } catch (err: any) {
        return { ok: false, latencyMs: Date.now() - f0, error: err?.message || "Firestore error" };
      }
    })(),
  ]);

  const isCloudRunOrAppHosting = Boolean(process.env.K_SERVICE || process.env.FIREBASE_APP_HOSTING);

  return NextResponse.json(
    {
      status: firestoreStatus.ok ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - t0,
      architecture: {
        cdn: {
          enabled: true,
          edgeCacheHeaders: "public, s-maxage=60, stale-while-revalidate=300",
        },
        backend: {
          runtime: `Node.js ${process.version}`,
          scalingMode: isCloudRunOrAppHosting
            ? "multi-instance-load-balanced (Cloud Run / App Hosting)"
            : "single-instance (Hostinger — prêt pour App Hosting multi-instances via apphosting.yaml)",
          instanceId: process.env.K_REVISION || process.env.HOSTNAME || "primary",
        },
        cache: {
          l1Ram: true,
          redisL2Configured: isRedisConfigured(),
          redisConnected: redisStatus.ok,
          redisLatencyMs: redisStatus.latencyMs,
        },
        database: {
          engine: "Google Cloud Firestore (REST pooling natif Google)",
          connected: firestoreStatus.ok,
          latencyMs: firestoreStatus.latencyMs,
        },
      },
    },
    {
      status: firestoreStatus.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
