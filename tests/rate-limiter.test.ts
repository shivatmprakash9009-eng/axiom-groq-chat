import assert from "node:assert";
import test from "node:test";
import { SlidingWindowRateLimiter } from "../lib/security/rate-limiter.ts";

test("SlidingWindowRateLimiter allows requests up to maxRequests", () => {
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 1000,
    maxRequests: 3,
  });

  const ip = "192.168.1.1";
  const r1 = limiter.check(ip);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.remaining, 2);

  const r2 = limiter.check(ip);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.remaining, 1);

  const r3 = limiter.check(ip);
  assert.strictEqual(r3.allowed, true);
  assert.strictEqual(r3.remaining, 0);

  // 4th request exceeds limit
  const r4 = limiter.check(ip);
  assert.strictEqual(r4.allowed, false);
  assert.strictEqual(r4.remaining, 0);
  assert.ok(r4.resetMs > 0);
});

test("SlidingWindowRateLimiter tracks different identifiers independently", () => {
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 1000,
    maxRequests: 2,
  });

  assert.strictEqual(limiter.check("ip-A").allowed, true);
  assert.strictEqual(limiter.check("ip-A").allowed, true);
  assert.strictEqual(limiter.check("ip-A").allowed, false);

  // ip-B should still be allowed
  assert.strictEqual(limiter.check("ip-B").allowed, true);
});

test("SlidingWindowRateLimiter reset clears all records", () => {
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 1000,
    maxRequests: 1,
  });

  limiter.check("ip-X");
  assert.strictEqual(limiter.check("ip-X").allowed, false);

  limiter.reset();
  assert.strictEqual(limiter.check("ip-X").allowed, true);
});
