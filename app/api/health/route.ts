import { NextResponse } from "next/server";

export function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  return NextResponse.json({ ok: true, configured }, { headers: { "Cache-Control": "no-store" } });
}
