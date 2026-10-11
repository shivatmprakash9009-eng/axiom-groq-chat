import { NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/ai/router";

export const runtime = "nodejs";

export function GET() {
  const providerStatuses = getConfiguredProviders();
  const configuredProviders = providerStatuses.filter((p) => p.configured).map((p) => p.name);
  const isConfigured = configuredProviders.length > 0;

  return NextResponse.json(
    {
      ok: true,
      configured: isConfigured,
      activeProviders: configuredProviders,
      rateLimiter: process.env.ARCJET_KEY ? "arcjet" : "sliding-window",
      version: "2.1.0",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
