/**
 * Minimal in-memory fixed-window rate limiter (single Node instance).
 * Used to throttle public endpoints that could be brute-forced
 * (reservation code lookup, login).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxAttempts: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  entry.count += 1;
  if (entry.count > maxAttempts) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  return { ok: true, retryAfterMs: 0 };
}

// Periodic cleanup so the map does not grow forever
if (typeof setInterval !== 'undefined') {
  const g = globalThis as any;
  if (!g.__rateLimitCleaner) {
    g.__rateLimitCleaner = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }, 60_000);
    // don't hold the event loop open just for cleanup
    (g.__rateLimitCleaner as any).unref?.();
  }
}
