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

const L1_MAX_ENTRIES = 300;
const globalCacheStore = globalThis as unknown as {
  __rayonsL1Cache?: Map<string, L1Entry>;
};

function getL1Store(): Map<string, L1Entry> {
  if (!globalCacheStore.__rayonsL1Cache) {
    globalCacheStore.__rayonsL1Cache = new Map();
  }
  return globalCacheStore.__rayonsL1Cache;
}

function getRedisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
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
      // Réchauffer L1 brièvement (15s) pour absorber les rafales sur cette instance
      setL1(key, parsed, 15);
      return { hit: true, source: "redis", value: parsed };
    } catch {
      return { hit: false, source: "miss", value: null };
    }
  }

  return { hit: false, source: "miss", value: null };
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const safeTtl = Math.max(5, Math.min(3600, Math.floor(ttlSeconds)));
  setL1(key, value, Math.min(safeTtl, 30));

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
 * Pattern Cache-Aside standard : lit L1 -> Redis L2 -> sinon exécute `fetcher` et remplit le cache.
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

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return { data: fresh, cacheSource: "db" };
}

/**
 * Rate Limiter distribué (Redis INCR + EXPIRE si configuré, sinon fallback L1 local).
 */
export async function checkDistributedRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; engine: "redis" | "l1" }> {
  const fullKey = `rl:${bucketKey}`;

  if (isRedisConfigured()) {
    const count = await redisCommand<number>(["INCR", fullKey]);
    if (typeof count === "number") {
      if (count === 1) {
        await redisCommand(["EXPIRE", fullKey, windowSeconds]);
      }
      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        engine: "redis",
      };
    }
  }

  // Fallback L1 local
  const current = getL1<{ count: number; resetAt: number }>(fullKey);
  const now = Date.now();
  if (!current || now > current.resetAt) {
    setL1(fullKey, { count: 1, resetAt: now + windowSeconds * 1000 }, windowSeconds);
    return { allowed: true, remaining: maxRequests - 1, engine: "l1" };
  }
  const nextCount = current.count + 1;
  setL1(fullKey, { count: nextCount, resetAt: current.resetAt }, Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  return {
    allowed: nextCount <= maxRequests,
    remaining: Math.max(0, maxRequests - nextCount),
    engine: "l1",
  };
}

export async function pingRedis(): Promise<{ configured: boolean; ok: boolean; latencyMs: number | null }> {
  if (!isRedisConfigured()) {
    return { configured: false, ok: false, latencyMs: null };
  }
  const t0 = Date.now();
  const res = await redisCommand<string>(["PING"]);
  return {
    configured: true,
    ok: res === "PONG",
    latencyMs: Date.now() - t0,
  };
}
