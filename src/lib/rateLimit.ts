import { NextRequest, NextResponse } from "next/server";
import { checkDistributedRateLimit } from "./cache";

/**
 * Extrait l'IP client réelle derrière Cloudflare, Cloud Run / App Hosting, ou Hostinger Proxy.
 */
export function getClientIp(req: NextRequest | Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

/**
 * Applique un rate-limit distribué (Redis L2 + fallback L1) sur une route API.
 * Retourne `null` si autorisé, ou une `NextResponse` HTTP 429 prête à être renvoyée.
 */
export async function enforceRateLimit(
  req: NextRequest | Request,
  scope: string,
  maxRequests: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const res = await checkDistributedRateLimit(`${scope}:${ip}`, maxRequests, windowSeconds);
  if (res.allowed) return null;

  return NextResponse.json(
    {
      success: false,
      error: "Trop de requêtes en peu de temps. Veuillez patienter quelques secondes avant de réessayer.",
      retryAfterSeconds: res.resetInSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(res.resetInSec),
        "X-RateLimit-Limit": String(maxRequests),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
