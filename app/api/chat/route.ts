import arcjet, { fixedWindow, shield } from "@arcjet/next";
import { type NextRequest, NextResponse } from "next/server";
import { AllProvidersFailedError, NoProviderConfiguredError } from "@/lib/ai/errors";
import { createAIResponse, createAIStream } from "@/lib/ai/router";
import { chatRequestSchema } from "@/lib/ai/schema";
import { globalRateLimiter } from "@/lib/security/rate-limiter";
import { randomUUID } from "node:crypto";
import { finishUsage, reserveUsage, SaaSError } from "@/lib/saas/server";
import { PLAN_LIMITS } from "@/lib/saas/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

const security = process.env.ARCJET_KEY
  ? arcjet({
      key: process.env.ARCJET_KEY,
      rules: [shield({ mode: "LIVE" }), fixedWindow({ mode: "LIVE", window: "1m", max: 30 })],
    })
  : null;

function getClientIdentifier(request: NextRequest): string {
  // Prefer the platform-provided single IP header; x-forwarded-for may contain
  // a client-supplied value when requests pass through untrusted proxies.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown-client";
}

async function readBoundedRequestBody(
  request: NextRequest,
  maxBytes: number
): Promise<{ text: string; tooLarge: boolean }> {
  if (!request.body) return { text: "", tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder("utf-8", { fatal: true }).decode(body), tooLarge: false };
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get("x-request-id") ||
    (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()));
  const clientIp = getClientIdentifier(request);
  const upstreamAbortController = new AbortController();
  const upstreamSignal = AbortSignal.any([
    request.signal,
    upstreamAbortController.signal,
    AbortSignal.timeout(55_000),
  ]);
  let authenticatedUid: string | null = null;
  let usageReservation: Awaited<ReturnType<typeof reserveUsage>> | null = null;

  try {
    // 1. Arcjet rate limiting if configured
    if (security) {
      const decision = await security.protect(request);
      if (decision.isDenied()) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment before trying again." },
          {
            status: decision.reason.isRateLimit() ? 429 : 403,
            headers: { "x-request-id": correlationId },
          }
        );
      }
    } else {
      // 2. Built-in sliding window rate limiter fallback
      const rateCheck = globalRateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: "Rate limit reached. Please wait a moment before sending another message." },
          {
            status: 429,
            headers: {
              "x-request-id": correlationId,
              "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
            },
          }
        );
      }
    }

    // 3. Bound request-body parsing before JSON decoding.
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1_000_000) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: { "x-request-id": correlationId } }
      );
    }

    let body: { text: string; tooLarge: boolean };
    try {
      body = await readBoundedRequestBody(request, 1_000_000);
    } catch {
      return NextResponse.json(
        { error: "Invalid request body encoding." },
        { status: 400, headers: { "x-request-id": correlationId } }
      );
    }

    if (body.tooLarge) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: { "x-request-id": correlationId } }
      );
    }
    if (!body.text) {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400, headers: { "x-request-id": correlationId } }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body.text);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request payload." },
        { status: 400, headers: { "x-request-id": correlationId } }
      );
    }

    const parsed = chatRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid chat request.";
      return NextResponse.json(
        { error: firstIssue },
        { status: 400, headers: { "x-request-id": correlationId } }
      );
    }

    const { messages, stream, style, customSystemPrompt, language, temperature, guestMode } = parsed.data;

    // Registered sessions must be validated server-side. Guest mode stays temporary,
    // with the existing per-IP rate limiter protecting anonymous model access.
    if (!guestMode) {
      const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const bearer = request.headers.get("authorization") || "";
      const idToken = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

      if (!firebaseApiKey || !idToken) {
        return NextResponse.json(
          { error: "Please sign in to use your TIWAT workspace." },
          { status: 401, headers: { "x-request-id": correlationId } }
        );
      }

      // Firebase Identity Toolkit validates the ID token server-side. Never trust a UID sent by the browser.
      const verification = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
          cache: "no-store",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
        }
      ).catch(() => null);

      if (!verification) {
        return NextResponse.json(
          { error: "Sign-in verification is temporarily unavailable. Please retry." },
          { status: 503, headers: { "x-request-id": correlationId } }
        );
      }

      if (!verification.ok) {
        const status = verification.status >= 500 ? 503 : 401;
        return NextResponse.json(
          {
            error:
              status === 503
                ? "Sign-in verification is temporarily unavailable. Please retry."
                : "Your sign-in session is invalid or expired. Please sign in again.",
          },
          { status, headers: { "x-request-id": correlationId } }
        );
      }

      const verifiedUser = await verification.json().catch(() => null) as { users?: Array<{ localId?: string }> } | null;
      if (!verifiedUser?.users?.[0]?.localId) {
        return NextResponse.json(
          { error: "Your sign-in session is invalid or expired. Please sign in again." },
          { status: 401, headers: { "x-request-id": correlationId } }
        );
      }
      authenticatedUid = verifiedUser.users[0].localId;
    }

    // Durable quota enforcement applies to signed-in accounts. Guest sessions remain
    // protected by the IP limiter until a separate anonymous quota policy is defined.
    if (authenticatedUid) {
      const inputCharacters = messages.reduce((total, message) => total + message.content.length, 0);
      if (inputCharacters > PLAN_LIMITS.enterprise.maxInputCharacters) {
        return NextResponse.json({ error: "This conversation is too large. Start a new chat or shorten the context." }, {
          status: 413, headers: { "x-request-id": correlationId },
        });
      }
      const requestedKey = request.headers.get("idempotency-key")?.trim();
      const idempotencyKey = requestedKey && requestedKey.length >= 8 && requestedKey.length <= 200
        ? requestedKey
        : randomUUID();
      usageReservation = await reserveUsage(authenticatedUid, inputCharacters, idempotencyKey);
      if (usageReservation.duplicate) {
        return NextResponse.json({ error: "This request ID has already been used. Send a new idempotency key for a new message." }, {
          status: 409, headers: { "x-request-id": correlationId, "Cache-Control": "no-store" },
        });
      }
      if (inputCharacters > PLAN_LIMITS[usageReservation.plan].maxInputCharacters) {
        if (usageReservation.event_id) await finishUsage(usageReservation.event_id, "released");
        usageReservation = null;
        return NextResponse.json({ error: "This conversation exceeds your current plan's context limit." }, {
          status: 413, headers: { "x-request-id": correlationId, "Cache-Control": "no-store" },
        });
      }
      if (!usageReservation.allowed) {
        return NextResponse.json({
          error: "Daily message limit reached for your current plan.",
          quota: { used: usageReservation.used, limit: usageReservation.limit, resetAt: usageReservation.reset_at },
        }, { status: 429, headers: { "x-request-id": correlationId, "Cache-Control": "no-store" } });
      }
    }

    // 4. Streaming execution if requested
    if (stream) {
      const encoder = new TextEncoder();
      const streamGenerator = createAIStream(messages, {
        style,
        customSystemPrompt,
        language,
        temperature,
        correlationId,
        signal: upstreamSignal,
      });

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamGenerator) {
              const data = JSON.stringify(chunk);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            if (!request.signal.aborted && !upstreamAbortController.signal.aborted) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            }
          } catch (streamError) {
            const clientDisconnected = request.signal.aborted || upstreamAbortController.signal.aborted;
            if (!clientDisconnected) {
              const reason = streamError instanceof Error ? streamError.message : "Unknown stream error";
              console.error(`[TIWAT ${correlationId}] Stream generation failed: ${reason}`);
              try {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ error: "TIWAT could not complete that response. Please try again." })}\n\n`
                  )
                );
                controller.close();
              } catch {
                // The client may have closed the stream between the abort check and enqueue.
              }
            }
          } finally {
            if (usageReservation?.event_id) {
              await finishUsage(usageReservation.event_id, succeeded ? "completed" : "failed", {
                provider: streamProvider, model: streamModel, promptTokens, completionTokens, latencyMs: Date.now() - startedAt,
              }).catch((usageError) => {
                console.error(`[TIWAT ${correlationId}] Usage reconciliation failed:`, usageError instanceof Error ? usageError.message : "unknown");
              });
            }
          }
        },
        cancel() {
          upstreamAbortController.abort();
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "x-request-id": correlationId,
        },
      });
    }

    // 5. Non-streaming execution
    const startedAt = Date.now();
    const result = await createAIResponse(messages, {
      style,
      customSystemPrompt,
      language,
      temperature,
      correlationId,
      signal: upstreamSignal,
    });
    if (usageReservation?.event_id) {
      await finishUsage(usageReservation.event_id, "completed", {
        provider: result.provider, model: result.model,
        promptTokens: result.usage?.promptTokens, completionTokens: result.usage?.completionTokens,
        latencyMs: result.latencyMs ?? Date.now() - startedAt,
      });
      usageReservation = null;
    }

    return NextResponse.json(
      {
        message: result.message,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "x-request-id": correlationId,
        },
      }
    );
  } catch (error) {
    if (usageReservation?.event_id) {
      await finishUsage(usageReservation.event_id, "failed").catch((usageError) => {
        console.error(`[TIWAT ${correlationId}] Usage reconciliation failed:`, usageError instanceof Error ? usageError.message : "unknown");
      });
      usageReservation = null;
    }
    if (error instanceof SaaSError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "x-request-id": correlationId } });
    }
    if (error instanceof NoProviderConfiguredError) {
      return NextResponse.json(
        {
          error:
            "TIWAT is not connected to an AI provider yet. Configure at least one server-side API key (GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).",
        },
        { status: 503, headers: { "x-request-id": correlationId } }
      );
    }

    if (error instanceof AllProvidersFailedError) {
      console.error(`[TIWAT ${correlationId}] All providers failed:`, error.failures);
      return NextResponse.json(
        {
          error:
            "All connected AI models are temporarily busy or unavailable. Please try again in a few moments.",
        },
        { status: 502, headers: { "x-request-id": correlationId } }
      );
    }

    const reason = error instanceof Error ? error.message : "Unknown error";
    console.error(`[TIWAT ${correlationId}] Chat request error:`, reason);
    return NextResponse.json(
      { error: "TIWAT could not complete that response. Please try again in a moment." },
      { status: 502, headers: { "x-request-id": correlationId } }
    );
  }
}
