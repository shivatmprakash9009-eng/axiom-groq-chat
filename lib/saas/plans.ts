/**
 * TIWAT SaaS plan policy.
 *
 * These are policy definitions only; they do not enforce quotas by themselves.
 * Enforcement must use a durable, shared usage store before paid plans launch.
 */

export type PlanId = "free" | "pro" | "team" | "enterprise";

export interface PlanLimits {
  /** Maximum user messages accepted in a rolling UTC day. */
  dailyMessages: number;
  /** Maximum input characters across a single request. */
  maxInputCharacters: number;
  /** Maximum conversation messages in one request. */
  maxConversationMessages: number;
  /** Whether the account may use team workspaces. */
  teams: boolean;
  /** Whether the account may create API keys. */
  apiAccess: boolean;
  /** Whether the account may use higher-priority provider routing. */
  priorityRouting: boolean;
}

export const PLAN_LIMITS: Readonly<Record<PlanId, Readonly<PlanLimits>>> = {
  free: {
    dailyMessages: 30,
    maxInputCharacters: 50_000,
    maxConversationMessages: 30,
    teams: false,
    apiAccess: false,
    priorityRouting: false,
  },
  pro: {
    dailyMessages: 1_000,
    maxInputCharacters: 150_000,
    maxConversationMessages: 50,
    teams: false,
    apiAccess: false,
    priorityRouting: true,
  },
  team: {
    dailyMessages: 5_000,
    maxInputCharacters: 150_000,
    maxConversationMessages: 50,
    teams: true,
    apiAccess: true,
    priorityRouting: true,
  },
  enterprise: {
    dailyMessages: 50_000,
    maxInputCharacters: 150_000,
    maxConversationMessages: 50,
    teams: true,
    apiAccess: true,
    priorityRouting: true,
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.hasOwn(PLAN_LIMITS, value);
}

export function resolvePlan(value: unknown): PlanId {
  return isPlanId(value) ? value : "free";
}

export interface UsageSnapshot {
  used: number;
  limit: number;
  resetAt: string;
}

export type QuotaDecision =
  | { allowed: true; remaining: number; limit: number; resetAt: string }
  | { allowed: false; remaining: 0; limit: number; resetAt: string };

export function evaluateDailyQuota(used: number, plan: PlanId, now = new Date()): QuotaDecision {
  const safeUsed = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
  const limit = PLAN_LIMITS[plan].dailyMessages;
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  if (safeUsed >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt: reset.toISOString() };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - safeUsed),
    limit,
    resetAt: reset.toISOString(),
  };
}
