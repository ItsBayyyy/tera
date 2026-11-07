type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter kept in memory. It is per server instance, which is enough to blunt
 * accidental floods of the public endpoints; it is not a security boundary.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  return function hit(key: string): { ok: boolean; retryAfterSec: number } {
    const t = now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      buckets.set(key, { count: 1, resetAt: t + windowMs });
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
      }
      return { ok: true, retryAfterSec: 0 };
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - t) / 1000) };
    }
    return { ok: true, retryAfterSec: 0 };
  };
}
