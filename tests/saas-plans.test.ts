import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDailyQuota, isPlanId, PLAN_LIMITS, resolvePlan } from "../lib/saas/plans.ts";

test("unknown or missing plans safely resolve to free", () => {
  assert.equal(resolvePlan("not-a-plan"), "free");
  assert.equal(resolvePlan(undefined), "free");
  assert.equal(resolvePlan("team"), "team");
  assert.equal(isPlanId("enterprise"), true);
  assert.equal(isPlanId("owner"), false);
});

test("plan capability boundaries are explicit", () => {
  assert.equal(PLAN_LIMITS.free.teams, false);
  assert.equal(PLAN_LIMITS.free.apiAccess, false);
  assert.equal(PLAN_LIMITS.pro.priorityRouting, true);
  assert.equal(PLAN_LIMITS.team.teams, true);
  assert.equal(PLAN_LIMITS.enterprise.apiAccess, true);
});

test("daily quota permits usage below the limit", () => {
  const decision = evaluateDailyQuota(29, "free", new Date("2026-10-13T12:00:00.000Z"));
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.remaining, 1);
    assert.equal(decision.limit, 30);
    assert.equal(decision.resetAt, "2026-10-14T00:00:00.000Z");
  }
});

test("daily quota blocks usage at and above the limit", () => {
  const atLimit = evaluateDailyQuota(30, "free", new Date("2026-10-13T12:00:00.000Z"));
  const aboveLimit = evaluateDailyQuota(45, "free", new Date("2026-10-13T12:00:00.000Z"));
  assert.equal(atLimit.allowed, false);
  assert.equal(aboveLimit.allowed, false);
  if (!atLimit.allowed) assert.equal(atLimit.remaining, 0);
});

test("invalid usage counters are handled defensively", () => {
  const negative = evaluateDailyQuota(-3, "free");
  const notANumber = evaluateDailyQuota(Number.NaN, "free");
  assert.equal(negative.allowed, true);
  assert.equal(notANumber.allowed, true);
  if (negative.allowed) assert.equal(negative.remaining, 30);
  if (notANumber.allowed) assert.equal(notANumber.remaining, 30);
});
