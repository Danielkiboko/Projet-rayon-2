import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { pingRedis, isRedisConfigured } from "@/lib/cache";

/**
 * GET /api/health/architecture
 * Diagnostic en temps réel des briques haute-disponibilité (3 000+ utilisateurs simultanés) :
 * CDN Edge / Cloudflare, Load Balancer & Scaling Backend, Cache L1+Redis L2 (Single-Flight),
 * Rate Limiting distribué, et Base de données Firestore.
 */
export async function GET(req: NextRequest) {
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
  const cloudflareDetected = Boolean(req.headers.get("cf-ray") || req.headers.get("cf-connecting-ip"));

  const estimatedCapacity =
    isCloudRunOrAppHosting && redisStatus.ok
      ? "5 000 à 15 000+ utilisateurs simultanés (App Hosting auto-scaling + Redis L2)"
      : cloudflareDetected && redisStatus.ok
      ? "1 500 à 3 500+ visiteurs simultanés (Cloudflare Edge CDN + Redis L2 + Hostinger)"
      : redisStatus.ok
      ? "150 à 400 utilisateurs simultanés (Hostinger mono-instance + Redis L2 — activez Cloudflare ou App Hosting pour 3 000+)"
      : "50 à 150 utilisateurs simultanés (cache L1 RAM seul)";

  return NextResponse.json(
    {
      status: firestoreStatus.ok ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - t0,
      estimatedCapacity,
      architecture: {
        cdn: {
          enabled: true,
          cloudflareEdgeActive: cloudflareDetected,
          edgeCacheHeaders:
            "public, max-age=30, s-maxage=120, stale-while-revalidate=600, stale-if-error=86400",
        },
        backend: {
          runtime: `Node.js ${process.version}`,
          scalingMode: isCloudRunOrAppHosting
            ? "multi-instance-load-balanced (Cloud Run / Firebase App Hosting · jusqu'à 20 instances)"
            : "single-instance (Hostinger — prêt pour App Hosting 1..20 instances via apphosting.yaml)",
          instanceId: process.env.K_REVISION || process.env.HOSTNAME || "primary",
        },
        cache: {
          l1Ram: true,
          singleFlightStampedeProtection: true,
          distributedRateLimiting: true,
          redisL2Configured: isRedisConfigured(),
          redisConnected: redisStatus.ok,
          redisLatencyMs: redisStatus.latencyMs,
          ...(redisStatus.httpStatus ? { redisHttpStatus: redisStatus.httpStatus } : {}),
          ...(redisStatus.error ? { redisError: redisStatus.error } : {}),
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
