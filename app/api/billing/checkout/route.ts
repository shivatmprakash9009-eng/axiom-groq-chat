import { NextRequest, NextResponse } from "next/server";
import { SaaSError, supabaseRest, verifyFirebaseToken } from "@/lib/saas/server";

export const runtime = "nodejs";

const priceFor = (plan: "pro" | "team", interval: "month" | "year") => {
  const names = {
    pro: interval === "month" ? process.env.STRIPE_PRICE_PRO_MONTHLY : process.env.STRIPE_PRICE_PRO_ANNUAL,
    team: interval === "month" ? process.env.STRIPE_PRICE_TEAM_MONTHLY : process.env.STRIPE_PRICE_TEAM_ANNUAL,
  };
  return names[plan];
};

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new SaaSError("Please sign in first.", 401);
    const user = await verifyFirebaseToken(authorization.slice(7).trim(), request.signal);
    const body = await request.json() as { plan?: unknown; interval?: unknown };
    if ((body.plan !== "pro" && body.plan !== "team") || (body.interval !== "month" && body.interval !== "year")) {
      throw new SaaSError("Choose a supported plan and billing interval.", 400);
    }
    const priceId = priceFor(body.plan, body.interval);
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!stripeKey || !appUrl || !priceId) throw new SaaSError("Stripe billing is not configured for this plan.", 503);

    await supabaseRest("tiwat_accounts?on_conflict=firebase_uid", {
      method: "POST", headers: { prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ firebase_uid: user.uid, email: user.email || null }),
    });
    const existing = await supabaseRest<Array<{ stripe_customer_id: string | null }>>(
      `tiwat_subscriptions?firebase_uid=eq.${encodeURIComponent(user.uid)}&select=stripe_customer_id&limit=1`,
    );
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${appUrl.replace(/\/$/, "")}/settings?billing=success`);
    params.set("cancel_url", `${appUrl.replace(/\/$/, "")}/settings?billing=cancelled`);
    params.set("client_reference_id", user.uid);
    params.set("metadata[firebase_uid]", user.uid);
    params.set("metadata[plan]", body.plan);
    params.set("metadata[billing_interval]", body.interval);
    params.set("subscription_data[metadata][firebase_uid]", user.uid);
    params.set("subscription_data[metadata][plan]", body.plan);
    params.set("subscription_data[metadata][billing_interval]", body.interval);
    if (existing[0]?.stripe_customer_id) params.set("customer", existing[0].stripe_customer_id);
    else if (user.email) params.set("customer_email", user.email);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !data.url) {
      console.error("[TIWAT billing] Stripe checkout creation failed", response.status, data.error?.message || "unknown error");
      throw new SaaSError("Could not start checkout. Please try again.", 502);
    }
    return NextResponse.json({ url: data.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SaaSError ? error.status : 400;
    return NextResponse.json({ error: error instanceof SaaSError ? error.message : "Invalid billing request." }, { status });
  }
}
