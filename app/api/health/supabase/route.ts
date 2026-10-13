import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/saas/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!configured) {
    return NextResponse.json(
      { ok: false, service: "supabase", configured: false, connected: false },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    // Read-only probe. Never returns account data or exposes credentials.
    await supabaseRest<Array<{ firebase_uid: string }>>(
      "tiwat_accounts?select=firebase_uid&limit=1",
    );

    return NextResponse.json(
      { ok: true, service: "supabase", configured: true, connected: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "supabase", configured: true, connected: false },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
