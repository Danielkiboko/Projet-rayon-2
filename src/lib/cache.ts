/**
 * Couche de Cache Serveur Hybride L1 (RAM LRU) + L2 (Upstash Redis REST).
 * - Zéro dépendance externe : fonctionne sur Hostinger Node.js, Firebase App Hosting, Cloud Run et Edge.
 * - Si UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont définis, le cache est partagé
 *   entre toutes les instances Backend (Backend 1, Backend 2, Backend 3...) via Redis.
 * - Sans variables Redis, bascule automatiquement sur un cache L1 en RAM sécurisé et borné.
 */

interface L1Entry {
  value: unknown;
  expiresAt: number;
}

const L1_MAX_ENTRIES = 600;
const globalCacheStore = globalThis as unknown as {
  __rayonsL1Cache?: Map<string, L1Entry>;
  __rayonsInFlight?: Map<string, Promise<unknown>>;
  __rayonsRateL1?: Map<string, { count: number; resetAt: number }>;
};

function getL1Store(): Map<string, L1Entry> {
  if (!globalCacheStore.__rayonsL1Cache) {
    globalCacheStore.__rayonsL1Cache = new Map();
  }
  return globalCacheStore.__rayonsL1Cache;
}

function getInFlightStore(): Map<string, Promise<unknown>> {
  if (!globalCacheStore.__rayonsInFlight) {
    globalCacheStore.__rayonsInFlight = new Map();
  }
  return globalCacheStore.__rayonsInFlight;
}

function getRateL1Store(): Map<string, { count: number; resetAt: number }> {
  if (!globalCacheStore.__rayonsRateL1) {
    globalCacheStore.__rayonsRateL1 = new Map();
  }
  return globalCacheStore.__rayonsRateL1;
}

function stripWrappingQuotes(val: string): string {
  return val.trim().replace(/^["']+|["']+$/g, "").trim();
}

function getRedisConfig(): { url: string; token: string } | null {
  const url = stripWrappingQuotes(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = stripWrappingQuotes(process.env.UPSTASH_REDIS_REST_TOKEN || "");
  if (!url || !token) return null;
  return { url, token };
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisConfig());
}

async function redisCommand<T = any>(args: (string | number)[]): Promise<T | null> {
  const cfg = getRedisConfig();
  if (!cfg) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.result ?? null) as T | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function setL1(key: string, value: unknown, ttlSeconds: number) {
  const store = getL1Store();
  if (store.size >= L1_MAX_ENTRIES) {
    // Éviction FIFO/LRU simple de la plus vieille clé
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function getL1<T>(key: string): T | null {
  const store = getL1Store();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheGet<T>(key: string): Promise<{ hit: boolean; source: "l1" | "redis" | "miss"; value: T | null }> {
  // 1. Vérifier L1 RAM (< 0.1 ms)
  const l1Val = getL1<T>(key);
  if (l1Val !== null) {
    return { hit: true, source: "l1", value: l1Val };
  }

  // 2. Vérifier Redis distribué L2 si configuré
  const raw = await redisCommand<string>(["GET", key]);
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw) as T;
      // Réchauffer L1 (60s) pour absorber les rafales 3 000+ users sur cette instance sans saturer le quota Redis
      setL1(key, parsed, 60);
      return { hit: true, source: "redis", value: parsed };
    } catch {
      return { hit: false, source: "miss", value: null };
    }
  }

  return { hit: false, source: "miss", value: null };
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const safeTtl = Math.max(5, Math.min(3600, Math.floor(ttlSeconds)));
  setL1(key, value, Math.min(safeTtl, 60));

  if (isRedisConfigured()) {
    try {
      const serialized = JSON.stringify(value);
      // Protéger la taille d'entrée Redis (< 900 Ko)
      if (serialized.length < 900_000) {
        await redisCommand(["SET", key, serialized, "EX", safeTtl]);
      }
    } catch {
      // Non bloquant
    }
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const store = getL1Store();
  for (const k of keys) {
    store.delete(k);
  }
  if (isRedisConfigured() && keys.length > 0) {
    await redisCommand(["DEL", ...keys]).catch(() => {});
  }
}

/**
 * Pattern Cache-Aside haute concurrence avec protection anti-stampede (Single-Flight Coalescing) :
 * Si 3 000 requêtes arrivent à la même milliseconde sur une clé expirée, UNE SEULE requête Firestore
 * est exécutée et toutes les autres partagent sa promesse.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; cacheSource: "l1" | "redis" | "db" }> {
  const cached = await cacheGet<T>(key);
  if (cached.hit && cached.value !== null) {
    return { data: cached.value, cacheSource: cached.source === "miss" ? "db" : cached.source };
  }

  const inFlight = getInFlightStore();
  const existingPromise = inFlight.get(key) as Promise<T> | undefined;
  if (existingPromise) {
    const shared = await existingPromise;
    return { data: shared, cacheSource: "l1" };
  }

  const runPromise = (async () => {
    try {
      const fresh = await fetcher();
      await cacheSet(key, fresh, ttlSeconds);
      return fresh;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, runPromise);
  const fresh = await runPromise;
  return { data: fresh, cacheSource: "db" };
}

/**
 * Rate Limiter distribué (Redis INCR + EXPIRE, fallback RAM L1) pour protéger les endpoints
 * contre les rafales abusives / bots lors de pics à 3 000+ utilisateurs simultanés.
 */
export async function checkDistributedRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; current: number; remaining: number; resetInSec: number; engine: "redis" | "l1" }> {
  const safeWindow = Math.max(5, Math.floor(windowSeconds));
  const fullKey = `rl:${bucketKey}`;

  if (isRedisConfigured()) {
    try {
      const count = await redisCommand<number>(["INCR", fullKey]);
      if (typeof count === "number" && count > 0) {
        if (count === 1) {
          await redisCommand(["EXPIRE", fullKey, safeWindow]).catch(() => {});
        }
        return {
          allowed: count <= maxRequests,
          current: count,
          remaining: Math.max(0, maxRequests - count),
          resetInSec: safeWindow,
          engine: "redis",
        };
      }
    } catch {
      // Fallback L1 si Redis indisponible
    }
  }

  const store = getRateL1Store();
  const now = Date.now();
  const existing = store.get(fullKey);
  if (!existing || now > existing.resetAt) {
    if (store.size > 2000) {
      const firstKey = store.keys().next().value;
      if (firstKey) store.delete(firstKey);
    }
    store.set(fullKey, { count: 1, resetAt: now + safeWindow * 1000 });
    return { allowed: true, current: 1, remaining: Math.max(0, maxRequests - 1), resetInSec: safeWindow, engine: "l1" };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= maxRequests,
    current: existing.count,
    remaining: Math.max(0, maxRequests - existing.count),
    resetInSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    engine: "l1",
  };
}

export async function pingRedis(): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
  httpStatus?: number;
  error?: string;
}> {
  const cfg = getRedisConfig();
  if (!cfg) {
    return { configured: false, ok: false, latencyMs: null };
  }
  const t0 = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["PING"]),
      cache: "no-store",
      signal: controller.signal,
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        configured: true,
        ok: false,
        latencyMs,
        httpStatus: res.status,
        error: errText.slice(0, 120) || `HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    return {
      configured: true,
      ok: data?.result === "PONG",
      latencyMs,
      httpStatus: res.status,
    };
  } catch (err: any) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      error: err?.cause?.code || err?.message || "Network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
