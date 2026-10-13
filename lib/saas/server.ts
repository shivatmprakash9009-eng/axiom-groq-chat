import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { PLAN_LIMITS, resolvePlan, type PlanId } from "./plans";

const supabaseUrl = () => process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export class SaaSError extends Error {
  constructor(message: string, public status = 500) { super(message); this.name = "SaaSError"; }
}

export async function verifyFirebaseToken(idToken: string, signal?: AbortSignal): Promise<{ uid: string; email?: string }> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new SaaSError("Firebase server verification is not configured.", 503);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }), cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) throw new SaaSError("Sign-in verification is temporarily unavailable.", 503);
  if (!response.ok) throw new SaaSError("Your sign-in session is invalid or expired.", 401);
  const data = await response.json() as { users?: Array<{ localId?: string; email?: string }> };
  const user = data.users?.[0];
  if (!user?.localId) throw new SaaSError("Your sign-in session is invalid or expired.", 401);
  return { uid: user.localId, email: user.email };
}

export async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) throw new SaaSError("SaaS storage is not configured. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", 503);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) throw new SaaSError("SaaS storage is temporarily unavailable.", 503);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[TIWAT SaaS] Supabase request failed", response.status, detail.slice(0, 300));
    throw new SaaSError("SaaS storage request failed.", response.status >= 500 ? 503 : 400);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function getPlan(uid: string): Promise<PlanId> {
  const rows = await supabaseRest<Array<{ plan: string }>>(`tiwat_accounts?firebase_uid=eq.${encodeURIComponent(uid)}&select=plan&limit=1`);
  return resolvePlan(rows[0]?.plan);
}

export async function reserveUsage(uid: string, inputCharacters: number, idempotencyKey = randomUUID()) {
  const plan = await getPlan(uid);
  const limit = PLAN_LIMITS[plan].dailyMessages;
  // PostgREST returns a scalar jsonb function result as the JSON object itself,
  // not as a table row containing a function-named property.
  const quota = await supabaseRest<{ allowed: boolean; duplicate: boolean; used: number; limit: number; event_id?: string; reset_at?: string }>(
    "rpc/tiwat_reserve_daily_usage",
    { method: "POST", body: JSON.stringify({ p_firebase_uid: uid, p_idempotency_key: idempotencyKey, p_input_characters: inputCharacters, p_daily_limit: limit }) },
  );
  if (!quota || typeof quota.allowed !== "boolean") throw new SaaSError("Quota service returned an invalid response.", 503);
  return { ...quota, plan, idempotencyKey };
}

export async function finishUsage(eventId: string, status: "completed" | "failed" | "released", detail: {
  provider?: string; model?: string; promptTokens?: number; completionTokens?: number; latencyMs?: number;
} = {}) {
  await supabaseRest("rpc/tiwat_finish_usage", { method: "POST", body: JSON.stringify({
    p_event_id: eventId, p_status: status, p_provider: detail.provider || null, p_model: detail.model || null,
    p_prompt_tokens: detail.promptTokens ?? null, p_completion_tokens: detail.completionTokens ?? null, p_latency_ms: detail.latencyMs ?? null,
  }) });
}

export function hashApiKey(key: string) { return createHash("sha256").update(key).digest("hex"); }

export function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string, toleranceSeconds = 300): boolean {
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  });
}
