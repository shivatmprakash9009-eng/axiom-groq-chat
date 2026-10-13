import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyStripeSignature } from "../lib/saas/server.ts";

function signatureFor(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

test("Stripe signature accepts a valid recent signature", () => {
  const payload = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
  assert.equal(verifyStripeSignature(payload, signatureFor(payload, "whsec_test"), "whsec_test"), true);
});

test("Stripe signature rejects a modified payload", () => {
  const payload = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
  const signature = signatureFor(payload, "whsec_test");
  assert.equal(verifyStripeSignature(payload + " ", signature, "whsec_test"), false);
});

test("Stripe signature rejects malformed and stale signatures", () => {
  const payload = "{}";
  const stale = signatureFor(payload, "whsec_test", Math.floor(Date.now() / 1000) - 600);
  assert.equal(verifyStripeSignature(payload, stale, "whsec_test"), false);
  assert.equal(verifyStripeSignature(payload, "v1=not-a-signature", "whsec_test"), false);
});
