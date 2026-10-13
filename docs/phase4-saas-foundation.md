# TIWAT Phase 4 — SaaS foundation

## Included in this change

- Central plan capability and limit definitions for Free, Pro, Team, and Enterprise.
- Deterministic UTC daily quota evaluation with boundary tests.
- Baseline prompt-contract evaluation tests for honesty, privacy, instruction hierarchy, and language behavior.

## Important launch limitation

The plan policy module is not a production quota enforcement system. Do not use it to grant paid access or promise a usage allowance until quota counters are stored and updated atomically in a durable shared database. A process-local counter is not safe on serverless deployments because concurrent requests and multiple instances can bypass it.

## Recommended implementation order

1. Choose a durable database and create user-plan, usage-event, subscription, team-membership, and API-key records with server-side authorization.
2. Enforce quota reservation before provider calls, then reconcile against actual provider token usage after completion. Use idempotency keys so retries do not double-charge.
3. Add Stripe Checkout and verified webhook handling. Never trust a client redirect as proof of payment.
4. Add a private admin usage dashboard and structured, privacy-minimizing operational events. Do not log message bodies, access tokens, API keys, or raw Firebase ID tokens.
5. Add team workspaces and scoped API keys only after tenant isolation and audit tests are in place.
6. Expand model-based evaluations with a versioned dataset and run them before prompt/router changes.

## Proposed initial plan policy

| Plan | Daily user messages | Teams | API access | Priority routing |
| --- | ---: | --- | --- | --- |
| Free | 30 | No | No | No |
| Pro | 1,000 | No | No | Yes |
| Team | 5,000 | Yes | Yes | Yes |
| Enterprise | 50,000 | Yes | Yes | Yes |

These are proposed defaults, not published pricing or contractual limits. Adjust them before exposing plans to users.

## Required deployment configuration before billing goes live

- Durable database URL and server-only credentials.
- Stripe secret key, webhook signing secret, and product/price IDs.
- Public app URL and a tested webhook endpoint.
- An explicit decision on whether paid tiers are monthly only or monthly plus annual billing.

Never paste secret keys into chat or commit them to Git. Add secrets directly in Vercel Project Settings → Environment Variables after the code and deployment design are agreed.
