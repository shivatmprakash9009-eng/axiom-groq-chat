interface RateLimitRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, RateLimitRecord>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;
  private lastCleanup: number = Date.now();

  constructor(options?: { windowMs?: number; maxRequests?: number; maxEntries?: number }) {
    this.windowMs = options?.windowMs ?? 60_000;
    this.maxRequests = options?.maxRequests ?? 30;
    this.maxEntries = options?.maxEntries ?? 10_000;
  }

  public check(identifier: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    this.cleanupIfNeeded(now);

    const record = this.store.get(identifier) ?? { timestamps: [] };
    const cutoff = now - this.windowMs;
    // Filter timestamps within current window
    const validTimestamps = record.timestamps.filter((ts) => ts > cutoff);

    if (validTimestamps.length >= this.maxRequests) {
      const oldest = validTimestamps[0] ?? now;
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return { allowed: false, remaining: 0, resetMs };
    }

    validTimestamps.push(now);
    if (this.store.size < this.maxEntries || this.store.has(identifier)) {
      this.store.set(identifier, { timestamps: validTimestamps });
    }

    const remaining = Math.max(0, this.maxRequests - validTimestamps.length);
    const resetMs = this.windowMs;
    return { allowed: true, remaining, resetMs };
  }

  private cleanupIfNeeded(now: number): void {
    if (now - this.lastCleanup < 30_000) return;
    this.lastCleanup = now;

    const cutoff = now - this.windowMs;
    for (const [key, record] of this.store.entries()) {
      const valid = record.timestamps.filter((ts) => ts > cutoff);
      if (valid.length === 0) {
        this.store.delete(key);
      } else {
        record.timestamps = valid;
      }
    }
  }

  public reset(): void {
    this.store.clear();
  }
}

export const globalRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});
