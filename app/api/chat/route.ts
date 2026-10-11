import arcjet, { fixedWindow, shield } from "@arcjet/next";
import { type NextRequest, NextResponse } from "next/server";
import { AllProvidersFailedError, NoProviderConfiguredError } from "@/lib/ai/errors";
import { createAIResponse, createAIStream } from "@/lib/ai/router";
import { chatRequestSchema } from "@/lib/ai/schema";
import { globalRateLimiter } from "@/lib/security/rate-limiter";

export const runtime = "nodejs";
export const maxDuration = 60;

const security = process.env.ARCJET_KEY
  ? arcjet({
      key: process.env.ARCJET_KEY,
      rules: [shield({ mode: "LIVE" }), fixedWindow({ mode: "LIVE", window: "1m", max: 30 })],
    })
  : null;

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get("x-request-id") ||
    (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()));
  const clientIp = getClientIdentifier(request);

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

    // 3. Request parsing & schema validation
    const payload: unknown = await request.json().catch(() => null);
    if (!payload) {
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

    const { messages, stream, style, customSystemPrompt, temperature, guestMode } = parsed.data;

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
        }
      ).catch(() => null);

      if (!verification?.ok) {
        return NextResponse.json(
          { error: "Your sign-in session is invalid or expired. Please sign in again." },
          { status: 401, headers: { "x-request-id": correlationId } }
        );
      }

      const verifiedUser = await verification.json().catch(() => null) as { users?: Array<{ localId?: string }> } | null;
      if (!verifiedUser?.users?.[0]?.localId) {
        return NextResponse.json(
          { error: "Your sign-in session is invalid or expired. Please sign in again." },
          { status: 401, headers: { "x-request-id": correlationId } }
        );
      }
    }

    // 4. Streaming execution if requested
    if (stream) {
      const encoder = new TextEncoder();
      const streamGenerator = createAIStream(messages, {
        style,
        customSystemPrompt,
        temperature,
        correlationId,
      });

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamGenerator) {
              const data = JSON.stringify(chunk);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (streamError) {
            const errorMsg = streamError instanceof Error ? streamError.message : "Stream generation failed";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
            controller.close();
          }
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
    const result = await createAIResponse(messages, {
      style,
      customSystemPrompt,
      temperature,
      correlationId,
    });

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
