import arcjet, { fixedWindow, shield } from "@arcjet/next";
import { NextRequest, NextResponse } from "next/server";
import { createAIResponse } from "@/lib/ai/router";
import { chatRequestSchema } from "@/lib/ai/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const security = process.env.ARCJET_KEY
  ? arcjet({
      key: process.env.ARCJET_KEY,
      rules: [shield({ mode: "LIVE" }), fixedWindow({ mode: "LIVE", window: "1m", max: 20 })],
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (security) {
      const decision = await security.protect(request);
      if (decision.isDenied()) {
        return NextResponse.json({ error: "Too many requests. Wait a moment and try again." }, { status: decision.reason.isRateLimit() ? 429 : 403 });
      }
    }

    const payload: unknown = await request.json();
    const parsed = chatRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please send a valid message and keep the conversation within the supported size." }, { status: 400 });
    }
    const result = await createAIResponse(parsed.data.messages);
    return NextResponse.json({ message: result.message }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_PROVIDER_CONFIGURED") {
      return NextResponse.json({ error: "Axiom is not connected to an AI provider yet. Add at least one server-side API key in Vercel Environment Variables." }, { status: 503 });
    }
    console.error("Axiom chat request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Axiom could not complete that response. Please try again in a moment." }, { status: 502 });
  }
}
