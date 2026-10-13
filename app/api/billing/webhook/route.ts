import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, verifyStripeSignature } from "@/lib/saas/server";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Billing webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  if (Number(request.headers.get("content-length") || 0) > 256_000) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try { event = JSON.parse(raw) as StripeEvent; }
  catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }

  const object = event.data.object;
  const metadata = (object.metadata || {}) as Record<string, string>;
  let uid = metadata.firebase_uid || (object.client_reference_id as string | undefined);
  const subscriptionId = typeof object.subscription === "string" ? object.subscription :
    (typeof object.id === "string" && object.id.startsWith("sub_") ? object.id : null);
  const subscriptionEvent = [
    "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
    "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed",
  ].includes(event.type);

  try {
    // Insert-first deduplication ensures Stripe retries cannot reapply an event.
    const inserted = await supabaseRest<Array<{ stripe_event_id: string }>>("tiwat_webhook_events", {
      method: "POST",
      headers: { prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type }),
    });
    if (!inserted.length) return NextResponse.json({ received: true, duplicate: true });

    // Checkout completion alone is not proof of an active subscription. The
    // subscription.created/updated webhook is the source of entitlement truth.
    if (subscriptionEvent && event.type !== "checkout.session.completed") {
      if (!uid && subscriptionId) {
        const existing = await supabaseRest<Array<{ firebase_uid: string }>>(
          `tiwat_subscriptions?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=firebase_uid&limit=1`,
        );
        uid = existing[0]?.firebase_uid;
      }
      if (uid) {
      const customer = typeof object.customer === "string" ? object.customer : null;
      const status = event.type === "customer.subscription.deleted" ? "canceled" :
        event.type === "invoice.payment_failed" ? "past_due" :
        event.type === "invoice.paid" ? "active" :
        (typeof object.status === "string" ? object.status : "inactive");
      const items = object.items as { data?: Array<{ price?: { id?: string; recurring?: { interval?: string } } }> } | undefined;
      const lines = object.lines as { data?: Array<{ price?: { id?: string; recurring?: { interval?: string } } }> } | undefined;
      const priceId = (typeof object.price === "string" ? object.price : undefined)
        || items?.data?.[0]?.price?.id || lines?.data?.[0]?.price?.id || null;
      const plan = metadata.plan === "team" || priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || priceId === process.env.STRIPE_PRICE_TEAM_ANNUAL
        ? "team"
        : metadata.plan === "pro" || priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL
          ? "pro" : null;
      const periodEnd = typeof object.current_period_end === "number" ? new Date(object.current_period_end * 1000).toISOString() : null;
      const interval = metadata.billing_interval === "year" || items?.data?.[0]?.price?.recurring?.interval === "year" || lines?.data?.[0]?.price?.recurring?.interval === "year"
        ? "year"
        : metadata.billing_interval === "month" || items?.data?.[0]?.price?.recurring?.interval === "month" || lines?.data?.[0]?.price?.recurring?.interval === "month"
          ? "month" : null;

      await supabaseRest("tiwat_accounts?on_conflict=firebase_uid", {
        method: "POST", headers: { prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          firebase_uid: uid,
          plan: event.type !== "customer.subscription.deleted" && (status === "active" || status === "trialing") ? (plan || "free") : "free",
        }),
      });
      await supabaseRest("tiwat_subscriptions?on_conflict=stripe_subscription_id", {
        method: "POST", headers: { prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          firebase_uid: uid, stripe_customer_id: customer, stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          status, billing_interval: interval, current_period_end: periodEnd,
          cancel_at_period_end: Boolean(object.cancel_at_period_end),
        }),
      });
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // The event is claimed before processing for deduplication. If processing fails,
    // remove that claim so Stripe's retry can safely attempt the event again.
    await supabaseRest(
      `tiwat_webhook_events?stripe_event_id=eq.${encodeURIComponent(event.id)}`,
      { method: "DELETE" },
    ).catch((cleanupError) => {
      console.error("[TIWAT billing] Could not release failed webhook claim", event.id,
        cleanupError instanceof Error ? cleanupError.message : "unknown");
    });
    console.error("[TIWAT billing] Webhook processing failed", event.id, error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Webhook processing failed; Stripe may retry." }, { status: 500 });
  }
}
